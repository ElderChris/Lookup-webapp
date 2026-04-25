/* =======================================================================
   LIBRERIA DIFFUSA — Logica applicativa e dati mock
   ----------------------------------------------------
   Questo file gestisce il layer dati del prototipo: in produzione tutti
   questi dati provengono da un backend REST (Node.js + Express +
   PostgreSQL/PostGIS). Nel prototipo usiamo localStorage per la
   persistenza lato browser e un set di dati di esempio già popolato.
   ======================================================================= */

/* -----------------------------------------------------------------
   1. DATI DI ESEMPIO (in produzione → SELECT da DB)
   ----------------------------------------------------------------- */

const SAMPLE_USERS = [
  { id: 1, username: 'chiara.morandi', display_name: 'Chiara Morandi',
    email: 'c.morandi@mail.it', city: 'Napoli, Chiaia',
    lat: 40.8358, lng: 14.2351, bio: 'Appassionata di letteratura italiana del Novecento e di saggistica filosofica.',
    joined: '2024-03-12', public_profile: true },
  { id: 2, username: 'marco.devito', display_name: 'Marco De Vito',
    email: 'm.devito@mail.it', city: 'Napoli, Vomero',
    lat: 40.8488, lng: 14.2295, bio: 'Collezionista di gialli e noir, con particolare attenzione agli autori scandinavi.',
    joined: '2024-01-22', public_profile: true },
  { id: 3, username: 'anna.russo', display_name: 'Anna Russo',
    email: 'a.russo@mail.it', city: 'Napoli, Posillipo',
    lat: 40.8145, lng: 14.2055, bio: 'Biblioteca di famiglia con edizioni ottocentesche di classici.',
    joined: '2023-11-05', public_profile: true },
  { id: 4, username: 'luca.esposito', display_name: 'Luca Esposito',
    email: 'l.esposito@mail.it', city: 'Napoli, Centro Storico',
    lat: 40.8518, lng: 14.2681, bio: 'Saggi di storia locale e tradizioni campane.',
    joined: '2024-05-08', public_profile: true },
  { id: 5, username: 'giulia.ferrari', display_name: 'Giulia Ferrari',
    email: 'g.ferrari@mail.it', city: 'Portici',
    lat: 40.8147, lng: 14.3417, bio: 'Poesia contemporanea italiana e traduzioni dal tedesco.',
    joined: '2024-02-18', public_profile: true },
  { id: 6, username: 'roberto.mazzone', display_name: 'Roberto Mazzone',
    email: 'r.mazzone@mail.it', city: 'Pozzuoli',
    lat: 40.8240, lng: 14.1204, bio: 'Fantascienza classica e distopie.',
    joined: '2024-04-01', public_profile: true }
];

const SAMPLE_CATEGORIES = [
  'Narrativa contemporanea', 'Classici', 'Poesia', 'Saggistica',
  'Storia', 'Filosofia', 'Gialli e noir', 'Fantascienza',
  'Biografie', 'Arte', 'Teatro', 'Letteratura per ragazzi'
];

const SAMPLE_BOOKS = [
  { id: 1, title: 'Se questo è un uomo', author: 'Primo Levi', year: 1947,
    category: 'Classici', owner_id: 1, isbn: '9788806217778',
    description: 'Testimonianza della prigionia di Primo Levi ad Auschwitz. Una delle opere fondamentali della letteratura del Novecento italiano.',
    language: 'Italiano', pages: 216, condition: 'buone condizioni',
    views: 342, loan_requests: 12, available: true,
    cover_gradient: 'linear-gradient(135deg, #7a1e2b, #3d342e)',
    added: '2024-03-15' },
  { id: 2, title: 'Le città invisibili', author: 'Italo Calvino', year: 1972,
    category: 'Narrativa contemporanea', owner_id: 1, isbn: '9788804668237',
    description: 'Dialogo immaginario tra Marco Polo e Kublai Khan sulle città visitate dal mercante veneziano, metafore delle città della memoria, del desiderio, dei segni.',
    language: 'Italiano', pages: 173, condition: 'ottime condizioni',
    views: 278, loan_requests: 8, available: true,
    cover_gradient: 'linear-gradient(135deg, #b08840, #6e7a5a)',
    added: '2024-03-20' },
  { id: 3, title: 'Uomini che odiano le donne', author: 'Stieg Larsson', year: 2005,
    category: 'Gialli e noir', owner_id: 2, isbn: '9788831714082',
    description: 'Primo capitolo della trilogia Millennium. Un giornalista investigativo e una hacker indagano su un caso di scomparsa irrisolto da quarant\'anni.',
    language: 'Italiano', pages: 678, condition: 'buone condizioni',
    views: 189, loan_requests: 5, available: true,
    cover_gradient: 'linear-gradient(135deg, #1a1512, #7a1e2b)',
    added: '2024-02-10' },
  { id: 4, title: 'Il nome della rosa', author: 'Umberto Eco', year: 1980,
    category: 'Classici', owner_id: 3, isbn: '9788845292613',
    description: 'Romanzo storico ambientato in un\'abbazia benedettina del XIV secolo. Un maestro francescano indaga su una serie di morti misteriose.',
    language: 'Italiano', pages: 512, condition: 'eccellenti (edizione del 1980)',
    views: 456, loan_requests: 18, available: false,
    cover_gradient: 'linear-gradient(135deg, #5a141f, #b08840)',
    added: '2024-01-08' },
  { id: 5, title: 'Canti', author: 'Giacomo Leopardi', year: 1835,
    category: 'Poesia', owner_id: 3, isbn: '9788807900587',
    description: 'Raccolta completa dei componimenti poetici di Leopardi. Edizione ottocentesca con note critiche originali.',
    language: 'Italiano', pages: 280, condition: 'da collezione, 1867',
    views: 512, loan_requests: 3, available: true,
    cover_gradient: 'linear-gradient(135deg, #3d342e, #b08840)',
    added: '2023-12-15' },
  { id: 6, title: 'Storia di Napoli', author: 'Benedetto Croce', year: 1925,
    category: 'Storia', owner_id: 4, isbn: '9788843057047',
    description: 'Opera monumentale di Croce sulla storia della città di Napoli dall\'antichità fino al Risorgimento.',
    language: 'Italiano', pages: 720, condition: 'buone condizioni',
    views: 298, loan_requests: 9, available: true,
    cover_gradient: 'linear-gradient(135deg, #6e7a5a, #3d342e)',
    added: '2024-05-12' },
  { id: 7, title: 'La coscienza di Zeno', author: 'Italo Svevo', year: 1923,
    category: 'Classici', owner_id: 5, isbn: '9788858410356',
    description: 'Memoriale autobiografico di Zeno Cosini, scritto per il suo psicoanalista. Capolavoro del romanzo italiano del Novecento.',
    language: 'Italiano', pages: 480, condition: 'ottime condizioni',
    views: 234, loan_requests: 6, available: true,
    cover_gradient: 'linear-gradient(135deg, #7a1e2b, #b08840)',
    added: '2024-02-22' },
  { id: 8, title: 'Dune', author: 'Frank Herbert', year: 1965,
    category: 'Fantascienza', owner_id: 6, isbn: '9788834727607',
    description: 'Epopea fantascientifica ambientata sul pianeta desertico Arrakis. Considerato uno dei capolavori assoluti della SF.',
    language: 'Italiano', pages: 820, condition: 'buone condizioni',
    views: 412, loan_requests: 15, available: true,
    cover_gradient: 'linear-gradient(135deg, #b08840, #5a141f)',
    added: '2024-04-05' },
  { id: 9, title: 'L\'amica geniale', author: 'Elena Ferrante', year: 2011,
    category: 'Narrativa contemporanea', owner_id: 5, isbn: '9788866324119',
    description: 'Primo volume della quadrilogia napoletana. L\'amicizia tra Lila ed Elena in un rione di Napoli degli anni \'50.',
    language: 'Italiano', pages: 400, condition: 'come nuovo',
    views: 389, loan_requests: 22, available: true,
    cover_gradient: 'linear-gradient(135deg, #7a1e2b, #6e7a5a)',
    added: '2024-03-28' },
  { id: 10, title: 'Il sistema periodico', author: 'Primo Levi', year: 1975,
    category: 'Saggistica', owner_id: 1, isbn: '9788806174149',
    description: 'Autobiografia strutturata sugli elementi chimici. Un dialogo tra la vita e la scienza.',
    language: 'Italiano', pages: 240, condition: 'ottime condizioni',
    views: 156, loan_requests: 4, available: true,
    cover_gradient: 'linear-gradient(135deg, #3d342e, #7a1e2b)',
    added: '2024-04-18' },
  { id: 11, title: 'Gomorra', author: 'Roberto Saviano', year: 2006,
    category: 'Saggistica', owner_id: 4, isbn: '9788804627005',
    description: 'Inchiesta sulla camorra campana. Un viaggio nelle dinamiche del potere criminale contemporaneo.',
    language: 'Italiano', pages: 331, condition: 'buone condizioni',
    views: 267, loan_requests: 7, available: true,
    cover_gradient: 'linear-gradient(135deg, #1a1512, #5a141f)',
    added: '2024-05-20' },
  { id: 12, title: 'Neuromante', author: 'William Gibson', year: 1984,
    category: 'Fantascienza', owner_id: 6, isbn: '9788834715567',
    description: 'Romanzo seminale del cyberpunk. La storia di Case, hacker-mercenario, in un futuro distopico dominato dalle corporazioni.',
    language: 'Italiano', pages: 288, condition: 'discrete',
    views: 178, loan_requests: 5, available: true,
    cover_gradient: 'linear-gradient(135deg, #6e7a5a, #1a1512)',
    added: '2024-05-28' }
];

/* -----------------------------------------------------------------
   2. STORAGE — persistenza in localStorage
   ----------------------------------------------------------------- */

const Storage = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  init() {
    // Popolamento iniziale se non presente
    if (!this.get('users')) this.set('users', SAMPLE_USERS);
    if (!this.get('books')) this.set('books', SAMPLE_BOOKS);
    if (!this.get('categories')) this.set('categories', SAMPLE_CATEGORIES);
    if (!this.get('loan_requests')) this.set('loan_requests', []);
  },
  reset() {
    localStorage.clear();
    this.init();
  }
};

/* -----------------------------------------------------------------
   3. API LOCALE — simula un backend REST
   ----------------------------------------------------------------- */

const API = {

  // --- Utenti ---------------------------------------------------
  getUsers() { return Storage.get('users', []); },
  getUser(id) { return this.getUsers().find(u => u.id === +id); },

  // --- Libri ----------------------------------------------------
  getBooks() { return Storage.get('books', []); },
  getBook(id) { return this.getBooks().find(b => b.id === +id); },
  getBooksByOwner(owner_id) {
    return this.getBooks().filter(b => b.owner_id === +owner_id);
  },

  // --- Ricerca testuale ----------------------------------------
  searchBooks(query, filters = {}) {
    let results = this.getBooks();
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q)
      );
    }
    if (filters.category) results = results.filter(b => b.category === filters.category);
    if (filters.available !== undefined) results = results.filter(b => b.available === filters.available);
    return results;
  },

  // --- Ricerca spaziale (formula di Haversine) -----------------
  searchBooksNearby(lat, lng, radiusKm = 5) {
    const users = this.getUsers();
    const books = this.getBooks();
    return books
      .map(book => {
        const owner = users.find(u => u.id === book.owner_id);
        if (!owner) return null;
        const distance = this.haversineDistance(lat, lng, owner.lat, owner.lng);
        return { ...book, owner, distance };
      })
      .filter(b => b && b.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  },

  haversineDistance(lat1, lng1, lat2, lng2) {
    // Formula standard per calcolare la distanza "in linea d'aria" tra
    // due punti geografici, restituita in km. (R ≈ raggio medio Terra)
    const R = 6371;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  // --- Categorie -----------------------------------------------
  getCategories() { return Storage.get('categories', []); },

  // --- Aggiunta nuovo libro ------------------------------------
  addBook(bookData) {
    const books = this.getBooks();
    const newBook = {
      id: Math.max(...books.map(b => b.id), 0) + 1,
      ...bookData,
      views: 0, loan_requests: 0, available: true,
      added: new Date().toISOString().slice(0, 10),
      cover_gradient: this.randomGradient()
    };
    books.push(newBook);
    Storage.set('books', books);
    return newBook;
  },

  randomGradient() {
    const colors = ['#7a1e2b', '#5a141f', '#b08840', '#6e7a5a', '#3d342e', '#1a1512'];
    const a = colors[Math.floor(Math.random() * colors.length)];
    let b = colors[Math.floor(Math.random() * colors.length)];
    while (b === a) b = colors[Math.floor(Math.random() * colors.length)];
    return `linear-gradient(135deg, ${a}, ${b})`;
  },

  // --- Incrementa visualizzazione -------------------------------
  incrementViews(bookId) {
    const books = this.getBooks();
    const book = books.find(b => b.id === +bookId);
    if (book) { book.views++; Storage.set('books', books); }
  },

  // --- Richiesta prestito (simulata) ---------------------------
  requestLoan(bookId, requesterId) {
    const requests = Storage.get('loan_requests', []);
    requests.push({
      id: requests.length + 1,
      book_id: bookId,
      requester_id: requesterId,
      status: 'pending',
      date: new Date().toISOString()
    });
    Storage.set('loan_requests', requests);

    // Incrementa contatore sul libro
    const books = this.getBooks();
    const book = books.find(b => b.id === +bookId);
    if (book) { book.loan_requests++; Storage.set('books', books); }
  },

  // --- Statistiche generali ------------------------------------
  getGlobalStats() {
    const books = this.getBooks();
    const users = this.getUsers();
    return {
      total_books: books.length,
      total_users: users.length,
      total_views: books.reduce((s, b) => s + b.views, 0),
      total_loan_requests: books.reduce((s, b) => s + b.loan_requests, 0),
      available_books: books.filter(b => b.available).length,
      categories_count: [...new Set(books.map(b => b.category))].length,
      top_books: [...books].sort((a,b) => b.views - a.views).slice(0, 5),
      top_categories: this.topCategories(books)
    };
  },

  topCategories(books) {
    const counts = {};
    books.forEach(b => counts[b.category] = (counts[b.category] || 0) + 1);
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
};

/* -----------------------------------------------------------------
   4. UTILITY DI RENDERING E UI
   ----------------------------------------------------------------- */

const UI = {

  /** Render scheda libro */
  renderBookCard(book, user) {
    const owner = user || API.getUser(book.owner_id);
    const coverStyle = `style="background: ${book.cover_gradient};"`;
    return `
      <a href="book-detail.html?id=${book.id}" class="book-card">
        <div class="book-card__cover book-card__cover--placeholder" ${coverStyle}>
          ${book.title}
        </div>
        <span class="book-card__category">${book.category}</span>
        <h3 class="book-card__title">${book.title}</h3>
        <p class="book-card__author">${book.author}, ${book.year}</p>
        <div class="book-card__meta">
          <span>${owner ? owner.city : ''}</span>
          <span>${book.available ? 'Disponibile' : 'In prestito'}</span>
        </div>
      </a>`;
  },

  /** Render griglia libri */
  renderBooksGrid(container, books) {
    if (!books.length) {
      container.innerHTML = `<p class="alert alert--info">Nessun libro trovato con i filtri correnti.</p>`;
      return;
    }
    container.innerHTML = books.map(b => this.renderBookCard(b)).join('');
    container.classList.add('stagger');
  },

  /** Gestione navigazione mobile */
  initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen);
      });
    }
  },

  /** Evidenzia voce di menu attiva */
  highlightActiveNav() {
    const current = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.site-nav a').forEach(link => {
      if (link.getAttribute('href') === current) link.classList.add('active');
    });
  },

  /** Notifiche toast */
  toast(message, type = 'info') {
    const t = document.createElement('div');
    t.className = `alert alert--${type}`;
    t.setAttribute('role', 'status');
    t.textContent = message;
    t.style.cssText = 'position:fixed;top:5rem;right:1.5rem;z-index:1000;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.15);';
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity = '0', 3000);
    setTimeout(() => t.remove(), 3500);
  }
};

/* -----------------------------------------------------------------
   5. INIZIALIZZAZIONE GLOBALE
   ----------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  Storage.init();
  UI.initMobileNav();
  UI.highlightActiveNav();
});

/* Esposizione globale per uso in altri script */
window.API = API;
window.UI = UI;
window.Storage = Storage;
