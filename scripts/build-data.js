// Writes data/catalogue.json — the catalogue the static site fetches.
//
// GitHub Pages serves files, not Node, so the browser can't require the seed
// module. This flattens it to JSON at build time.
//
// Today the source is data/seed.js. Once the scrapers work, this is where
// scrapers/index.js scrapeAll() output goes instead, run on a schedule so the
// committed JSON stays fresh.
//
//   node scripts/build-data.js

const fs = require('node:fs');
const path = require('node:path');
const { cinemas, movies, showtimes } = require('../data/seed');

const OUT = path.join(__dirname, '..', 'data', 'catalogue.json');

const catalogue = {
  generatedAt: new Date().toISOString(),
  source: 'data/seed.js',
  cinemas,
  movies,
  showtimes,
};

fs.writeFileSync(OUT, JSON.stringify(catalogue, null, 2) + '\n');

const times = showtimes.reduce((n, s) => n + s.times.length, 0);
console.log(
  `wrote ${path.relative(path.join(__dirname, '..'), OUT)} — ` +
  `${movies.length} movies, ${cinemas.length} cinemas, ${times} showtimes`
);
