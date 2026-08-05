const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { cinemas, movies, showtimes } = require('./data/seed');

const PORT = process.env.PORT || 3000;

const cinemaById = new Map(cinemas.map(c => [c.id, c]));
const movieById = new Map(movies.map(m => [m.id, m]));

const normalize = s => (s || '').toLowerCase().trim();

const matchers = {
  movie: (q, { movie }) => normalize(movie.title).includes(q),
  cinema: (q, { cinema }) =>
    normalize(cinema.name).includes(q) || normalize(cinema.brand).includes(q),
  location: (q, { cinema }) =>
    normalize(cinema.city).includes(q) || normalize(cinema.area).includes(q),
};

// A seed time is either a bare 'HH:MM' or { time, bookingUrl }.
//
// Best link we can offer, in order:
//   'session' — the exact screening (only if live data ever supplies one)
//   'movie'   — the film's page on that chain's site, showtimes listed
//   'cinema'  — the chain's home page, last resort
//
// No UAE chain currently exposes a per-screening URL: VOX advances through
// seat selection without ever changing the address bar, so 'session' stays
// unreachable until a partner feed provides real booking links.
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

function search({ mode, query }) {
  const q = normalize(query);
  const matches = matchers[mode] || matchers.movie;
  const grouped = new Map();

  for (const st of showtimes) {
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

  return [...grouped.values()].sort((a, b) =>
    b.screenings.length - a.screenings.length || a.movie.title.localeCompare(b.movie.title)
  );
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.join(__dirname, rel);

  // Keep requests inside the project directory.
  if (!filePath.startsWith(__dirname + path.sep) && filePath !== path.join(__dirname, 'index.html')) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/search') {
    const raw = url.searchParams.get('mode');
    const mode = ['movie', 'cinema', 'location'].includes(raw) ? raw : 'movie';
    const query = url.searchParams.get('q') || '';
    const results = search({ mode, query });
    sendJson(res, 200, { mode, query, resultCount: results.length, results });
    return;
  }

  if (url.pathname === '/api/cinemas') {
    sendJson(res, 200, { cinemas });
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`ShowSouk running at http://localhost:${PORT}`);
});
