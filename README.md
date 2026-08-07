# ShowSouk

Find where a film is playing across UAE cinemas — search once, compare VOX,
Reel, Novo and Roxy, then book on the cinema's own site.

Live at <https://showsouk.com>.

## How it's hosted

The deployed site is **static**. GitHub Pages serves files and cannot run Node,
so the browser fetches `data/catalogue.json` once and searches it locally using
[`search.js`](search.js).

`server.js` is a local dev server that exposes the same search over
`/api/search`. It requires the *same* `search.js`, so the two can't drift. It
exists for exercising the API directly and for whenever the scrapers need a real
backend.

The custom domain is set by the [`CNAME`](CNAME) file at the repo root; deleting
it reverts the site to `sed11666.github.io/ShowSouk/`.

**Keep all asset paths relative.** They work at both the domain root and the
`/ShowSouk/` project path, so the site survives the fallback URL and any future
move to a subdirectory. A leading `/` only works at the root and silently 404s
otherwise.

## Deploying

`main` is the deployed branch — pushing to it publishes. There is no build step
and no live editor:

```
edit → commit → push to main → Pages rebuilds → live in ~1 min
```

## Running locally

Static, exactly as deployed — any static file server over the repo root:

```bash
node server.js
```

Then <http://localhost:3000>.

## The data (`data/catalogue.json`)

`data/catalogue.json` is generated and committed, because Pages has no build
step of its own. Two ways it gets produced:

**Live — Reel (production).** [`scrapers/reel.js`](scrapers/reel.js) drives a
headless browser over Reel's public movie pages and `scripts/scrape.js` writes
the catalogue. A GitHub Action runs it every 3 hours, so the site refreshes
itself with no server:

```bash
npm install                 # first time (pulls Playwright)
npx playwright install chromium
npm run scrape              # writes data/catalogue.json from live Reel data
REEL_LIMIT=3 npm run scrape # quick partial run while developing
```

A full run takes ~10 minutes: the site is client-rendered, so each movie page
needs ~15s to hydrate before its showtimes exist. The scraper only overwrites
the catalogue on a **validated** result, so a failed or empty run leaves the
last good data live.

**VOX is implemented but blocked.** [`scrapers/vox.js`](scrapers/vox.js) maps
VOX's (much nicer) JSON API and is fully unit-tested, but VOX sits behind Akamai
Bot Manager, which rejects headless browsers at the network layer. It runs the
day access exists via partnership. Details in
[`scrapers/README.md`](scrapers/README.md).

**Fallback — seed.** For local UI work without scraping, regenerate from the
hand-written [`data/seed.js`](data/seed.js):

```bash
npm run build:data
```

Test the parsing logic (no browser needed):

```bash
npm run test:scrapers
```

See [`scrapers/README.md`](scrapers/README.md) for how VOX is scraped and the
state of the other chains.

## Booking links

No UAE chain exposes a URL for an individual screening — VOX advances through
seat selection without changing the address, and Reel puts booking behind a
sign-in. So each showtime resolves to the best link available, in order:

| level | lands on |
|---|---|
| `session` | the exact screening — not currently achievable |
| `movie` | the film's page on that chain's site, showtimes listed |
| `cinema` | the chain's home page |

The UI marks which one a chip gives you. Movie-page URLs come from the chains'
own listings — **never construct one**; a fabricated link that 404s is worse
than an honest fallback.

## Layout

```
index.html      search UI
settings.html   appearance (light / dark / system)
theme.js        theme preference, shared by both pages
search.js       search + link resolution, shared by browser and server
server.js       local dev server
data/seed.js    hand-written catalogue, source of truth for now
data/catalogue.json  generated; what the deployed site fetches
scrapers/       per-chain modules + research notes (not implemented yet)
```
