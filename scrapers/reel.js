// Reel Cinemas — reelcinemas.com  (reelcinemas.ae redirects here)
//
// Reel is the chain that works: verified headless, no bot blocking, and its
// robots.txt explicitly allows exactly what we read.
//
//   User-agent: *  Allow: /   Allow: /en-ae/
//   Disallow: /user/  /tickets/seat-selection  /tickets/payment
//             /tickets/ticket-order  /tickets/fnbconsessionlist  /tickets/offers
//
// So the booking funnel is off-limits and the movie pages are not. We read only
// /en-ae/ movie pages — the same thing any visitor sees.
//
// How it works:
//   1. The homepage lists every now-showing film as a plain anchor:
//        /en-ae/movie-details/<catalogueId>/<slug>
//      The catalogue id (e.g. HO00005307) is stable, so links survive retitling.
//   2. Each movie page renders its showtimes grouped venue → experience → times.
//
// The site is a client-rendered Vite/React SPA: a plain fetch returns a ~3KB
// shell, so this needs a real browser. Content hydrates late — homepage links
// ~12s, movie showtimes ~14s — hence the polling waits rather than fixed sleeps.
//
// There is also a Vista JSON API (apiuae.reelcinemas.com/vista/json/*.json) that
// would be far nicer, but it returns 401 without an app-issued key. We do not
// lift that key: it would circumvent an access control, and it is the natural
// thing to request if a partnership happens.
//
// Per-session booking links are not available — clicking a showtime redirects to
// /en-ae/user/signin — so showtimes stay plain 'HH:MM' and the UI falls back to
// the movie page link.

const BRAND = 'Reel Cinemas';
const HOME_URL = 'https://reelcinemas.com/en-ae/';
const ORIGIN = 'https://reelcinemas.com';

// Reel's venues are few and stable; the page shows only a short label
// ("Dubai Mall"), so this supplies the full name and location.
const VENUES = {
  'dubai mall':        { name: 'Reel The Dubai Mall',     area: 'Downtown Dubai', city: 'Dubai' },
  'marina mall':       { name: 'Reel Dubai Marina Mall',  area: 'Dubai Marina',   city: 'Dubai' },
  'dubai marina mall': { name: 'Reel Dubai Marina Mall',  area: 'Dubai Marina',   city: 'Dubai' },
  'the springs souk':  { name: 'Reel The Springs Souk',   area: 'The Springs',    city: 'Dubai' },
  'springs souk':      { name: 'Reel The Springs Souk',   area: 'The Springs',    city: 'Dubai' },
  'the beach':         { name: 'Reel The Beach JBR',      area: 'JBR',            city: 'Dubai' },
  'jbr':               { name: 'Reel The Beach JBR',      area: 'JBR',            city: 'Dubai' },
  'al ghurair':        { name: 'Reel Al Ghurair Centre',  area: 'Deira',          city: 'Dubai' },
};

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "03:45pm" → "15:45". Reel prints local UAE time, so this is a pure 12→24h
// conversion; no timezone maths (that would shift the whole schedule).
function to24h(label) {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(label || '').trim());
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

// The page label is short ("Dubai Mall"); map it to a full venue record, and
// still produce something sane for a venue we haven't seen before.
function resolveVenue(label) {
  const key = String(label || '').toLowerCase().trim();
  const known = VENUES[key] || VENUES[key.replace(/^the\s+/, '')];
  if (known) return { id: `reel-${slug(known.name)}`, ...known };
  const name = /^reel/i.test(label) ? label : `Reel ${label}`.trim();
  return { id: `reel-${slug(name)}`, name, area: '', city: '' };
}

const movieUrl = (catalogueId, movieSlug) =>
  `${ORIGIN}/en-ae/movie-details/${catalogueId}/${movieSlug}`;

// --- Pure transform: scraped page data → the catalogue shape the app reads. ---
// No browser, no network — unit-tested in reel.transform.test.js.
//
// pages: [{ catalogueId, slug, title, venues: [{ venue, experiences:
//           [{ experience, times: [{label, soldOut}] }] }] }]
function transform(pages) {
  const movies = [];
  const cinemas = new Map();
  const showtimes = [];

  for (const page of pages) {
    if (!page || !page.catalogueId || !page.slug) continue;

    const movieId = page.slug;
    const url = movieUrl(page.catalogueId, page.slug);
    movies.push({
      id: movieId,
      title: String(page.title || page.slug).replace(/\s+/g, ' ').trim(),
      genre: page.genre || '',
      rating: page.rating || '',
      language: page.language || '',
      runtime: page.runtime || null,
      links: { [BRAND]: url },
    });

    for (const v of page.venues || []) {
      const venue = resolveVenue(v.venue);
      if (!cinemas.has(venue.id)) {
        cinemas.set(venue.id, {
          id: venue.id,
          brand: BRAND,
          name: venue.name,
          area: venue.area,
          city: venue.city,
          bookingUrl: HOME_URL,
        });
      }

      for (const exp of v.experiences || []) {
        const times = (exp.times || []).map(t => to24h(t.label || t)).filter(Boolean);
        if (!times.length) continue;
        showtimes.push({
          movieId,
          cinemaId: venue.id,
          format: String(exp.experience || '').replace(/^Reel\s+/i, '').trim() || 'Standard',
          times,
        });
      }
    }
  }

  // A movie with no showtimes anywhere is noise in the UI — drop it and any
  // cinema that ended up with nothing to show.
  const withTimes = new Set(showtimes.map(s => s.movieId));
  const usedCinemas = new Set(showtimes.map(s => s.cinemaId));
  return {
    cinemas: [...cinemas.values()].filter(c => usedCinemas.has(c.id)),
    movies: movies.filter(m => withTimes.has(m.id)),
    showtimes,
  };
}

// --- Browser-driven scrape -----------------------------------------------------

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Reel hydrates late and the delay varies, so poll for the thing we need rather
// than sleeping a fixed guess. Returns null if it never appears.
async function pollFor(page, fn, { tries = 20, everyMs = 2000 } = {}) {
  for (let i = 0; i < tries; i++) {
    await sleep(everyMs);
    const value = await page.evaluate(fn);
    if (value && (!Array.isArray(value) || value.length)) return value;
  }
  return null;
}

// Runs in the page. Returns venues → experiences → times, or null if showtimes
// have not rendered yet. Structure: each venue is a `div.rounded-2xl`; inside,
// `div.mt-8 > div` sections are per-experience; time chips are <button>s.
function extractShowtimes() {
  const TIME = /^\d{1,2}:\d{2}(am|pm)$/i;
  const timeOf = b => b.textContent.trim().split('\n')[0];

  const venueEls = [...document.querySelectorAll('div.rounded-2xl')]
    .filter(v => [...v.querySelectorAll('button')].some(b => TIME.test(timeOf(b))));
  if (!venueEls.length) return null;

  return venueEls.map(v => {
    const experiences = [...v.querySelectorAll('div.mt-8 > div')].map(sec => {
      const btns = [...sec.querySelectorAll('button')].filter(b => TIME.test(timeOf(b)));
      if (!btns.length) return null;
      const full = sec.textContent.trim();
      const cut = full.search(/\d{1,2}:\d{2}(am|pm)/i);
      return {
        experience: (cut > 0 ? full.slice(0, cut) : '').trim(),
        times: btns.map(b => ({ label: timeOf(b), soldOut: /sold out/i.test(b.textContent) })),
      };
    }).filter(Boolean);

    // The venue heading is the text before the first digit or experience name.
    const label = (v.textContent.trim().split(/\d|Reel |MX4D|Dolby|ScreenX/)[0] || '').trim();
    return { venue: label, experiences };
  }).filter(v => v.experiences.length);
}

// Metadata printed on the movie page header, e.g. "2h 20m | PG13 | Arabic".
function extractMeta() {
  const text = document.body.innerText;
  const runtime = /(\d+)h\s*(\d+)?m/.exec(text);
  const rating = /\b(PG13|PG15|PG|15\+|18\+|18TC|G|E)\b/.exec(text);
  const h1 = document.querySelector('h1');
  return {
    title: h1 ? h1.textContent.trim() : null,
    runtime: runtime ? Number(runtime[1]) * 60 + Number(runtime[2] || 0) : null,
    rating: rating ? rating[1] : '',
  };
}

async function scrape({ limit = Number(process.env.REEL_LIMIT) || 0, politenessMs = 800, log = () => {} } = {}) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    throw new Error("playwright is required to scrape Reel — run 'npm install' (see package.json)");
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  try {
    const context = await browser.newContext({
      locale: 'en-AE',
      timezoneId: 'Asia/Dubai',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                 '(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    log('loading movie catalogue…');
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const hrefs = await pollFor(page, () =>
      [...new Set([...document.querySelectorAll('a[href*="movie-details"]')]
        .map(a => a.getAttribute('href')))]);
    if (!hrefs) throw new Error('no movie links found on the Reel homepage');

    // /en-ae/movie-details/<catalogueId>/<slug>
    const entries = [];
    for (const href of hrefs) {
      const m = /\/movie-details\/([^/]+)\/([^/?#]+)/.exec(href);
      if (m) entries.push({ catalogueId: m[1], slug: m[2], href });
    }
    const targets = limit ? entries.slice(0, limit) : entries;
    log(`  ${entries.length} movies${limit ? ` (scraping first ${targets.length})` : ''}`);

    const pages = [];
    let ok = 0, empty = 0, failed = 0;

    for (const entry of targets) {
      const url = movieUrl(entry.catalogueId, entry.slug);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const venues = await pollFor(page, extractShowtimes);
        const meta = await page.evaluate(extractMeta);

        if (!venues) {
          // Normal for a film with no sessions today, not an error.
          empty++;
          log(`  – ${entry.slug}: no showtimes`);
        } else {
          const count = venues.reduce((n, v) => n + v.experiences.reduce((k, e) => k + e.times.length, 0), 0);
          pages.push({ ...entry, ...meta, venues });
          ok++;
          log(`  ✓ ${entry.slug}: ${venues.length} venues, ${count} showtimes`);
        }
      } catch (e) {
        // One bad movie page must not sink the run.
        failed++;
        log(`  ! ${entry.slug}: ${e.message.split('\n')[0]}`);
      }
      await sleep(politenessMs);
    }

    log(`pages: ${ok} with showtimes, ${empty} empty, ${failed} failed`);
    const catalogue = transform(pages);
    log(`built: ${catalogue.movies.length} movies, ${catalogue.cinemas.length} cinemas, ${catalogue.showtimes.length} showtime groups`);
    return catalogue;
  } finally {
    await browser.close();
  }
}

module.exports = {
  brand: BRAND,
  homeUrl: HOME_URL,
  scrape,
  // exported for tests / reuse
  transform,
  to24h,
  resolveVenue,
  movieUrl,
  VENUES,
};
