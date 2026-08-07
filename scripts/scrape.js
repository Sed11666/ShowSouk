// Production runner: scrape a chain, validate, write data/catalogue.json.
//
//   node scripts/scrape.js reel
//   node scripts/scrape.js vox        (currently blocked by Akamai — see scrapers/vox.js)
//   REEL_LIMIT=3 node scripts/scrape.js reel     # quick partial run while developing
//
// Exits non-zero on failure so a scheduled run surfaces the problem instead of
// publishing bad data. The catalogue is written ONLY on a validated result, so a
// failed run leaves the live site on its last good data.

const fs = require('node:fs');
const path = require('node:path');

const CHAINS = { reel: '../scrapers/reel', vox: '../scrapers/vox' };
const OUT = path.join(__dirname, '..', 'data', 'catalogue.json');

// Guards against a run that "succeeds" but returns junk. Overwriting good data
// with an empty catalogue is worse than failing loudly.
function validate(cat) {
  const problems = [];
  if (!cat.movies.length) problems.push('no movies');
  if (!cat.cinemas.length) problems.push('no cinemas');
  if (!cat.showtimes.length) problems.push('no showtimes');

  const times = cat.showtimes.reduce((n, s) => n + s.times.length, 0);
  if (times < 10) problems.push(`suspiciously few showtimes (${times})`);

  const movieIds = new Set(cat.movies.map(m => m.id));
  const cinemaIds = new Set(cat.cinemas.map(c => c.id));
  for (const s of cat.showtimes) {
    if (!movieIds.has(s.movieId)) problems.push(`showtime references missing movie ${s.movieId}`);
    if (!cinemaIds.has(s.cinemaId)) problems.push(`showtime references missing cinema ${s.cinemaId}`);
  }
  for (const s of cat.showtimes) {
    const bad = s.times.filter(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t));
    if (bad.length) problems.push(`malformed times on ${s.movieId}: ${bad.slice(0, 3).join(', ')}`);
  }
  return problems;
}

async function main() {
  const name = (process.argv[2] || 'reel').toLowerCase();
  if (!CHAINS[name]) {
    console.error(`unknown chain "${name}" — expected one of: ${Object.keys(CHAINS).join(', ')}`);
    process.exit(2);
  }

  const started = Date.now();
  console.log(`[scrape:${name}] starting ${new Date().toISOString()}`);

  const chain = require(CHAINS[name]);
  const cat = await chain.scrape({ log: m => console.log(`[${name}]`, m) });

  const problems = validate(cat);
  if (problems.length) {
    console.error(`[scrape:${name}] validation failed — not writing catalogue:\n  - ` + problems.join('\n  - '));
    process.exit(1);
  }

  const times = cat.showtimes.reduce((n, s) => n + s.times.length, 0);
  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: name,
    counts: {
      movies: cat.movies.length,
      cinemas: cat.cinemas.length,
      showtimeGroups: cat.showtimes.length,
      showtimes: times,
    },
    cinemas: cat.cinemas,
    movies: cat.movies,
    showtimes: cat.showtimes,
  }, null, 2) + '\n');

  console.log(
    `[scrape:${name}] wrote data/catalogue.json — ${cat.movies.length} movies, ` +
    `${cat.cinemas.length} cinemas, ${times} showtimes in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
}

main().catch(err => {
  console.error('[scrape] FAILED:', err.stack || err.message);
  process.exit(1);
});
