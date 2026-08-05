// VOX Cinemas — uae.voxcinemas.com
//
// Listing:      /movies/whatson   (plain /movies 404s)
// Movie page:   /movies/<slug>    e.g. /movies/spider-man-brand-new-day
// Cinemas:      /cinemas
//
// Showtimes render into the movie page DOM, grouped by location then by
// experience (MAX / STANDARD / KIDS). Movie links on the listing are plain
// anchors, so the catalogue is harvestable from markup.
//
// Blockers, verified August 2026:
//  - Plain HTTP clients are blocked (curl/WebFetch 403 or time out). Needs a
//    real browser engine, not a bare fetch.
//  - No JSON API — /api/movies 404s and data moves over Next.js server actions.
//  - No per-screening URL exists: clicking a time advances to seat selection
//    while the address stays /movies/<slug>. Do not synthesise one.

const BRAND = 'VOX Cinemas';
const HOME_URL = 'https://uae.voxcinemas.com/';
const LISTING_URL = 'https://uae.voxcinemas.com/movies/whatson';

function movieUrl(slug) {
  return new URL(`/movies/${slug}`, HOME_URL).href;
}

async function scrape() {
  throw new Error(
    'vox scraper not implemented — needs a headless browser; see scrapers/README.md'
  );
}

module.exports = { brand: BRAND, homeUrl: HOME_URL, listingUrl: LISTING_URL, movieUrl, scrape };
