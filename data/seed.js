const cinemas = [
  { id: 'vox-moe',      brand: 'VOX Cinemas',  name: 'VOX Mall of the Emirates',   area: 'Al Barsha',       city: 'Dubai',          bookingUrl: 'https://uae.voxcinemas.com/' },
  { id: 'vox-citycent', brand: 'VOX Cinemas',  name: 'VOX City Centre Deira',      area: 'Deira',           city: 'Dubai',          bookingUrl: 'https://uae.voxcinemas.com/' },
  { id: 'vox-yas',      brand: 'VOX Cinemas',  name: 'VOX Yas Mall',               area: 'Yas Island',      city: 'Abu Dhabi',      bookingUrl: 'https://uae.voxcinemas.com/' },
  { id: 'vox-sharjah',  brand: 'VOX Cinemas',  name: 'VOX City Centre Sharjah',    area: 'Al Wahda',        city: 'Sharjah',        bookingUrl: 'https://uae.voxcinemas.com/' },
  { id: 'reel-dubai',   brand: 'Reel Cinemas', name: 'Reel The Dubai Mall',        area: 'Downtown Dubai',  city: 'Dubai',          bookingUrl: 'https://reelcinemas.com/en-ae/' },
  { id: 'reel-marina',  brand: 'Reel Cinemas', name: 'Reel Dubai Marina Mall',     area: 'Dubai Marina',    city: 'Dubai',          bookingUrl: 'https://reelcinemas.com/en-ae/' },
  { id: 'reel-jbr',     brand: 'Reel Cinemas', name: 'Reel The Beach JBR',         area: 'JBR',             city: 'Dubai',          bookingUrl: 'https://reelcinemas.com/en-ae/' },
  { id: 'novo-ibn',     brand: 'Novo Cinemas', name: 'Novo Ibn Battuta Mall',      area: 'Jebel Ali',       city: 'Dubai',          bookingUrl: 'https://uae.novocinemas.com/' },
  { id: 'novo-wtc',     brand: 'Novo Cinemas', name: 'Novo World Trade Centre',    area: 'Al Danah',        city: 'Abu Dhabi',      bookingUrl: 'https://uae.novocinemas.com/' },
  { id: 'novo-ajman',   brand: 'Novo Cinemas', name: 'Novo City Centre Ajman',     area: 'Al Owan',         city: 'Ajman',          bookingUrl: 'https://uae.novocinemas.com/' },
  { id: 'novo-rak',     brand: 'Novo Cinemas', name: 'Novo Al Hamra Mall',         area: 'Al Hamra',        city: 'Ras Al Khaimah', bookingUrl: 'https://uae.novocinemas.com/' },
  { id: 'roxy-citywalk',brand: 'Roxy Cinemas', name: 'Roxy City Walk',             area: 'Al Wasl',         city: 'Dubai',          bookingUrl: 'https://www.theroxycinemas.com/' },
  { id: 'roxy-boxpark', brand: 'Roxy Cinemas', name: 'Roxy Box Park',              area: 'Al Wasl',         city: 'Dubai',          bookingUrl: 'https://www.theroxycinemas.com/' },
];

// `links` maps a cinema brand to that chain's own page for the movie.
//
// These are the closest thing to a deep link the chains actually support: VOX's
// booking flow keeps the chosen screening in client-side state and never changes
// the URL, so no address exists for an individual showtime. Landing on the
// movie's page at the right chain is one click from the show.
//
// VOX URLs came from their live /movies/whatson listing; Reel URLs from the
// anchors on reelcinemas.com (note reelcinemas.ae redirects there). Reel embeds
// a stable catalogue id in the path, so those links survive title changes.
//
// Novo has no entry: their site is client-rendered behind an internal movie id
// that isn't exposed in any anchor, sitemap (its host's cert has expired), or
// public endpoint. Novo times fall back to the cinema home page.
//
// A movie with no entry for a brand falls back to that cinema's home page.
const movies = [
  { id: 'spiderman-bnd', title: 'Spider-Man: Brand New Day', genre: 'Action',    rating: 'PG13', language: 'English', runtime: 128, posterColor: '#0C447C',
    links: {
      'VOX Cinemas':  'https://uae.voxcinemas.com/movies/spider-man-brand-new-day',
      'Reel Cinemas': 'https://reelcinemas.com/en-ae/movie-details/HO00005307/spider-man-brand-new-day',
    } },
  { id: 'the-odyssey',   title: 'The Odyssey',               genre: 'Adventure', rating: '15+',  language: 'English', runtime: 156, posterColor: '#3C3489',
    links: {
      'VOX Cinemas':  'https://uae.voxcinemas.com/movies/the-odyssey',
      'Reel Cinemas': 'https://reelcinemas.com/en-ae/movie-details/HO00005178/the-odyssey',
    } },
  { id: 'moana',         title: 'Moana',                     genre: 'Animation', rating: 'PG',   language: 'English', runtime: 107, posterColor: '#993C1D',
    links: {
      'VOX Cinemas':  'https://uae.voxcinemas.com/movies/moana',
      'Reel Cinemas': 'https://reelcinemas.com/en-ae/movie-details/HO00005098/moana',
    } },
  { id: 'toy-story-5',   title: 'Toy Story 5',               genre: 'Animation', rating: 'PG',   language: 'English', runtime: 100, posterColor: '#0F6E56',
    links: {
      'VOX Cinemas':  'https://uae.voxcinemas.com/movies/toy-story-5',
      'Reel Cinemas': 'https://reelcinemas.com/en-ae/movie-details/HO00005092/toy-story-5',
    } },
  { id: 'khali-balak',   title: 'Khali Balak Min Nafsik',    genre: 'Comedy',    rating: 'PG15', language: 'Arabic',  runtime: 115, posterColor: '#72243E',
    links: {
      'VOX Cinemas':  'https://uae.voxcinemas.com/movies/khali-balak-min-nafsik-arabic',
      'Reel Cinemas': 'https://reelcinemas.com/en-ae/movie-details/HO00005604/khali-balak-min-nafsik-arabic',
    } },
  // In neither chain's current listing, so no verified page to link to.
  { id: 'dune-part3',    title: 'Dune: Part Three',          genre: 'Sci-Fi',    rating: '15+',  language: 'English', runtime: 165, posterColor: '#7A5B1E', links: {} },
];

// Each entry lists the times a movie plays at a cinema.
//
// A time may be either:
//   '18:15'                                  — no direct booking link known
//   { time: '18:15', bookingUrl: 'https://…' } — deep link to that exact session
//
// Cinema booking systems issue a session ID per screening, so a real deep link
// can only come from live data. Until the scraper/API lands, these are plain
// times and the UI falls back to the cinema's own page.
const showtimes = [
  { movieId: 'spiderman-bnd', cinemaId: 'vox-moe',       format: 'IMAX',     times: ['13:00', '16:00', '18:15', '21:45'] },
  { movieId: 'spiderman-bnd', cinemaId: 'reel-dubai',    format: 'Standard', times: ['14:30', '17:30', '20:30', '23:15'] },
  { movieId: 'spiderman-bnd', cinemaId: 'novo-wtc',      format: 'Standard', times: ['15:00', '18:00', '21:00'] },
  { movieId: 'spiderman-bnd', cinemaId: 'roxy-citywalk', format: 'Dine-in',  times: ['16:45', '19:45', '22:30'] },
  { movieId: 'spiderman-bnd', cinemaId: 'vox-sharjah',   format: 'Standard', times: ['14:00', '17:15', '20:45'] },

  { movieId: 'the-odyssey', cinemaId: 'vox-moe',      format: 'IMAX',     times: ['13:30', '17:00', '20:30'] },
  { movieId: 'the-odyssey', cinemaId: 'reel-marina',  format: 'Standard', times: ['15:15', '18:45', '22:00'] },
  { movieId: 'the-odyssey', cinemaId: 'novo-ibn',     format: 'Standard', times: ['16:00', '19:30'] },

  { movieId: 'moana', cinemaId: 'vox-citycent',  format: 'Standard', times: ['11:00', '13:30', '16:20', '19:10'] },
  { movieId: 'moana', cinemaId: 'reel-jbr',      format: 'Standard', times: ['12:15', '14:45', '17:30'] },
  { movieId: 'moana', cinemaId: 'novo-ajman',    format: 'Standard', times: ['11:45', '14:15', '16:50'] },
  { movieId: 'moana', cinemaId: 'vox-yas',       format: 'Standard', times: ['10:30', '13:00', '15:40', '18:20'] },

  { movieId: 'toy-story-5', cinemaId: 'vox-yas',      format: 'Standard', times: ['12:00', '15:00', '18:00'] },
  { movieId: 'toy-story-5', cinemaId: 'novo-rak',     format: 'Standard', times: ['13:15', '16:15', '19:00'] },
  { movieId: 'toy-story-5', cinemaId: 'roxy-boxpark', format: 'Standard', times: ['11:30', '14:30', '17:15'] },

  { movieId: 'khali-balak', cinemaId: 'novo-ajman',   format: 'Standard', times: ['19:30', '22:15'] },
  { movieId: 'khali-balak', cinemaId: 'vox-sharjah',  format: 'Standard', times: ['18:45', '21:30'] },

  { movieId: 'dune-part3', cinemaId: 'vox-moe',       format: 'IMAX',     times: ['14:00', '18:30', '22:00'] },
  { movieId: 'dune-part3', cinemaId: 'reel-dubai',    format: 'Standard', times: ['15:45', '19:15', '22:45'] },
  { movieId: 'dune-part3', cinemaId: 'novo-wtc',      format: 'Standard', times: ['16:30', '20:00'] },
  { movieId: 'dune-part3', cinemaId: 'roxy-citywalk', format: 'Dine-in',  times: ['17:00', '20:45'] },
];

module.exports = { cinemas, movies, showtimes };
