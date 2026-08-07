// Reel Cinemas — reelcinemas.com  (reelcinemas.ae redirects here)
//
// Movie page:  /en-ae/movie-details/<catalogueId>/<slug>
//              e.g. /en-ae/movie-details/HO00005307/spider-man-brand-new-day
// Locations:   /en-ae/locations/<slug>
//
// The best-structured of the three chains:
//  - Movie links are plain anchors on the homepage, so the catalogue can be
//    harvested without executing much JS.
//  - The catalogue id (HO00005307) is stable, so links survive title edits.
//    Prefer it over the slug as the chain-local movie key.
//  - Movie pages carry showtimes grouped by location and experience
//    (Platinum Suites / Premium / Dolby Cinema / ScreenX / Standard) and
//    include "Nearly Sold Out" flags worth surfacing later.
//
// Blocker, verified August 2026: booking is behind auth — clicking a showtime
// redirects to /en-ae/user/signin. No per-screening URL is publicly reachable,
// so showtimes stay plain 'HH:MM' and the UI falls back to the movie page.
//
// SPIKE FINDINGS, August 2026 — how to actually get the data:
//
//  robots.txt EXPLICITLY ALLOWS this. It Allow:s /en-ae/ (movie pages, times)
//  and only Disallow:s the booking funnel (/user/, /tickets/seat-selection,
//  /tickets/payment, /tickets/ticket-order). We read only the allowed pages.
//
//  Two data channels exist:
//   1. Vista JSON at apiuae.reelcinemas.com/vista/json/{Sessions,Films,
//      Cinemas,ScheduledFilms,Experience}.json — the clean, structured source.
//      But it returns 401 Unauthorized without an app-issued key. DO NOT lift
//      that key from their bundle: it circumvents an access control, and we are
//      about to ask this same chain (Emaar Entertainment) for a partnership.
//      If we want this channel, we ASK for it — it's the natural partnership deliverable.
//   2. The public movie page — the sanctioned path. It is a client-rendered
//      SPA (Vite/React, no SSR payload), so a plain fetch returns only a 3KB
//      shell. Showtimes need a headless browser (Playwright) and ~15s to render.
//
//  Once rendered, the DOM is clean and scrapable:
//   - Each venue is a `div.rounded-2xl` containing the cinema name.
//   - Inside, `div.mt-8 > div` sections are per-experience (Platinum Suites,
//     Premium, Dolby, ScreenX, MX4D, Standard).
//   - Time chips are <button>s matching /^\d{1,2}:\d{2}(am|pm)$/; a chip whose
//     text includes "Sold Out" is nearly sold out.
//   - Date tabs across the top select the day; times reflect the active date.
//  Verified against Spider-Man at Dubai Mall: 21 Platinum + 13 Premium etc.,
//  counts exact. The browser DOM extractor lives in the spike notes, not here.
//
//  So: implement with Playwright over the public page. Prefer the Vista JSON
//  only if a partnership grants a key.

const BRAND = 'Reel Cinemas';
const HOME_URL = 'https://reelcinemas.com/en-ae/';

function movieUrl(catalogueId, slug) {
  return new URL(`/en-ae/movie-details/${catalogueId}/${slug}`, HOME_URL).href;
}

async function scrape() {
  throw new Error(
    'reel scraper not implemented — anchors are harvestable, start here; see scrapers/README.md'
  );
}

module.exports = { brand: BRAND, homeUrl: HOME_URL, movieUrl, scrape };
