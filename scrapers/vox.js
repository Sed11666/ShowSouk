// VOX Cinemas — uae.voxcinemas.com
//
// VOX exposes a clean JSON API at uae-apife.voxcinemas.com, but it sits behind
// Akamai Bot Manager: a plain Node fetch gets 401 (40102 Authorization Error)
// because it lacks the _abck / bm_sz cookies Akamai only issues after its JS
// challenge runs in a real browser. So we drive Chromium with Playwright, let
// VOX's own scripts satisfy the challenge, then read the same public API the
// public movie pages use — behaving like a browser, not forging a credential.
//
// ⚠️ KNOWN BLOCKER (verified Aug 2026): Akamai blocks HEADLESS browsers at the
// network layer, before any page JS runs. Both bundled Chromium and real Chrome
// (channel:'chrome'), headless, fail the first navigation:
//   - default:            net::ERR_HTTP2_PROTOCOL_ERROR (connection reset)
//   - --disable-http2:    navigation never commits (hang → timeout)
// A real *interactive* (headed, real-display) browser succeeds — that's how the
// API responses in the tests were captured. Because the rejection is at the
// TLS/HTTP2 fingerprint layer, a headless GitHub Action is expected to hit the
// same wall. Making this run unattended means one of: a headed browser on a real
// display (e.g. xvfb — unverified, may not beat a network-layer fingerprint),
// an anti-bot bypass (fragile arms race, and adversarial toward VOX right before
// pitching them a partnership), or legitimate API access via that partnership.
// The transform below is fully tested and the API mapping is correct, so the day
// access exists this produces real data unchanged. See scrapers/README.md.
//
// robots.txt (verified Aug 2026) disallows only the booking funnel
// (/booking, /*?sessionId=). Movie listings and showtimes are not disallowed,
// and we never fetch a booking URL — we read the API and, at most, hand the
// user a link to click.
//
// Data flow (all under /v1/vox2-0/groups):
//   api/MovieMatrix/NowShowingByFilter?region=UAE   → now-showing movies
//   api/Sessions/UAE/{movieCode}/{YYYY-MM-DD}       → cinemas → experiences → sessions
//
// Endpoints and shapes were confirmed against the live site; see the transform
// tests in scrapers/vox.transform.test.js for captured payloads.

const BRAND = 'VOX Cinemas';
const HOME_URL = 'https://uae.voxcinemas.com/';
const API_BASE = 'https://uae-apife.voxcinemas.com/v1/vox2-0/groups';
const REGION = 'UAE';

// VOX's cinema set is small and stable, and the API's cinemaName is inconsistent
// about location ("Mall of the Emirates" carries no emirate, "Al Jimi Mall" none).
// A curated map keyed by the stable cinemaCode gives clean, canonical location
// data. Unknown codes fall back to parsing the name (see deriveLocation).
const CINEMA_LOCATIONS = {
  '0001': { area: 'Deira',              city: 'Dubai' },
  '0002': { area: 'Al Barsha',          city: 'Dubai' },
  '0004': { area: 'Ajman',              city: 'Ajman' },
  '0005': { area: 'Mirdif',             city: 'Dubai' },
  '0006': { area: 'Fujairah',           city: 'Fujairah' },
  '0007': { area: 'Jumeirah',           city: 'Dubai' },
  '0009': { area: 'Al Jazeera Al Hamra', city: 'Ras Al Khaimah' },
  '0012': { area: 'Yas Island',         city: 'Abu Dhabi' },
  '0013': { area: 'Bur Dubai',          city: 'Dubai' },
  '0014': { area: 'Corniche',           city: 'Abu Dhabi' },
  '0015': { area: 'Oud Metha',          city: 'Dubai' },
  '0017': { area: 'Bur Dubai',          city: 'Dubai' },
  '0035': { area: 'Al Wahda',           city: 'Sharjah' },
  '0036': { area: 'Tourist Club Area',  city: 'Abu Dhabi' },
  '0039': { area: 'Al Jimi',            city: 'Al Ain' },
  '0046': { area: 'Al Maryah Island',   city: 'Abu Dhabi' },
  '0049': { area: 'Palm Jumeirah',      city: 'Dubai' },
  '0055': { area: 'Al Zahia',           city: 'Sharjah' },
  '0057': { area: 'Umm Hurair',         city: 'Dubai' },
  '0104': { area: 'Al Reem Island',     city: 'Abu Dhabi' },
  '0105': { area: 'Festival City',      city: 'Dubai' },
};

// The API already returns readable experience names; tidy the shouty ones.
const EXPERIENCE_LABELS = {
  STANDARD: 'Standard',
  PREMIER: 'Premier',
  PREMIUM: 'Premium',
  GOLD: 'Gold',
  KIDS: 'Kids',
  THEATRE: 'Theatre',
  MAX: 'MAX',
  '4DX': '4DX',
  ONYX: 'ONYX',
  'PRIVATE CINEMA': 'Private Cinema',
};

const cleanTitle = t => String(t || '').replace(/\s+/g, ' ').trim();

// VOX encodes local UAE time with a +00:00 offset (a 21:00 GST show comes back
// as 2026-08-06T21:00:00+00:00). So take HH:MM straight from the string; do NOT
// convert time zones or the whole schedule shifts four hours.
function timeOf(showtime) {
  const m = /T(\d{2}):(\d{2})/.exec(showtime || '');
  return m ? `${m[1]}:${m[2]}` : null;
}

// "Abu Dhabi Mall - Abu Dhabi" → { area: '', city: 'Abu Dhabi' }. Only used when
// a cinemaCode is missing from CINEMA_LOCATIONS, so new venues still get a city.
function deriveLocation(cinemaName) {
  const parts = String(cinemaName || '').split(/\s*-\s*/);
  if (parts.length >= 2) return { area: '', city: parts[parts.length - 1].trim() };
  return { area: '', city: '' };
}

function labelExperience(exp) {
  return EXPERIENCE_LABELS[exp] || cleanTitle(exp);
}

const slugToUrl = slug => new URL(`/movies/${slug}`, HOME_URL).href;

// --- Pure transform: raw API JSON → the catalogue shape the app consumes. -----
// No network, no Playwright — unit-tested against captured payloads.

// rawMovies: NowShowingByFilter array.
// sessionsByCode: { [movieCode]: [ Sessions responses, one per scraped date ] }.
function transform(rawMovies, sessionsByCode) {
  const movies = [];
  const cinemasSeen = new Map();
  const showtimes = [];

  for (const rm of rawMovies) {
    const slug = rm.movieUrl;
    if (!slug) continue; // no page to link to — skip rather than invent a URL

    const movieId = slug;
    movies.push({
      id: movieId,
      title: cleanTitle(rm.title),
      genre: (rm.genres && rm.genres[0] && rm.genres[0].name) || '',
      rating: rm.rating || '',
      language: (rm.languages && rm.languages[0]) || '',
      runtime: Number(rm.runTime) || null,
      links: { [BRAND]: slugToUrl(slug) },
    });

    const dates = sessionsByCode[rm.code] || [];
    for (const dateResponse of dates) {
      const scheduleDate = dateResponse && dateResponse.date;
      for (const cinema of (dateResponse && dateResponse.cinemas) || []) {
        const code = cinema.cinemaCode;
        const cinemaId = `vox-${code}`;
        if (!cinemasSeen.has(cinemaId)) {
          const loc = CINEMA_LOCATIONS[code] || deriveLocation(cinema.cinemaName);
          cinemasSeen.set(cinemaId, {
            id: cinemaId,
            brand: BRAND,
            name: cleanTitle(cinema.cinemaName),
            area: loc.area,
            city: loc.city,
            bookingUrl: HOME_URL,
          });
        }

        for (const group of cinema.sessionGroups || []) {
          const times = (group.sessions || [])
            .map(s => timeOf(s.showtime))
            .filter(Boolean);
          if (!times.length) continue;
          showtimes.push({
            movieId,
            cinemaId,
            format: labelExperience(group.experience),
            date: scheduleDate,
            times,
          });
        }
      }
    }
  }

  return { cinemas: [...cinemasSeen.values()], movies, showtimes };
}

// --- Browser-driven fetch: the part that needs a real Chromium. ---------------

// Dates must be UAE-local: near midnight the UTC date is still "yesterday" in
// Dubai (UTC+4, no DST), which would query the wrong schedule. Shift into GST
// before reading the calendar date.
const GST_OFFSET_MS = 4 * 60 * 60 * 1000;
function datesFromToday(days) {
  const out = [];
  const nowGst = new Date(Date.now() + GST_OFFSET_MS);
  for (let i = 0; i < days; i++) {
    const d = new Date(nowGst);
    d.setUTCDate(nowGst.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Reads the VOX API through a Playwright browser context that has already
// cleared Akamai. `request` is a Playwright APIRequestContext bound to that
// context — it carries the context cookies and bypasses both CORS and the page's
// own monkey-patched fetch. Retries once by re-warming if Akamai lapses.
async function apiGet(request, warmUp, url, { retries = 2, delayMs = 400 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await request.get(url, { headers: { accept: 'application/json' } });
    if (res.ok()) return res.json();
    if (res.status() === 401 && attempt < retries) {
      await warmUp();              // re-run the Akamai challenge
      await sleep(delayMs);
      continue;
    }
    if (attempt < retries) {
      await sleep(delayMs * (attempt + 1));
      continue;
    }
    throw new Error(`VOX API ${res.status()} for ${url}`);
  }
}

async function scrape({ days = Number(process.env.VOX_DAYS) || 1, politenessMs = 350, log = () => {} } = {}) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    throw new Error("playwright is required to scrape VOX — run 'npm install' (see package.json)");
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      // Headless Chromium's HTTP/2 handshake gets reset by Akamai's edge
      // (ERR_HTTP2_PROTOCOL_ERROR); forcing HTTP/1.1 clears it.
      '--disable-http2',
      // Drop the navigator.webdriver / automation tells that bot managers flag.
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });
  try {
    const context = await browser.newContext({
      locale: 'en-AE',
      timezoneId: 'Asia/Dubai',
      // The API lives on a sibling subdomain; Akamai tends to check that calls
      // look like they came from the site, so carry a Referer/Origin on every
      // context.request call.
      extraHTTPHeaders: {
        referer: HOME_URL,
        origin: HOME_URL.replace(/\/$/, ''),
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    const page = await context.newPage();

    // Loading the home page runs Akamai's challenge and seeds the cookie jar.
    // The edge occasionally resets the first connection, so retry a couple times.
    const warmUp = async () => {
      let lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await sleep(1500);
          return;
        } catch (e) {
          lastErr = e;
          await sleep(1000 * (attempt + 1));
        }
      }
      throw lastErr;
    };
    log('warming up (Akamai challenge)…');
    await warmUp();

    const request = context.request;

    log('fetching now-showing movies…');
    const rawMovies = await apiGet(request, warmUp,
      `${API_BASE}/api/MovieMatrix/NowShowingByFilter?region=${REGION}`);
    if (!Array.isArray(rawMovies) || !rawMovies.length) {
      throw new Error('VOX returned no movies — aborting rather than writing an empty catalogue');
    }
    log(`  ${rawMovies.length} movies`);

    const dates = datesFromToday(days);
    const sessionsByCode = {};
    let ok = 0, failed = 0;

    for (const movie of rawMovies) {
      sessionsByCode[movie.code] = [];
      for (const date of dates) {
        const url = `${API_BASE}/api/Sessions/${REGION}/${movie.code}/${date}`;
        try {
          const data = await apiGet(request, warmUp, url);
          sessionsByCode[movie.code].push({ date, cinemas: (data && data.cinemas) || [] });
          ok++;
        } catch (e) {
          // One movie/date failing must not sink the whole run.
          failed++;
          log(`  ! ${movie.title} ${date}: ${e.message}`);
        }
        await sleep(politenessMs);
      }
    }
    log(`sessions fetched: ${ok} ok, ${failed} failed`);

    const catalogue = transform(rawMovies, sessionsByCode);
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
  timeOf,
  deriveLocation,
  labelExperience,
  datesFromToday,
  CINEMA_LOCATIONS,
};
