# Scrapers

Each UAE cinema chain gets one module here that turns its public site into the
shape [`data/seed.js`](../data/seed.js) already uses, so the rest of the app
doesn't change when real data replaces the seed.

Nothing here is wired into the server yet — `server.js` still reads the seed.

## What a scraper returns

```js
{
  cinemas: [{ id, brand, name, area, city, bookingUrl }],
  movies:  [{ id, title, genre, rating, language, runtime, links }],
  showtimes: [{ movieId, cinemaId, format, times }],
}
```

`times` entries are either `'18:15'` or `{ time: '18:15', bookingUrl }`. Only
supply `bookingUrl` when it genuinely opens that screening — the UI marks those
differently, so a wrong one is worse than none. See `toSession` in
[`server.js`](../server.js).

`links` maps a brand name to that chain's page for the movie. It is the fallback
the UI uses when no per-session URL exists, which today is always.

## Findings, August 2026

Researched by loading each site in a real browser and watching what it does.
Re-check before building against any of it — these are live sites.

### Deep links to a single screening are not currently possible

This was the goal; none of the chains support it.

**VOX** — clicking a showtime advances through seat selection while the URL
stays `/movies/<slug>`. The chosen screening lives in client state, so no
address identifies it.

**Reel** — clicking a showtime redirects to `/en-ae/user/signin`. Booking is
behind auth; no session URL is exposed publicly.

**Novo** — not reached (see below).

The realistic path to true booking links is a partner/affiliate feed from the
chains, not scraping.

### Per-chain notes

**VOX** (`uae.voxcinemas.com`) — Next.js.

- Listing: `/movies/whatson` (`/movies` alone 404s). `/cinemas`, `/movies/comingsoon` also exist.
- Movie pages: `/movies/<slug>`, e.g. `/movies/spider-man-brand-new-day`. Slug only, no id.
- Showtimes render server-side into the movie page — location, experience (MAX/STANDARD/KIDS) and times are in the DOM.
- No JSON API: `/api/movies` 404s. Data arrives via Next.js server actions (`POST /movies`), which aren't practical to call externally.
- Blocks plain HTTP clients — curl and WebFetch time out or 403. A real browser works.

**Reel** (`reelcinemas.com`, `.ae` redirects here) — best structured of the three.

- Movie pages: `/en-ae/movie-details/<catalogueId>/<slug>`, e.g. `/en-ae/movie-details/HO00005307/spider-man-brand-new-day`.
- The catalogue id is stable, so links survive title changes — prefer it over the slug.
- Movie links are plain anchors on the homepage, so the catalogue is harvestable without executing much JS.
- Movie pages carry showtimes grouped by location and experience (Platinum Suites, Premium, Dolby, ScreenX, Standard), including "Nearly Sold Out" flags.
- Locations: `/en-ae/locations/<slug>`.

**Novo** (`uae.novocinemas.com`) — no route in yet.

- Next.js, heavily client-rendered; the listing produced no anchors and would not hydrate under automation, so movie ids were unreachable.
- Routes `/moviePages` and `/showTime` exist but 404 bare — they need parameters whose shape is undiscovered. `/moviePages/<slug>`, `/movies/<slug>` and `/movieDetails/<slug>` all render their 404 page.
- `robots.txt` allows all and points to a sitemap at `novo.enpointe.io` — **that host's TLS certificate has expired**, so the sitemap is unreadable.
- Backend is `backend.novocinemas.com`; CORS blocks cross-origin probes and `/api/movies` 404s.
- Assets come from `imagenovo.novocinemas.com`.
- Next step: load the site in a visible browser so it composites and hydrates, then read the movie ids off the rendered cards.

**Roxy** (`theroxycinemas.com`) — not investigated. Returns 403 to plain HTTP clients.

## Ground rules

- Never invent a URL. A fabricated link that 404s is worse than the honest cinema-page fallback the UI already handles.
- Verify a harvested URL resolves before committing it to seed data.
- Scrape politely: cache, rate-limit, and identify the client. These sites already push back on automation.
- Titles drift between chains (`Khali Balak Min Nafsik` is `khali-balak-min-nafsik-arabic` on both VOX and Reel, but that won't hold generally) — match on a normalized title plus year, not the slug.
