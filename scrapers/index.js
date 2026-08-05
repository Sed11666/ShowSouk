// Scraper registry and the helpers every chain module shares.
//
// Each module exports { brand, homeUrl, scrape() } where scrape() resolves to
// { cinemas, movies, showtimes } in the shape described in ./README.md.
//
// Nothing here is wired into the server yet — server.js still reads data/seed.js.
// Swapping over means merging each chain's output into one catalogue, which is
// what mergeAll below is for.

const vox = require('./vox');
const reel = require('./reel');
const novo = require('./novo');

const chains = { vox, reel, novo };

// Titles differ in punctuation and casing between chains, so match on this
// rather than on any chain's slug. Deliberately keeps digits: "Toy Story 5"
// and "Toy Story" are different films.
function normalizeTitle(title) {
  return String(title)
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Same film scraped from two chains must land on one movie id.
function movieKey(title, year) {
  const base = normalizeTitle(title).replace(/ /g, '-');
  return year ? `${base}-${year}` : base;
}

// Combines per-chain results into a single catalogue, folding duplicate movies
// together and collecting each chain's page for the movie into `links`.
function mergeAll(results) {
  const movies = new Map();
  const cinemas = [];
  const showtimes = [];

  for (const result of results) {
    const localToShared = new Map();

    for (const movie of result.movies) {
      const key = movieKey(movie.title, movie.year);
      if (!movies.has(key)) movies.set(key, { ...movie, id: key, links: {} });
      Object.assign(movies.get(key).links, movie.links || {});
      localToShared.set(movie.id, key);
    }

    cinemas.push(...result.cinemas);
    for (const st of result.showtimes) {
      showtimes.push({ ...st, movieId: localToShared.get(st.movieId) ?? st.movieId });
    }
  }

  return { cinemas, movies: [...movies.values()], showtimes };
}

async function scrapeAll(names = Object.keys(chains)) {
  const settled = await Promise.allSettled(names.map(n => chains[n].scrape()));

  const ok = [];
  for (const [i, outcome] of settled.entries()) {
    // One chain going down must not take the whole catalogue with it — the
    // others still have showtimes worth serving.
    if (outcome.status === 'fulfilled') ok.push(outcome.value);
    else console.error(`[scrapers] ${names[i]} failed:`, outcome.reason.message);
  }

  if (!ok.length) throw new Error('every scraper failed');
  return mergeAll(ok);
}

module.exports = { chains, scrapeAll, mergeAll, normalizeTitle, movieKey };
