// Novo Cinemas — uae.novocinemas.com
//
// No route in yet. Recorded so the next attempt doesn't repeat the dead ends.
//
// Tried, August 2026:
//  - Listing produced zero movie anchors; the SPA would not hydrate under
//    automation, so movie ids were never exposed.
//  - /moviePages and /showTime exist but 404 bare — they take parameters whose
//    shape is unknown. /moviePages/<slug>, /movies/<slug> and
//    /movieDetails/<slug> all render Novo's "Page Not Found".
//  - robots.txt allows all and points to https://novo.enpointe.io/sitemap.xml,
//    but that host's TLS certificate has expired, so it can't be read.
//  - Backend is backend.novocinemas.com; CORS blocks cross-origin probes and
//    /api/movies 404s. Images come from imagenovo.novocinemas.com.
//
// Next step: load the site in a *visible* browser so it composites and
// hydrates, then read movie ids off the rendered cards and infer the
// /moviePages parameter from a real navigation.

const BRAND = 'Novo Cinemas';
const HOME_URL = 'https://uae.novocinemas.com/';

async function scrape() {
  throw new Error(
    'novo scraper not implemented — movie ids not yet discoverable; see scrapers/README.md'
  );
}

module.exports = { brand: BRAND, homeUrl: HOME_URL, scrape };
