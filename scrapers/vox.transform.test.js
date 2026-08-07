// Tests the pure VOX transform against payloads captured from the live API on
// 2026-08-06, so the parsing logic is verified without launching a browser.
//
//   node scrapers/vox.transform.test.js
//
// Trimmed but shape-faithful to the real responses (see scrapers/vox.js header).

const assert = require('node:assert');
const { transform, timeOf, deriveLocation, labelExperience } = require('./vox');

const rawMovies = [
  {
    code: 'HO00015860', movieId: 'HO00013065', title: 'Spider-Man: Brand New Day',
    rating: 'PG13', languages: ['English'], runTime: '145', movieUrl: 'spider-man-brand-new-day',
    genres: [{ name: 'Action' }, { name: 'Adventure' }],
  },
  { // trailing space in title, single cinema, one experience
    code: 'HO00099999', movieId: 'HO00088888', title: 'El Gawahergy ',
    rating: 'PG15', languages: ['Arabic'], runTime: '120', movieUrl: 'el-gawahergy-arabic',
    genres: [{ name: 'Drama' }],
  },
  { // no movieUrl → must be skipped, not invented
    code: 'HO00000000', movieId: 'HO00000001', title: 'No Page Movie',
    rating: 'PG', languages: ['English'], runTime: '90', movieUrl: '', genres: [],
  },
];

const sessionsByCode = {
  HO00015860: [
    {
      date: '2026-08-06',
      cinemas: [
        {
          cinemaCode: '0002', cinemaName: 'Mall of the Emirates',
          sessionGroups: [
            { experience: 'PREMIER', sessions: [
              { sessionId: '1', showtime: '2026-08-06T21:00:00+00:00', status: '' },
              { sessionId: '2', showtime: '2026-08-07T00:05:00+00:00', status: 'Almost Full' },
            ] },
            { experience: 'STANDARD', sessions: [
              { sessionId: '3', showtime: '2026-08-06T18:30:00+00:00', status: '' },
            ] },
          ],
        },
        {
          cinemaCode: '0036', cinemaName: 'Abu Dhabi Mall - Abu Dhabi',
          sessionGroups: [
            { experience: 'MAX', sessions: [
              { sessionId: '4', showtime: '2026-08-06T20:00:00+00:00', status: '' },
            ] },
          ],
        },
        { // unknown code → deriveLocation from name; empty group → dropped
          cinemaCode: '9999', cinemaName: 'New Venue - Sharjah',
          sessionGroups: [
            { experience: 'STANDARD', sessions: [] },
            { experience: 'GOLD', sessions: [
              { sessionId: '5', showtime: '2026-08-06T15:15:00+00:00', status: '' },
            ] },
          ],
        },
      ],
    },
  ],
  HO00099999: [
    {
      date: '2026-08-06',
      cinemas: [
        {
          cinemaCode: '0035', cinemaName: 'City Centre Sharjah',
          sessionGroups: [
            { experience: 'STANDARD', sessions: [
              { sessionId: '6', showtime: '2026-08-06T19:30:00+00:00', status: '' },
            ] },
          ],
        },
      ],
    },
  ],
  HO00000000: [], // the skipped movie contributes nothing
};

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ✓', name); };

// --- helpers ---
check('timeOf reads local HH:MM without timezone conversion', () => {
  assert.equal(timeOf('2026-08-06T21:00:00+00:00'), '21:00');
  assert.equal(timeOf('2026-08-07T00:05:00+00:00'), '00:05');
  assert.equal(timeOf('garbage'), null);
});

check('deriveLocation splits a trailing emirate off the name', () => {
  assert.deepEqual(deriveLocation('New Venue - Sharjah'), { area: '', city: 'Sharjah' });
  assert.deepEqual(deriveLocation('Burjuman'), { area: '', city: '' });
});

check('labelExperience tidies shouty names, passes others through', () => {
  assert.equal(labelExperience('STANDARD'), 'Standard');
  assert.equal(labelExperience('MAX'), 'MAX');
  assert.equal(labelExperience('Couch - 2 Seater'), 'Couch - 2 Seater');
});

// --- transform ---
const cat = transform(rawMovies, sessionsByCode);

check('movie without a page URL is skipped', () => {
  assert.equal(cat.movies.length, 2);
  assert.ok(!cat.movies.find(m => m.id === ''));
});

check('movie fields map correctly, title trimmed, runtime numeric', () => {
  const spidey = cat.movies.find(m => m.id === 'spider-man-brand-new-day');
  assert.equal(spidey.title, 'Spider-Man: Brand New Day');
  assert.equal(spidey.genre, 'Action');
  assert.equal(spidey.language, 'English');
  assert.strictEqual(spidey.runtime, 145);
  assert.equal(cat.movies.find(m => m.id === 'el-gawahergy-arabic').title, 'El Gawahergy');
});

check('VOX movie link uses the real slug', () => {
  const spidey = cat.movies.find(m => m.id === 'spider-man-brand-new-day');
  assert.equal(spidey.links['VOX Cinemas'], 'https://uae.voxcinemas.com/movies/spider-man-brand-new-day');
});

check('curated location map wins; unknown code derives from name', () => {
  const moe = cat.cinemas.find(c => c.id === 'vox-0002');
  assert.deepEqual([moe.area, moe.city], ['Al Barsha', 'Dubai']);
  const derived = cat.cinemas.find(c => c.id === 'vox-9999');
  assert.deepEqual([derived.area, derived.city], ['', 'Sharjah']);
});

check('cinemas are de-duplicated across movies and groups', () => {
  const ids = cat.cinemas.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  // 0002, 0036, 9999 (from spidey) + 0035 (from el-gawahergy) = 4
  assert.equal(cat.cinemas.length, 4);
});

check('showtimes carry format + date and read times in order', () => {
  const premier = cat.showtimes.find(s => s.cinemaId === 'vox-0002' && s.format === 'Premier');
  assert.deepEqual(premier.times, ['21:00', '00:05']);
  assert.equal(premier.date, '2026-08-06');
  assert.equal(premier.movieId, 'spider-man-brand-new-day');
});

check('empty session groups produce no showtime entry', () => {
  const emptyStd = cat.showtimes.find(s => s.cinemaId === 'vox-9999' && s.format === 'Standard');
  assert.equal(emptyStd, undefined);
  assert.ok(cat.showtimes.find(s => s.cinemaId === 'vox-9999' && s.format === 'Gold'));
});

check('every showtime references a real movie and cinema', () => {
  const movieIds = new Set(cat.movies.map(m => m.id));
  const cinemaIds = new Set(cat.cinemas.map(c => c.id));
  for (const s of cat.showtimes) {
    assert.ok(movieIds.has(s.movieId), `orphan movie ${s.movieId}`);
    assert.ok(cinemaIds.has(s.cinemaId), `orphan cinema ${s.cinemaId}`);
  }
});

console.log(`\nvox transform: ${passed} checks passed`);
