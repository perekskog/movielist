# Move movielist deployment from GCP Cloud Run to Azure Container Apps (no fixed costs)

## Context
The app is an Express server that serves the Vite build plus `allmovies.json`. Today Cloud Build (`cloudbuild-main.yaml`, `cloudbuild-feature.yaml`) runs the tests, builds the Docker image, pushes it to Artifact Registry and deploys two Cloud Run services, `movielist` and `movielist-feature`, in europe-north1. The goal is the same setup on Azure: Container Apps, which is the closest match to Cloud Run, deployed by GitHub Actions. GCP keeps running in parallel until the final stage, when the Cloud Build files are removed.

**Workflow to keep:** pushing a feature branch deploys `movielist-feature`, so a change can be tested from the phone before merging, and pushing `main` deploys `movielist`. Each app has a stable HTTPS URL (`*.swedencentral.azurecontainerapps.io`) that can be bookmarked. All feature branches share the one feature app, and the latest push wins, as today.

**Constraint: no fixed monthly fee.** So:
- no Azure Container Registry. Images go to **ghcr.io** instead: the repo `perekskog/movielist` is public, so the package can be public and free with no pull credentials.
- Container Apps runs on the **consumption plan** with `min-replicas 0`. Low traffic stays within the monthly free grant (180k vCPU-seconds, 360k GiB-seconds, 2M requests).
- the environment is created with **`--logs-destination none`**, so there is no Log Analytics ingestion cost. Live logs still work through `az containerapp logs show --follow`.

Expected cost: about $0/month.

**Target subscription: `per-sandbox`** (`7135eab0-be2a-4b5e-ac74-9c3c8d9c5ea6`). It's in the same tenant as `per-archive`, is empty, and `Microsoft.App` is not registered. The az CLI default is `per-archive`, so everything must target `per-sandbox` explicitly, and the default is left unchanged. `az` is logged in. `gh` is installed and logged in as `perekskog` (scopes `repo`, `workflow`, but not `read:packages`).

## Changes

### 1. `infra/azure-setup.sh` (new, one-time bootstrap)
A reproducible record of the Azure resources. Subscription: **`per-sandbox`**. Region: **swedencentral**.
- **Parameterized and re-runnable:** `SUBSCRIPTION`, `RG`, `LOCATION` and the app names are variables at the top. Every step checks whether the resource exists (`az … show`) before creating it, and an existing Entra app registration and federated credentials are reused, since they belong to the tenant, not the subscription. Moving to another subscription later means: change `SUBSCRIPTION`, re-run the script, `gh variable set AZURE_SUBSCRIPTION_ID`, redeploy, then `az group delete` the old resource group. Note that the app URLs change with a new environment.
- `SUBSCRIPTION=per-sandbox` at the top. Every `az` command gets `--subscription "$SUBSCRIPTION"`, and the script doesn't run `az account set`, so the CLI default (`per-archive`) is left unchanged.
- `az provider register -n Microsoft.App --wait`
- `az group create -n rg-movielist`
- `az containerapp env create -n movielist-env --logs-destination none`
- `az containerapp create` for `movielist` and `movielist-feature`:
  - `--ingress external --target-port 8080`
  - `--min-replicas 0 --max-replicas 1`: scales to zero and caps usage, which also addresses the "Förhindra hög användning" todo
  - `--cpu 0.25 --memory 0.5Gi`: the smallest size, which stretches the free grant
  - the initial image is `mcr.microsoft.com/k8se/quickstart` until the first CI push
- GitHub OIDC:
  - `az ad app create` and a service principal
  - federated credentials for subjects `repo:perekskog/movielist:environment:production` and `…:environment:feature`
  - role assignment: `Contributor` scoped to `rg-movielist` only
- At the end, print `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` (the `per-sandbox` ID), which go into the GitHub repo variables.

### 2. `.github/workflows/deploy.yml` (new)
- Trigger: `push` on all branches.
- `concurrency:` grouped per target app, so two quick pushes can't deploy over each other. The older run is cancelled.
- Job `test`: `actions/setup-node` (Node 24), `npm ci`, `npm test`.
- Job `deploy` (needs `test`):
  - `environment:` is `production` on `main` and `feature` otherwise
  - `permissions: id-token: write, contents: read, packages: write`
  - `docker/login-action` to ghcr.io with `GITHUB_TOKEN`
  - `docker/build-push-action` builds the new slim `Dockerfile` (section 4) and pushes `ghcr.io/perekskog/movielist:${{ github.sha }}`
  - `azure/login@v2` with the client, tenant and subscription IDs from `vars.*`
  - `az containerapp update -n movielist|movielist-feature -g rg-movielist --image ghcr.io/perekskog/movielist:${{ github.sha }}`
  - print the app FQDN

### 3. Docs (cloudbuild deletion is deferred, see Execution order)
- **Keep `cloudbuild-*.yaml` for now.** Work happens on branch `move-to-azure`. While the files stay, every push deploys to both GCP (through the Cloud Build triggers) and Azure, so the two can be compared on the phone and GCP remains a working fallback. The new Dockerfile is exercised on Cloud Run too.
- `README.md`, "Deployment" section: describe Container Apps, ghcr.io, the workflow, the environments, `infra/azure-setup.sh` and the zero-fixed-cost setup. During the transition, say that GCP Cloud Build still deploys in parallel and will be removed in the final stage. Leave the Cloud Run mention in the "Förhindra hög användning" comment until the final stage.
- No changes to `src/server/server.js`: port 8080 already matches.

### 4. `Dockerfile`: slim multi-stage build
The goal is faster cold starts from ghcr.io. The image shrinks from over 1 GB (`node:24`) to roughly 100–200 MB. This also resolves the "Multistage build med Docker" todo.

```dockerfile
FROM node:24-slim AS build
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /usr/src/app/dist ./dist
COPY src/server/server.js src/server/allmovies.json ./src/server/
USER node
EXPOSE 8080
CMD ["node", "src/server/server.js"]
```
- The runtime stage keeps the `dist/` and `src/server/` layout. `server.js` resolves `__approot` two levels up from its own file, so the paths still work.
- The build now uses `package-lock.json` and `npm ci`, so builds are reproducible. Today only `package.json` is copied.
- The container runs as the non-root `node` user.
- Test files, scripts and dev dependencies stay out of the final image.

### 5. `.dockerignore`: switch to an allowlist
Ignore everything and let through only what the build and runtime stages use. This keeps the context small, stops README, script or workflow edits from invalidating the `npm run build` layer, and keeps anything new, such as `.env` files, out automatically.
```
*
!package.json
!package-lock.json
!index.html
!vite.config.js
!src/
```
- `index.html` loads Bootstrap from a CDN and `/src/index.jsx`. There is no `public/` directory, so nothing else is needed.
- If a `public/` directory is ever added, it has to be allowed here too. The README's Deployment section will note this.

## Execution order
**Can be paused after any step.** GCP keeps running throughout, and idle Azure resources cost about $0. Progress is tracked in `docs/azure-migration-plan.md`: steps become checkboxes (`- [ ]` / `- [x]`) that are ticked off and committed when each step is done. Values only known afterwards (app URLs, Entra app ID, and so on) are added to a "Status / notes" section in that file. To resume in a new session, say "continue with docs/azure-migration-plan.md".

- [x] 0. Copy this plan to `docs/azure-migration-plan.md` in the repo, with the steps below as checkboxes, so work can continue from it later.
- [x] 1. Write the files above.
- [x] 2. Run `infra/azure-setup.sh`. **I'll confirm with you before running it.** It creates Azure resources, although none of them have a fixed fee.
- [x] 3. I set up GitHub with `gh`, confirming with you first:
   - create the environments with `gh api -X PUT repos/perekskog/movielist/environments/production`, and the same for `feature`
   - `gh variable set AZURE_CLIENT_ID|AZURE_TENANT_ID|AZURE_SUBSCRIPTION_ID`, using the values from the setup script's output
- [x] 4. Commit on branch `move-to-azure` and push, after confirming with you. The first run pushes the ghcr.io package. The GCP feature deploy also runs, through Cloud Build, as usual. I follow the run with `gh run watch`, and use `gh run view --log-failed` if it fails.
- [x] 5. ~~You: if the package `movielist` shows as private, set it to **Public** once, under GitHub → Packages → Package settings, because Container Apps pulls anonymously. GitHub's API can't change package visibility, so this step is manual. Then I re-run the workflow with `gh run rerun`, which deploys `movielist-feature`. Test it on the phone next to the GCP feature URL.~~ **Not needed:** the package was already pullable anonymously and the first deploy succeeded. What remains is for Per to test it on the phone.
- [x] 6. Once it's verified, merge to `main`, which deploys `movielist` on Azure. GCP prod updates as well, since both run in parallel.

### Final stage: remove GCP (only after Per has tried out Azure and is happy with it)
- [ ] 7. In a new branch, delete `cloudbuild-main.yaml` and `cloudbuild-feature.yaml` and remove the GCP mentions from the README. Then you disable the Cloud Build triggers and delete the Cloud Run services and the Artifact Registry repo in GCP. Disable the triggers **before** that push, or the feature trigger fails on the missing file.

## Status / notes
Values and findings recorded as the steps are carried out.

- Branch: `move-to-azure`
- Azure subscription: `per-sandbox` (`7135eab0-be2a-4b5e-ac74-9c3c8d9c5ea6`)
- Step 1: `npm test` passes (7/7). The local `docker build` succeeds and the image is **264 MB** (previously over 1 GB). In `docker run`, `/` returns 200 and `/data.json` returns 200 with 1611 movies, and the process runs as the `node` user.
- Step 2: `infra/azure-setup.sh` has run, and re-running it takes about 23 seconds and changes nothing, so it's safe to re-run. Both apps are set to min 0, max 1 replica, 0.25 CPU, 0.5Gi and port 8080. Federated credentials exist for `environment:production` and `environment:feature`. The az CLI default is still `per-archive`. Until the first deploy, the apps run the placeholder image, which listens on port 80, so the URLs don't respond yet.
- Entra app `github-movielist-deploy`, client ID: `44503085-12b1-487e-882d-3c2d62068b23`
- Tenant ID: `027846eb-5ca5-40cf-bd4d-b4d8c50712ea`
- `movielist-feature` URL: https://movielist-feature.bluewater-c73d6fbb.swedencentral.azurecontainerapps.io
- `movielist` URL: https://movielist.bluewater-c73d6fbb.swedencentral.azurecontainerapps.io
- Step 4: pushed on 2026-09-27. Workflow run 36326217077 is green (test, then deploy). The revision `movielist-feature--0000001` runs `ghcr.io/perekskog/movielist:d6a2bbe…` and is Healthy. `/` and `/data.json` return 200. The same push updated GCP Cloud Run `movielist-feature` through Cloud Build (14:33 UTC), so the parallel deploy works.
- GCP URLs for comparison: https://movielist-feature-hzfavhlsoq-lz.a.run.app and https://movielist-hzfavhlsoq-lz.a.run.app
- The Cloud Build triggers are in **europe-west1**: `movielist-main` (`^main$`) and `movielist-feature` (`^main$`, presumably inverted). To disable them before step 7: `gcloud builds triggers update <name> --region europe-west1 --project playground-341718 --disabled`, or use the console.
- Step 7 (in progress, branch `remove-gcp-support`): Per disabled both Cloud Build triggers. `cloudbuild-*.yaml` are deleted and the GCP section is removed from the README. **Remaining:** delete the Cloud Run services `movielist` and `movielist-feature` (europe-north1), the Artifact Registry repo `movielist` (europe-north1) and the disabled triggers (europe-west1) in project `playground-341718`.
- Step 6: PR #12 was squash-merged on 2026-09-27 as `2cca631`. Workflow run 36327575069 is green. The revision `movielist--0000001` is Healthy, and `/` and `/data.json` return 200. GCP `movielist` also updated (revision `movielist-00034`, 14:56 UTC).
- The workflow's actions were bumped to their latest major versions (checkout v7, setup-node v7, buildx v4, login v4, build-push v7, azure/login v3) to get rid of the Node 20 deprecation warnings.

## Verification
- `npm test` passes locally.
- `docker build -t movielist .` succeeds (which confirms the allowlist includes everything the build needs) and `docker images movielist` shows under about 250 MB. `docker run -p 8080:8080 movielist`, and then `/` and `/data.json` respond. This step runs if Docker is available locally; otherwise the first CI run covers it.
- The GitHub Actions run on the feature branch is green.
- `curl https://<movielist-feature FQDN>/` returns the index page, and `/data.json` returns the movie JSON. Open the app in a browser and check that the list renders and search works.
- After merging, repeat for `movielist`.
- `az containerapp show … --query properties.template.scale` shows min 0 and max 1.
- A few days later, Cost Management for `rg-movielist` shows about $0.

---

## Under consideration (NOT part of this implementation)
Per is still deciding. The data isn't sensitive and is already visible on GitHub, so there's no urgency. The ideas below are recorded for later. Nothing in them blocks or changes the migration above.

### A. Make the repo generic by moving the movie data out of it
- The data files are `scripts/movielist.txt`, `src/server/allmovies.json` and `src/server/data.json`.
- Store `allmovies.json` in a **private Azure Blob container**. Either create a new storage account in `per-sandbox`, or reuse the existing one in `rg-storage` (subscription `per-archive`). Reuse works across subscriptions in the same tenant through a role assignment, but a separate account in `per-sandbox` keeps things cleaner.
- The server reads it using the Container App's **managed identity**, so there are no keys or tokens to expire.
- Updating the data becomes: run `allmovies.sh`, then `az storage blob upload`, with no redeploy.
- Locally and in tests, an env var gives the data file path, with `scripts/sample_data/` as the fallback.
- Keep `movielist.txt` in a private `movielist-data` repo, iCloud/OneDrive or locally.
- Cost is about $0, with no fixed fee.
- Rejected alternatives:
  - baking the data into the image from a private repo, because the ghcr image is public
  - storing the JSON as a Container App secret, because of size limits and awkward updates
- **Git history:** the data stays in the public history unless you (a) accept that, (b) run `git filter-repo` and force-push (existing clones keep it), or (c) start a fresh repo.

### B. Restrict who can use the site
Today anyone with the URL can read `/data.json`. The option is **Container Apps built-in auth (Easy Auth)** with Entra ID, applied to both `movielist` and `movielist-feature`:
- Per signs in with a Microsoft account. Per's wife is invited as an **Entra guest using the email one-time passcode**, which works with any email address and needs no Microsoft or Google account.
- Turn on **"assignment required"** on the app registration and assign only those two users.
- No code changes; it's free (Entra free tier).
- Set Easy Auth's session cookie lifetime to about 30 days so new codes are rarely needed. The exact behavior for guest users needs to be verified during setup.
- Side effect: this also solves the "Förhindra hög användning" todo.
- Alternatives considered:
  - Google or Apple login: lets any account in, so it needs an email allowlist in middleware
  - a shared password (basic auth): simplest, but no per-person access control
