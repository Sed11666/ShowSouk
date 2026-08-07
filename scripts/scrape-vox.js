// Production runner: scrape VOX, validate, write data/catalogue.json.
//
//   node scripts/scrape-vox.js
//   VOX_DAYS=3 node scripts/scrape-vox.js
//
// Exits non-zero on failure so the GitHub Action surfaces a bad run instead of
// committing a broken or empty catalogue. Writes ONLY on a sane result — the
// live site keeps its last good data if a run fails.

const fs = require('node:fs');
const path = require('node:path');
const vox = require('../scrapers/vox');

const OUT = path.join(__dirname, '..', 'data', 'catalogue.json');

// Guards against a "successful" run that quietly returns junk — better to fail
// loudly and keep yesterday's good file than overwrite it with nothing.
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
  return problems;
}

async function main() {
  const started = Date.now();
  console.log(`[scrape-vox] starting ${new Date().toISOString()}`);

  const cat = await vox.scrape({ log: m => console.log('[vox]', m) });

  const problems = validate(cat);
  if (problems.length) {
    console.error('[scrape-vox] validation failed:\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }

  const times = cat.showtimes.reduce((n, s) => n + s.times.length, 0);
  const catalogue = {
    generatedAt: new Date().toISOString(),
    source: 'vox',
    counts: { movies: cat.movies.length, cinemas: cat.cinemas.length, showtimeGroups: cat.showtimes.length, showtimes: times },
    cinemas: cat.cinemas,
    movies: cat.movies,
    showtimes: cat.showtimes,
  };

  fs.writeFileSync(OUT, JSON.stringify(catalogue, null, 2) + '\n');
  console.log(
    `[scrape-vox] wrote ${path.relative(path.join(__dirname, '..'), OUT)} — ` +
    `${cat.movies.length} movies, ${cat.cinemas.length} cinemas, ${times} showtimes ` +
    `in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
}

main().catch(err => {
  console.error('[scrape-vox] FAILED:', err.stack || err.message);
  process.exit(1);
});
