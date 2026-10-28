# movielist

A small web app for browsing a home movie collection: DVDs and other discs on
shelves and in boxes, plus video files on a media server. It shows one
searchable, alphabetical list with where each movie is stored, its format and
whether it has Swedish or English audio or subtitles.

## How it works

```
 disc list (movielist.txt) ─┐
 /Volumes/video/... folders ─┼─ scripts/*.py ─▶ allmovies.json ─▶ Express.js ─▶ React UI
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
2. **Server (`src/server/server.js`)**. An Express.js server on port 8080 serves
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

   A row of toggle buttons, each with the group's icon, filters on location
   group, which is derived from `media-location`:

   | Group     | Icon | `media-location`              | Default |
   | --------- | ---- | ----------------------------- | ------- |
   | Server    | 🖥️   | `ms`                          | on      |
   | Hylla     | bookshelf (SVG) | starts with `H` (other below) | on      |
   | Låda      | 📦   | starts with `A`, `B` or `C`   | off     |
   | Spel      | 🎮   | starts with `Hspel`           | off     |
   | Saknas    | ❓   | `Hsaknas`                     | off     |

   Several groups can be on at once. No group on is the same as all groups
   on. A location matching no group gets no icon and is never shown.

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
Container Apps in Express mode (subscription `per-sandbox`, resource group
`rg-movielist`, environment `movielist-express-env`):

| Push to        | Container App       | GitHub environment | URL |
| -------------- | ------------------- | ------------------ | --- |
| `main`         | `movielist`         | `production`       | https://movielist.yellowmoss-d5a3e316.swedencentral.azurecontainerapps.io |
| other branches | `movielist-feature` | `feature`          | https://movielist-feature.yellowmoss-d5a3e316.swedencentral.azurecontainerapps.io |

The login to Azure uses OIDC, so no secrets are stored. The apps scale to
zero, so there is no fixed monthly cost. The first load after a quiet period
takes about 2 seconds. `infra/azure-setup.sh` creates all the Azure and
GitHub configuration and is safe to re-run.

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


### Kategorier för filer på servern

Nu kan man bara skriva in kategori i movielist.txt men samma information ska kunna anges inkodat i filnamnet.
En film kan ha flera kategorier.

När movies_ingest hittar en undermapp ska allt i den undermappen automatiskt taggas med mappens namn.

> **Kommentar:** Förslag:
> - **Filer:** kategorier inom hakparentes, kommaseparerade, sist i namnet:
>   `Tetsuo 1 (1989) (jp,swesub) [japan, sf].mp4`. Parenteser är fakta om
>   filen (år, språk, copy), hakparenteser är kategorier. Komma eftersom vissa
>   kategorier har mellanslag (`mel brooks`). Samma namn som i
>   `movielist.txt`, men utan `§`.
> - **Mappar:** en fil `categories.txt` i mappen, en kategori per rad, `#` för
>   kommentarer. Gäller allt i mappen och dess undermappar. Mappnamnen behöver
>   inte ändras (påverkar inte mediaspelare), och mappar utan filen ger inga
>   kategorier, så `arkiverat`, `nytt` och `Film` blir inte kategorier av
>   misstag.
> - Kategorierna läggs ihop från alla mappar ovanför plus filens egna,
>   dubbletter tas bort. Exempel: `Jul/categories.txt` = `jul`,
>   `Jul/Barn/categories.txt` = `barn`, `Jul/Barn/Tomtar (2001) [disney].mp4`
>   → `jul, barn, disney`.
> - `categories.txt` syns i Finder och är lätt att redigera. Den blir inte en
>   film i listan, eftersom movies_ingest bara läser videofiler.
> - Fungerar fullt ut för `recursive` (som `allmovies.sh` använder), där hela
>   sökvägen finns. `directory` och `filelist` ser bara filnamnen.
> - Bortvalt: hakparenteser i mappnamn (`Japan [japan]/`, kräver omdöpta
>   mappar och citattecken i terminalen), Finder-taggar (följer inte med över
>   SMB/NAS), en `.nfo`/`.json` per film (många små filer), en central
>   kategorilista per titel (måste matcha titlar exakt och hållas aktuell,
>   samma problem som `&ms`).


### Städa bort oanvända lägen i movies_ingest

Bara `recursive` och `movielist` används (i `allmovies.sh`). Ta bort de
andra två, så att kategorilogiken bara behöver finnas på ett ställe.

> **Kommentar:** Alla fyra lägen kom in i samma commit (`e32ccf3`), så
> historiken bakom dem finns inte här. Inget i repot använder `directory`
> eller `filelist`.
> - `directory` läser bara en mapp, utan undermappar, och skickar bara
>   filnamnet vidare. Troligen en föregångare till `recursive`, som gör samma
>   sak plus undermappar. Kan tas bort.
> - `filelist` läser en textfil med en sökväg per rad. Användbart för att
>   skanna utan att ha utdelningen monterad, t.ex.
>   `find /volume1/video -type f > files.txt` direkt på NAS:en. Behövs det
>   inte kan den också tas bort. Den skulle bara få kategorier från `[...]` i
>   sökvägen, inte från `categories.txt`. Till tester räcker `recursive` mot
>   en liten testmapp.
> - Uppdatera docstringen överst i `movies_ingest.py` och "Kategorier för
>   filer på servern" när lägena tas bort.


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
> men inte stoppar anropen. Nästa steg är inloggning, se "B. Restrict who can
> use the site" nedan, eller rate limiting i Express.js-servern.


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
- The server reads it using a **user-assigned managed identity** (Express mode doesn't support system-assigned ones), so there are no keys or tokens to expire.
- Updating the data becomes: run `allmovies.sh`, then `az storage blob upload`, with no redeploy.
- Locally and in tests, an env var gives the data file path, with `scripts/sample_data/` as the fallback.
- Keep `movielist.txt` in a private `movielist-data` repo, iCloud/OneDrive or locally.
- Cost is about $0, with no fixed fee.
- Rejected alternatives:
  - baking the data into the image from a private repo, because the ghcr image is public
  - storing the JSON as a Container App secret, because of size limits and awkward updates
- **Git history:** the data stays in the public history unless you (a) accept that, (b) run `git filter-repo` and force-push (existing clones keep it), or (c) start a fresh repo.

### B. Restrict who can use the site
Today anyone with the URL can read `/data.json`. Two people need access, from
their phones. Container Apps' built-in auth (Easy Auth) isn't available in
Express mode, so the options are:
- **Sign-in in the Express.js server** with Entra ID (e.g. MSAL). Per signs in
  with a Microsoft account; Per's wife is invited as an **Entra guest using
  the email one-time passcode**, which works with any email address. Turn on
  **"assignment required"** on the app registration and assign only those two
  users. Free (Entra free tier), but needs code and a session cookie with a
  long lifetime (about 30 days).
- **A shared password (basic auth)** in the server: simplest, but no
  per-person access control.
- **Google or Apple login:** lets any account in, so it needs an email
  allowlist in the server.
- IP restrictions don't fit, since phone IP addresses change.
- Moving back to a standard environment would allow Easy Auth with no code
  changes, but brings back the 20 s cold start (see
  [docs/deployment.md](docs/deployment.md#cold-start-why-express-mode)).

Any of these also solves the "Förhindra hög användning" todo.

### C. Compress responses
`data.json` (about 450 KB) is sent uncompressed. Gzip in the Express.js server
(e.g. the `compression` middleware) would make it a fraction of that, which
matters on a phone.

## Ej aktuellt längre

### Dev: Integrera ChatGPT:s testkod

Öppnar upp för att utveckla i cloud shell. Har gått över till vite med autogenererade tester, fortsätt med det.


### Uppdatera p g a "Cloud Default Service Account Change"

Fungerar ändå, lång tid senare.


### Dev: Multistage build med Docker

För att inte behöva kopiera allt (COPY . .). Vad är problemet?
