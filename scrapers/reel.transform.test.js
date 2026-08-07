// Tests the pure Reel transform against page data shaped exactly like what the
// browser extractor returns (captured from the live site, 2026-08-06).
//
//   node scrapers/reel.transform.test.js

const assert = require('node:assert');
const { transform, to24h, resolveVenue, movieUrl } = require('./reel');

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ✓', name); };

// --- helpers ---
check('to24h converts 12h labels, midnight and noon included', () => {
  assert.equal(to24h('03:45pm'), '15:45');
  assert.equal(to24h('11:00pm'), '23:00');
  assert.equal(to24h('12:00am'), '00:00');
  assert.equal(to24h('12:30pm'), '12:30');
  assert.equal(to24h('01:00am'), '01:00');
  assert.equal(to24h('nonsense'), null);
});

check('resolveVenue maps known labels to full name + location', () => {
  const dm = resolveVenue('Dubai Mall');
  assert.equal(dm.name, 'Reel The Dubai Mall');
  assert.equal(dm.city, 'Dubai');
  assert.equal(dm.id, 'reel-reel-the-dubai-mall');
});

check('resolveVenue degrades gracefully for an unknown venue', () => {
  const v = resolveVenue('Some New Mall');
  assert.equal(v.name, 'Reel Some New Mall');
  assert.equal(v.city, '');
  assert.ok(v.id.startsWith('reel-'));
});

check('movieUrl uses the stable catalogue id', () => {
  assert.equal(
    movieUrl('HO00005307', 'spider-man-brand-new-day'),
    'https://reelcinemas.com/en-ae/movie-details/HO00005307/spider-man-brand-new-day'
  );
});

// --- transform ---
const pages = [
  {
    catalogueId: 'HO00005307', slug: 'spider-man-brand-new-day',
    title: 'Spider-Man: Brand  New Day', rating: 'PG13', runtime: 140,
    venues: [
      {
        venue: 'Dubai Mall',
        experiences: [
          { experience: 'Reel Platinum Suites', times: [
            { label: '03:45pm', soldOut: false }, { label: '11:00pm', soldOut: true },
          ] },
          { experience: 'Reel Premium', times: [{ label: '12:00am', soldOut: false }] },
          { experience: 'Empty Screen', times: [] },   // dropped
        ],
      },
      {
        venue: 'Marina Mall',
        experiences: [
          { experience: 'Reel Standard', times: [{ label: '06:30pm', soldOut: false }] },
        ],
      },
    ],
  },
  { // film with no sessions anywhere → movie and its venue must not appear
    catalogueId: 'HO00009999', slug: 'no-sessions-movie', title: 'No Sessions',
    venues: [{ venue: 'The Springs Souk', experiences: [{ experience: 'Reel Standard', times: [] }] }],
  },
  { catalogueId: '', slug: '', title: 'Malformed', venues: [] },  // skipped outright
];

const cat = transform(pages);

check('malformed and showtime-less movies are dropped', () => {
  assert.equal(cat.movies.length, 1);
  assert.equal(cat.movies[0].id, 'spider-man-brand-new-day');
});

check('title whitespace is collapsed', () => {
  assert.equal(cat.movies[0].title, 'Spider-Man: Brand New Day');
});

check('movie links to its Reel page via catalogue id', () => {
  assert.equal(cat.movies[0].links['Reel Cinemas'],
    'https://reelcinemas.com/en-ae/movie-details/HO00005307/spider-man-brand-new-day');
});

check('times convert to 24h and keep page order', () => {
  const plat = cat.showtimes.find(s => s.format === 'Platinum Suites');
  assert.deepEqual(plat.times, ['15:45', '23:00']);
});

check('"Reel " prefix is stripped from the format label', () => {
  const formats = cat.showtimes.map(s => s.format).sort();
  assert.deepEqual(formats, ['Platinum Suites', 'Premium', 'Standard']);
});

check('empty experience produces no showtime row', () => {
  assert.ok(!cat.showtimes.find(s => s.format === 'Empty Screen'));
});

check('only cinemas that actually have showtimes are kept', () => {
  const ids = cat.cinemas.map(c => c.id).sort();
  assert.deepEqual(ids, ['reel-reel-dubai-marina-mall', 'reel-reel-the-dubai-mall']);
  assert.ok(!ids.includes('reel-reel-the-springs-souk'));
});

check('every showtime references a real movie and cinema', () => {
  const movieIds = new Set(cat.movies.map(m => m.id));
  const cinemaIds = new Set(cat.cinemas.map(c => c.id));
  for (const s of cat.showtimes) {
    assert.ok(movieIds.has(s.movieId), `orphan movie ${s.movieId}`);
    assert.ok(cinemaIds.has(s.cinemaId), `orphan cinema ${s.cinemaId}`);
  }
});

console.log(`\nreel transform: ${passed} checks passed`);
