# Deployment

movielist runs on **Azure Container Apps** and is deployed by **GitHub Actions**.
Every push is tested, built into a Docker image, pushed to **GitHub Container
Registry** (ghcr.io) and deployed. There are no stored passwords and no fixed
monthly cost.

```
 git push ──▶ GitHub Actions ──▶ ghcr.io/perekskog/movielist:<sha>
              test → build          │
                     │ OIDC login   ▼
                     └──────▶ Azure Container Apps
                              main           → movielist
                              other branches → movielist-feature
```

| Push to        | Container App       | GitHub environment | URL |
| -------------- | ------------------- | ------------------ | --- |
| `main`         | `movielist`         | `production`       | https://movielist.bluewater-c73d6fbb.swedencentral.azurecontainerapps.io |
| other branches | `movielist-feature` | `feature`          | https://movielist-feature.bluewater-c73d6fbb.swedencentral.azurecontainerapps.io |

All feature branches share `movielist-feature`, so the latest push wins.

## How it works

### The workflow (`.github/workflows/deploy.yml`)

1. **`test`** runs `npm ci` and `npm test`. If it fails, nothing is deployed.
2. **`deploy`** builds the image from the `Dockerfile`, pushes it to ghcr.io
   tagged with the commit SHA, logs in to Azure and runs
   `az containerapp update --image …`. The run page and the environment in
   GitHub link to the app URL.

Pushes are grouped per target app, so a new push cancels a deploy still
running for the same app.

### The image

- `Dockerfile` is a two-stage build on `node:24-slim`. The first stage builds
  the frontend with Vite. The second stage contains only production
  dependencies, `dist/`, `src/server/server.js` and `src/server/allmovies.json`,
  and runs as the non-root `node` user. The image is about 260 MB.
- `.dockerignore` is an **allowlist**. Only `package*.json`, `index.html`,
  `vite.config.js` and `src/` are sent to the build. If the build needs
  something new, for example a Vite `public/` directory, add it there.
- The movie data is baked into the image, so updating `allmovies.json` means
  committing and pushing it.

### Azure resources

All in subscription `per-sandbox`, region `swedencentral`, resource group
`rg-movielist`:

| Resource | Name | Notes |
| --- | --- | --- |
| Container Apps environment | `movielist-env` | Consumption plan. No Log Analytics (`--logs-destination none`). |
| Container App | `movielist`, `movielist-feature` | Port 8080, external HTTPS ingress, 0–1 replicas, 0.25 CPU, 0.5 GiB |

The apps **scale to zero** when unused. The first request after a quiet
period starts a replica, which takes a few seconds. **At most one replica**
limits both cost and load.

### How GitHub logs in to Azure (OIDC)

The workflow logs in without any password or secret:

- An **Entra app registration**, `github-movielist-deploy`, with a service
  principal, is the identity the workflow acts as.
- Two **federated credentials** on it say: trust a GitHub token if it comes
  from `perekskog/movielist` **and** the job runs in the GitHub environment
  `production` or `feature`. Tokens from other repos, forks or environments
  are rejected.
- A **role assignment** gives it `Contributor` on `rg-movielist` only.

On each run:

1. GitHub's OIDC provider issues a signed token (a JWT) for the job. It is
   valid for that job only and expires after at most an hour. The job needs
   `permissions: id-token: write`, which only allows fetching the token and
   grants no other write access.
2. `azure/login` sends the token to Entra with the audience
   `api://AzureADTokenExchange`, the default for Azure's public cloud.
3. Entra checks GitHub's signature and compares the token's `sub` (subject)
   claim with the federated credentials, for example
   `repo:perekskog/movielist:environment:production`. If they match, it
   returns a short-lived Azure access token.

Nothing long-lived is stored, so there is nothing to rotate or expire.

**Variables, not secrets.** Microsoft's guide suggests storing
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` as GitHub
secrets. Here they are plain repo variables, because they are identifiers,
not credentials: a login only works with a GitHub token that matches the
federated credentials. Switching to secrets only means changing `vars.` to
`secrets.` in the workflow.

**Renaming or transferring the repo breaks the login.** GitHub changed the
subject format on 15 July 2026. Repositories created after that date, and
any repository that is **renamed or transferred** after it, get an immutable
format with numeric IDs, for example
`repo:perekskog@<owner-id>/movielist@<repo-id>:environment:production`. This
repo still uses the old format, which is why the script creates
`repo:perekskog/movielist:environment:…`. After a rename or transfer, update
`GITHUB_REPO` and the subjects in `infra/azure-setup.sh` to the new format
(shown in the repo's OIDC settings), delete the old federated credentials
and re-run the script.

**An alternative identity.** Instead of an Entra app registration, a
user-assigned managed identity with federated credentials can be used. That
is an ordinary Azure resource in the resource group and doesn't need
permission to create app registrations. This setup uses the app
registration.

Sources:
- [OpenID Connect (GitHub concepts)](https://docs.github.com/en/actions/concepts/security/openid-connect)
- [OIDC reference, subject claim formats (GitHub)](https://docs.github.com/en/actions/reference/security/oidc)
- [Authenticate to Azure from GitHub Actions by OpenID Connect (Microsoft Learn)](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect)

The image is pushed with the workflow's built-in `GITHUB_TOKEN`. The ghcr.io
package is public, so Azure pulls it without credentials.

## Everyday use

- **Deploy a feature:** push the branch and open the feature URL, for example
  on the phone.
- **Deploy to production:** merge to `main`.
- **Follow a run:** use the Actions tab, or `gh run watch`. If it fails,
  `gh run view --log-failed` shows why.
- **Live logs:**
  ```sh
  az containerapp logs show -n movielist -g rg-movielist --subscription per-sandbox --follow
  ```
- **Update the movie data:** see "Refreshing the movie data" in the README,
  then commit and push.

## Setting up from scratch

`infra/azure-setup.sh` creates everything above and is safe to re-run.
Existing resources are reused.

1. Prerequisites:
   - the Azure CLI, logged in (`az login`) with Owner (or User Access
     Administrator) access to the subscription, because the script creates a
     role assignment
   - permission to create app registrations in Entra
   - the GitHub CLI, logged in (`gh auth login`) with access to the repo. This
     is optional; without it, the script prints the values to set by hand.
2. Run it:
   ```sh
   ./infra/azure-setup.sh                            # uses per-sandbox
   SUBSCRIPTION=<other> ./infra/azure-setup.sh       # another subscription
   ```
   It registers the `Microsoft.App` provider, then creates the resource
   group, the environment and both apps, the Entra app with its federated
   credentials and role, and the GitHub environments and variables. It prints
   the app URLs at the end.
3. Push a branch. Until the first deploy, the apps run a placeholder image
   that listens on port 80, not 8080, so the URLs return errors. That's
   expected.
4. If the first deploy fails because Azure can't pull the image, the ghcr.io
   package is private. Set it to **Public** under GitHub → Packages →
   movielist → Package settings, then re-run the workflow. GitHub's API can't
   change package visibility.

The script never changes the az CLI's default subscription. Every command
gets `--subscription`.

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| `test` job fails | A failing test | Run `npm test` locally |
| `azure/login` fails with "no matching federated identity record" | The token's subject doesn't match a federated credential: wrong environment, or the repo was renamed or transferred (new subject format) | Compare the subject in the error with `az ad app federated-credential list --id <AZURE_CLIENT_ID>`. See "Renaming or transferring the repo" above |
| `az containerapp update` fails with `AuthorizationFailed` | Role assignment missing | Re-run `infra/azure-setup.sh` |
| Workflow green but the app doesn't respond | New revision is unhealthy, or the image can't be pulled | `az containerapp revision list -n <app> -g rg-movielist --subscription per-sandbox -o table`, then check the logs |
| First request is slow | Cold start after scale to zero | Expected; it takes a few seconds |

## Costs

The expected cost is **about $0/month**:
- **Container Apps consumption plan:** a monthly free grant of 180,000
  vCPU-seconds, 360,000 GiB-seconds and 2 million requests, far above this
  app's use, since it scales to zero.
- **No container registry in Azure:** ghcr.io is free for public packages.
- **No Log Analytics:** it's turned off, so there are no ingestion costs.
- **Entra app registration:** free.

What could start costing money: enabling Log Analytics, adding Azure Container
Registry, raising `--min-replicas` above 0, or sustained heavy traffic.
Check actual costs in Cost Management for `rg-movielist`.

## Moving or tearing down

**Moving to another subscription** in the same tenant: run
`SUBSCRIPTION=<new> ./infra/azure-setup.sh`, push to redeploy, then delete the
old resource group. The Entra app is reused, and the app URLs change.

**Tearing everything down:**
```sh
az group delete -n rg-movielist --subscription per-sandbox       # environment + apps
az ad app delete --id <AZURE_CLIENT_ID>                          # Entra app, credentials, role
gh variable delete AZURE_CLIENT_ID -R perekskog/movielist        # and the other two
gh api -X DELETE repos/perekskog/movielist/environments/production   # and feature
```
Delete the ghcr.io package under GitHub → Packages → movielist → Package
settings, and remove or disable `.github/workflows/deploy.yml`.

## History

Until September 2026 the app ran on Google Cloud Run and was deployed by
Cloud Build. The move is recorded in `docs/azure-migration-plan.md`.
