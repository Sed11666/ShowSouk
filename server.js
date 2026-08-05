// Local dev server. The deployed site is static (GitHub Pages) and searches in
// the browser using the same search.js — this exists so /api/search can be
// exercised directly and for whenever the scrapers need a real backend.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { cinemas, movies, showtimes } = require('./data/seed');
const { search } = require('./search');

const PORT = process.env.PORT || 3000;
const catalogue = { cinemas, movies, showtimes };

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
    sendJson(res, 200, search(catalogue, {
      mode: url.searchParams.get('mode'),
      query: url.searchParams.get('q') || '',
    }));
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
