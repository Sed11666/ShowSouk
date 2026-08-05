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
