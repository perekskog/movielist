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
   - its storage location, media type and format (e.g. `A2 [disc/dvd]`)
   - its categories
   - 🇸🇪 / 🇬🇧 badges: no mark if that language is available as audio or
     subtitles, `X` if it isn't, `?` if unknown.

   A text box filters on title. Adding `?latest=true` to the URL also shows a
   category dropdown and the raw audio and subtitle codes.

## Disc list format (`scripts/movielist.txt`)

The file has one movie per line, with tab-separated fields:

```
<location>	<title>	<attributes>
A3	Attack Of The Schoolgirl Zombies	*xvid, §japan, §zoombie, #jp/se, &ms
```

| Prefix | Meaning                         |
| ------ | ------------------------------- |
| `*`    | media format (dvd, xvid, …)     |
| `§`    | category (can repeat)           |
| `#`    | language as `audio/subtitle`    |
| `&ms`  | also available on media server  |

Lines starting with `#` are comments.

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

The app is built into a Docker image (`Dockerfile`, Node 24) and deployed to
Google Cloud Run in `europe-north1` by Cloud Build:

- `cloudbuild-main.yaml` deploys the `movielist` service.
- `cloudbuild-feature.yaml` deploys the `movielist-feature` service.

Both run `npm test` before building the image.



## Önskade funktioner

### Delmängder av filmer/spel

Välj mellan: 
- Server (anges med ms)
- Hyllor (börjar med H)
- Lådor (börjar med A B eller C)

Mediaserver + hyllor i vardagsrum = default

Checkboxar för att slå av/på respektive kategori.

> **Kommentar:** Indelningen finns redan i `media-location`: 550 `ms`, 362 `H…`
> och 699 `A…`/`B…`/`C…`. Däremot läses `&ms` av `movies_ingest.py` men sparas
> inte i posten, så UI:t vet inte vilka skivor som också finns på servern (206
> rader i `movielist.txt`). Det behöver in i JSON, t.ex. `"on-mediaserver": true`,
> innan checkboxarna kan fungera. Det finns inga spel i datan.


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
> Enklast är max antal instanser i Cloud Run, eller rate limiting i Express.


### Inget språk angivet ska ge ?/?

Om inget språk angetts ska film visas samma som om språk angetts som ? både för audio och subtitle.

> **Kommentar:** Tomt språk blir `""` i JSON, och `badge()` ger då `X` på båda
> flaggorna. Det gäller 130 filmer med `""/""` och cirka 150 där bara undertexten
> saknas (t.ex. `se/`). Filer från mediaservern får redan `?` som standard, så
> problemet gäller bara skivlistan.




## Ej aktuellt längre

### Dev: Integrera ChatGPT:s testkod

Öppnar upp för att utveckla i cloud shell. Har gått över till vite med autogenererade tester, fortsätt med det.


### Uppdatera p g a "Cloud Default Service Account Change"

Fungerar ändå, lång tid senare.


### Dev: Multistage build med Docker

För att inte behöva kopiera allt (COPY . .). Vad är problemet?
