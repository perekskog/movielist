# movielist

A small web app for browsing a home movie collection: DVDs and other discs on
shelves and in boxes, plus video files on a media server. It shows one
searchable, alphabetical list with where each movie is stored, its format and
whether it has Swedish or English audio or subtitles.

## How it works

```
 disc list (movielist.txt) ─┐
 /Volumes/video/... folders ─┼─ scripts/*.py ─▶ allmovies.json ─▶ Express ─▶ React UI
                             ┘
```

1. **Data collection (Python, `scripts/`)**. This step runs by hand.
   - `movies_ingest.py` turns a source into a JSON list of movies. A source is
     either the hand-maintained disc list `movielist.txt` or a scan of a
     directory tree on the media server.
   - `concat.py` merges several JSON files into one.
   - `movies_report.py` writes a plain-text alphabetical report.
   - `allmovies.sh` runs the whole pipeline and writes `allmovies.json`.
   - `movies_toUTF8.py` is a helper for converting old Latin-1 text files
     (å, ä, ö, §) to UTF-8.
2. **Server (`src/server/server.js`)**. An Express server on port 8080 serves
   the built frontend from `dist/` and returns `src/server/allmovies.json` at
   `/data.json`.
3. **Client (`src/client/App.jsx`)**. A React app that loads `data.json`,
   sorts it by title and lists each movie with:
   - an icon for its location group, then its storage location, media type and
     format (e.g. `📦 A2 [disc/dvd]`)
   - its categories
   - 🇸🇪 / 🇬🇧 badges: no mark if that language is available as audio or
     subtitles, `X` if it isn't, `?` if unknown.

   The text box filters on title, and the category dropdown filters on category.
   The dropdown lists every category in the data, sorted alphabetically.
   Raw audio and subtitle codes are shown alongside the language badges.

   Checkboxes filter on location group, which is derived from `media-location`:

   | Group     | Icon | `media-location`              | Default |
   | --------- | ---- | ----------------------------- | ------- |
   | Server    | 🖥️   | `ms`                          | on      |
   | Hylla     | 📚   | starts with `H` (other below) | on      |
   | Låda      | 📦   | starts with `A`, `B` or `C`   | off     |
   | Spel      | 🎮   | starts with `Hspel`           | off     |
   | Saknas    | ❓   | `Hsaknas`                     | off     |

   Several groups can be checked at once. No group checked is the same as all
   groups checked. A location matching no group gets no icon and is never
   shown.

## Disc list format (`scripts/movielist.txt`)

The file has one movie per line, with tab-separated fields:

```
<location>	<title>	<attributes>
A3	Attack Of The Schoolgirl Zombies	*xvid, §japan, §zoombie, #jp/se
```

| Prefix | Meaning                         |
| ------ | ------------------------------- |
| `*`    | media format (dvd, xvid, …)     |
| `§`    | category (can repeat)           |
| `#`    | language as `audio/subtitle`    |

Lines starting with `#` are comments. The list only holds what has been
checked by hand on the discs. What is on the media server comes from scanning
it, not from this file.

## Movie record (`allmovies.json`)

```json
{
  "title": "Ronin",
  "media-location": "A2",
  "media-type": "disc",
  "media-format": "dvd",
  "audio": "en",
  "subtitle": "se",
  "category": ["?"],
  "comment": "",
  "production-year": -1
}
```

## Development

```sh
npm install
npm run dev:server   # Express on :8080, serves /data.json
npm run dev          # Vite dev server, proxies /data.json to :8080
npm test             # Vitest + Testing Library
npm run build        # production build to dist/
```

Refreshing the movie data:

```sh
cd scripts
./allmovies.sh                      # needs /Volumes/video mounted
cp allmovies.json ../src/server/
```

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) runs `npm test`, pushes the
Docker image to `ghcr.io/perekskog/movielist` and deploys it to Azure
Container Apps (subscription `per-sandbox`, resource group `rg-movielist`):

| Push to        | Container App       | GitHub environment |
| -------------- | ------------------- | ------------------ |
| `main`         | `movielist`         | `production`       |
| other branches | `movielist-feature` | `feature`          |

The login to Azure uses OIDC, so no secrets are stored. The apps scale to
zero, so there is no fixed monthly cost. `infra/azure-setup.sh` creates all
the Azure and GitHub configuration and is safe to re-run.

**See [docs/deployment.md](docs/deployment.md)** for how it works, setting it
up from scratch, logs, troubleshooting, costs and teardown.



## Önskade funktioner

### Red ut och beskriv logik bakom språkflaggor.

Beskriv logiken i README och skriv tester som verifierar den.

Berör 
- syntax i allmovies.txt
- hur filnamn är kodade
- presentationslogik i UI.

> **Kommentar:** Hänger ihop med "Städa språk" och "Inget språk angivet ska ge
> ?/?". När notationen är bestämd går både beskrivningen och testerna för
> `badge()` i `App.jsx` att skriva.


### Koda in kategori i filnamn

Nu kan man bara skriva in kategori i allmovies.txt men samma information ska kunna anges inkodat i filnamnet.


### Allt i en mapp ska ha mapp som kategori

När movies_ingest hittar en undermapp ska allt i den undermappen automatiskt taggas med mappens namn.


### Städa kategori

Vilka notationer har använts och vilka ska användas?

> **Kommentar:** Frågetecken och dubbletter att reda ut: `jul?`, `jul???`,
> `sf?`, `sverige?`, `japan???`, `???japan???`, `?`, samt `eget`/`egen`.


### Kategori: Städa språk

Vilka notationer har använts och vilka ska användas? Har en notering angående -/- men jag tror inte den finns.

> **Kommentar:** `-` används 13 gånger, t.ex. `#en/-` (Brokeback Mountain) och
> `#se/-` (Sällskapsresan 1–4). Andra varianter: `??` (12 gånger), `se?`, `?se`,
> `se:4`, `se-4`, `en:se`, `iran:se`, `sp`/`sa` (spanska?), `ty`/`de` (tyska?).
> Prefixet "Kategori:" stämmer inte, punkten handlar om språk.


### Förhindra hög användning

Tjänsten är öppen och den som får tag på URIn kan skicka obegränsat antal anrop.

> **Kommentar:** Ersätter den gamla punkten om API-nyckel som URI-parameter.
> Container Apps är begränsad till max en replika, vilket sätter ett tak för kostnaden
> men inte stoppar anropen. Nästa steg är inloggning (Easy Auth), se
> "Under consideration" i `docs/azure-migration-plan.md`, eller rate limiting i
> Express.


### Inget språk angivet ska ge ?/?

Om inget språk angetts ska film visas samma som om språk angetts som ? både för audio och subtitle.

> **Kommentar:** Tomt språk blir `""` i JSON, och `badge()` ger då `X` på båda
> flaggorna. Det gäller 130 filmer med `""/""` och cirka 150 där bara undertexten
> saknas (t.ex. `se/`). Filer från mediaservern får redan `?` som standard, så
> problemet gäller bara skivlistan.


## Under consideration


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

### C. Faster first load (cold start)
The apps scale to zero, so the first request after a quiet period, and always
the first one after a deploy, waits for Azure to pull the image from ghcr.io
and start Node on 0.25 vCPU. Cloud Run didn't show this as much: its image was
in Artifact Registry in the same region, it used 1 vCPU, and a deploy left the
new instance running for a while.

Measured with `curl` from home on 2026-10-28:

| App                 | Size                | `/` cold       | `/` warm |
| ------------------- | ------------------- | -------------- | -------- |
| `movielist`         | 0.25 vCPU / 0.5 GiB | 20.8 s, 20.9 s | 0.035 s  |
| `movielist-feature` | 0.25 vCPU / 0.5 GiB | 39.8 s         | 0.037 s  |
| `movielist-feature` | 0.5 vCPU / 1 GiB    | 22.6 s         | 0.051 s  |
| `movielist-feature` | 1.0 vCPU / 2 GiB    | 18.9 s         | 0.038 s  |

`/data.json` (453 KB) takes 0.08 s when warm. A replica scales to zero after
about 6 minutes without requests.

More CPU barely helps: 4× the CPU saves about 2 s, and with one measurement
per size that is within the variation (39.8 s vs 20.9 s at the same size).
The system log (`az containerapp logs show --type system`) shows where the
time goes: about 2 s to prepare, 4 s to pull the 85 MB image from ghcr.io,
and 10 s to create the container. The rest is Node starting, the default
health probes passing and ingress starting to route traffic.

Address this if it becomes a problem in daily use on our phones. Options, in
suggested order:
1. **Warm-up step in `deploy.yml`.** Request the site until it answers after
   each deploy. Free, and it also checks that the deploy works. It doesn't
   help after the app has scaled to zero again.
2. **Keep a replica running on a schedule** that fits within the free grant.
   A `cron` scale rule keeps one replica during set hours; outside them the
   app scales to zero as today. The free grant covers about 200 hours/month
   at 0.25 vCPU / 0.5 GiB (about 6.5 h/day), so e.g. 17–23 every day (about
   180 h) costs about $0 and leaves some margin for `movielist-feature`:
   ```sh
   az containerapp update -n movielist -g rg-movielist --subscription per-sandbox \
     --scale-rule-name evening --scale-rule-type cron \
     --scale-rule-metadata timezone=Europe/Stockholm \
       start="0 17 * * *" end="0 23 * * *" desiredReplicas=1
   ```
   Untested: adding a custom rule probably replaces the default HTTP rule, so
   an explicit HTTP rule may be needed for the app to start on a request
   outside the schedule. Try it on `movielist-feature` first.
3. **Explicit startup probe** that checks often, instead of the default
   probes. Untested; it can at best save a few seconds, since the system log
   accounts for about 16 of the 21 s before the container starts.
4. **Compress responses.** `data.json` is sent uncompressed (453 KB). Gzip
   would make it a fraction of that, which matters on a phone. It doesn't
   affect the cold start itself.
5. Not worth it, per the measurements above:
   - More CPU, e.g. `--cpu 0.5 --memory 1Gi`.
   - A smaller image, since the pull takes only about 4 s.
6. Rejected, because they add a fixed monthly cost:
   - `--min-replicas 1`, which keeps one replica always running. Estimated
     **about $4/month** for `movielist` at 0.25 vCPU / 0.5 GiB, about $10/month
     at 0.5 vCPU / 1 GiB. A running replica is billed at the idle rate almost
     all the time (Sweden Central, 2026-10-28: $0.000003 per vCPU-second and per
     GiB-second), minus the subscription's monthly free grant of 180,000
     vCPU-seconds and 360,000 GiB-seconds, which `movielist-feature` shares.
     A schedule beyond the free grant also costs money, e.g. 07–23 every day
     (about 480 h/month) is about $2.30/month.
   - Azure Container Registry, to keep the image close to the app (about $5/month).



## Ej aktuellt längre

### Dev: Integrera ChatGPT:s testkod

Öppnar upp för att utveckla i cloud shell. Har gått över till vite med autogenererade tester, fortsätt med det.


### Uppdatera p g a "Cloud Default Service Account Change"

Fungerar ändå, lång tid senare.


### Dev: Multistage build med Docker

För att inte behöva kopiera allt (COPY . .). Vad är problemet?
