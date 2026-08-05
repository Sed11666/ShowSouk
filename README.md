# ShowSouk

Find where a film is playing across UAE cinemas — search once, compare VOX,
Reel, Novo and Roxy, then book on the cinema's own site.

Live at <https://sed11666.github.io/ShowSouk/>.

## How it's hosted

The deployed site is **static**. GitHub Pages serves files and cannot run Node,
so the browser fetches `data/catalogue.json` once and searches it locally using
[`search.js`](search.js).

`server.js` is a local dev server that exposes the same search over
`/api/search`. It requires the *same* `search.js`, so the two can't drift. It
exists for exercising the API directly and for whenever the scrapers need a real
backend.

Because the site is served from `/ShowSouk/` rather than a domain root, **all
asset paths must stay relative** — a leading `/` resolves to the wrong origin
and 404s.

## Running locally

Static, exactly as deployed — any static file server over the repo root:

```bash
node server.js
```

Then <http://localhost:3000>.

## Regenerating the catalogue

`data/catalogue.json` is generated and committed, because Pages has no build
step of its own. After editing `data/seed.js`:

```bash
node scripts/build-data.js
```

Once the scrapers work, that script's source becomes `scrapers/index.js`
`scrapeAll()` instead of the seed, ideally run on a schedule so the committed
JSON stays fresh.

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
