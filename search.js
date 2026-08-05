// Search over a catalogue of { cinemas, movies, showtimes }.
//
// Loaded two ways on purpose: server.js requires it, and the browser loads it
// with a <script> tag so the static GitHub Pages build can search without a
// backend. Keep it dependency-free and free of Node globals.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShowSoukSearch = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const normalize = s => (s || '').toLowerCase().trim();

  const matchers = {
    movie: (q, { movie }) => normalize(movie.title).includes(q),
    cinema: (q, { cinema }) =>
      normalize(cinema.name).includes(q) || normalize(cinema.brand).includes(q),
    location: (q, { cinema }) =>
      normalize(cinema.city).includes(q) || normalize(cinema.area).includes(q),
  };

  const MODES = Object.keys(matchers);

  // A showtime entry is either a bare 'HH:MM' or { time, bookingUrl }.
  //
  // Best link we can offer, in order:
  //   'session' — the exact screening (only if live data ever supplies one)
  //   'movie'   — the film's page on that chain's site, showtimes listed
  //   'cinema'  — the chain's home page, last resort
  //
  // No UAE chain currently exposes a per-screening URL: VOX advances through
  // seat selection without changing the address bar and Reel puts booking
  // behind a sign-in, so 'session' stays unreachable until a partner feed
  // provides real booking links.
  function toSession(entry, cinema, movie) {
    const { time, bookingUrl } = typeof entry === 'string' ? { time: entry } : entry;
    const moviePage = movie.links && movie.links[cinema.brand];

    const [url, linkLevel] = bookingUrl
      ? [bookingUrl, 'session']
      : moviePage
        ? [moviePage, 'movie']
        : [cinema.bookingUrl, 'cinema'];

    return { time, bookingUrl: url, linkLevel, direct: linkLevel === 'session' };
  }

  function search(catalogue, options) {
    const opts = options || {};
    const mode = MODES.includes(opts.mode) ? opts.mode : 'movie';
    const query = typeof opts.query === 'string' ? opts.query : '';

    const cinemaById = new Map(catalogue.cinemas.map(c => [c.id, c]));
    const movieById = new Map(catalogue.movies.map(m => [m.id, m]));

    const q = normalize(query);
    const matches = matchers[mode];
    const grouped = new Map();

    for (const st of catalogue.showtimes) {
      const movie = movieById.get(st.movieId);
      const cinema = cinemaById.get(st.cinemaId);
      if (!movie || !cinema) continue;
      if (q && !matches(q, { movie, cinema })) continue;

      if (!grouped.has(movie.id)) grouped.set(movie.id, { movie, screenings: [] });
      grouped.get(movie.id).screenings.push({
        cinema: {
          id: cinema.id,
          name: cinema.name,
          brand: cinema.brand,
          area: cinema.area,
          city: cinema.city,
          bookingUrl: cinema.bookingUrl,
        },
        format: st.format,
        sessions: st.times.map(t => toSession(t, cinema, movie)),
      });
    }

    const results = [...grouped.values()].sort((a, b) =>
      b.screenings.length - a.screenings.length || a.movie.title.localeCompare(b.movie.title)
    );

    return { mode, query, resultCount: results.length, results };
  }

  return { search, toSession, normalize, MODES };
});
