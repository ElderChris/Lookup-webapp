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

/* Preferenze di personalizzazione del profilo per gli utenti di
   esempio — rispecchiano il seed SQL (sql/seed_data.sql). Servono a
   dare a ogni libreria una copertina generata distintiva, coerente
   con le scelte estetiche del suo curatore. */
const SAMPLE_PROFILE_PREFS = {
  1: { view_mode: 'grid',     theme: 'classic',  avatar_style: 'initials', avatar_symbol: '§',
       motto: 'Un libro è un sogno che tieni in mano',          sort_by: 'recent', privacy_level: 2, show_email: false },
  2: { view_mode: 'shelf',    theme: 'midnight', avatar_style: 'symbol',   avatar_symbol: '§',
       motto: 'Il delitto perfetto è ancora da scrivere',       sort_by: 'author', privacy_level: 2, show_email: false },
  3: { view_mode: 'timeline', theme: 'bordeaux', avatar_style: 'initials', avatar_symbol: '§',
       motto: 'Le edizioni antiche meritano rispetto',          sort_by: 'year',   privacy_level: 1, show_email: false },
  4: { view_mode: 'list',     theme: 'sage',     avatar_style: 'symbol',   avatar_symbol: '❦',
       motto: 'La storia di Napoli scritta dai suoi libri',     sort_by: 'title',  privacy_level: 2, show_email: false },
  5: { view_mode: 'grid',     theme: 'sage',     avatar_style: 'symbol',   avatar_symbol: '❧',
       motto: 'Tradurre è abitare due lingue',                  sort_by: 'recent', privacy_level: 2, show_email: false },
  6: { view_mode: 'shelf',    theme: 'midnight', avatar_style: 'symbol',   avatar_symbol: '✦',
       motto: 'Il futuro lo immaginiamo prima di costruirlo',   sort_by: 'year',   privacy_level: 3, show_email: false }
};

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
    // Preferenze di personalizzazione degli utenti di esempio
    Object.entries(SAMPLE_PROFILE_PREFS).forEach(([id, prefs]) => {
      if (!this.get(`profile_prefs_${id}`)) {
        this.set(`profile_prefs_${id}`, prefs);
      }
    });
    // Demo: rende "recenti" alcune pubblicazioni relativamente alla
    // data della prima visita, così la sezione "vicino a te" mostra
    // il badge di attività. Le date sono calcolate dinamicamente per
    // non diventare mai obsolete. Si applica solo al primo avvio.
    if (!this.get('_recency_demo_done')) {
      const books = this.get('books') || [];
      const daysAgoByBookId = { 2: 6, 11: 20, 12: 5 };
      books.forEach(b => {
        if (daysAgoByBookId[b.id] != null) {
          const d = new Date(Date.now() - daysAgoByBookId[b.id] * 86400000);
          b.added = d.toISOString().slice(0, 10);
        }
      });
      this.set('books', books);
      this.set('_recency_demo_done', true);
    }
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
  },

  /* -------------------------------------------------------------
     Statistiche per singolo utente — usate dalle card "Libreria
     dell'utente" mostrate sulla home in luogo delle categorie.
     ------------------------------------------------------------- */
  getUsersWithLibraryStats() {
    const books = this.getBooks();
    return this.getUsers().map(u => {
      const userBooks = books.filter(b => b.owner_id === u.id);
      return {
        ...u,
        book_count: userBooks.length,
        total_views: userBooks.reduce((s, b) => s + (b.views || 0), 0),
        last_added: userBooks
          .map(b => b.added)
          .sort()
          .pop() || null
      };
    });
  },

  /* Restituisce i libri di uno specifico utente (per profilo /
     librerie aperte). Filtra opzionalmente per disponibilità. */
  getBooksByUser(userId, { onlyAvailable = false } = {}) {
    return this.getBooks().filter(b =>
      b.owner_id === +userId && (!onlyAvailable || b.available)
    );
  },

  /* -------------------------------------------------------------
     Stato di autenticazione SIMULATO (didattico).
     In produzione lo stato deriva da JWT + refresh token; qui
     lo memorizziamo come stringa "user" | "guest" in localStorage
     per consentire il toggle dimostrativo dalla home.
     ------------------------------------------------------------- */
  getAuthState() {
    return Storage.get('auth_state', 'user');
  },
  setAuthState(state) {
    if (state !== 'user' && state !== 'guest') return;
    Storage.set('auth_state', state);
    document.body.dataset.authState = state;
  },
  /* In modalità "user" simuliamo che l'utente loggato sia il primo
     della lista (Chiara Morandi). */
  getCurrentUser() {
    if (this.getAuthState() !== 'user') return null;
    return this.getUser(1);
  },

  /* -------------------------------------------------------------
     Preferenze di personalizzazione del profilo (pagina dedicata).
     Persistono per-utente in localStorage; in produzione vivono
     nella tabella users con colonne JSONB.
     ------------------------------------------------------------- */
  getProfilePrefs(userId) {
    return Storage.get(`profile_prefs_${userId}`, {
      view_mode: 'grid',          // grid | list | shelf | timeline
      theme: 'classic',           // classic | bordeaux | sage | midnight
      avatar_style: 'initials',   // initials | symbol
      avatar_symbol: '§',
      motto: '',
      sort_by: 'recent',          // recent | title | author | year
      privacy_level: 2,
      show_email: false
    });
  },
  setProfilePrefs(userId, prefs) {
    Storage.set(`profile_prefs_${userId}`, prefs);
  },

  /* -------------------------------------------------------------
     Posizione di riferimento per il calcolo delle distanze.
     - Utente autenticato → le sue coordinate reali.
     - Visitatore anonimo → una posizione simulata sul centro di
       Napoli (Piazza del Plebiscito), così la sezione "vicino a te"
       resta dimostrabile anche senza login.
     ------------------------------------------------------------- */
  getReferenceLocation() {
    const user = this.getCurrentUser();
    if (user && typeof user.lat === 'number') {
      return { lat: user.lat, lng: user.lng, simulated: false };
    }
    return { lat: 40.8358, lng: 14.2488, simulated: true };
  },

  /* Giorni trascorsi da una data ISO (o null se non valida) */
  _daysSince(dateStr) {
    if (!dateStr) return null;
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return null;
    return Math.floor((Date.now() - then) / 86400000);
  },

  /* -------------------------------------------------------------
     Librerie ordinate per PROSSIMITÀ e ATTIVITÀ.
     Restituisce, per ogni utente con almeno un libro, le metriche
     necessarie alla card "Librerie vicino a te": distanza dalla
     posizione di riferimento, numero di libri disponibili al
     prestito, indice di attività e preferenze di personalizzazione
     (per generare la copertina).
     ------------------------------------------------------------- */
  getNearbyLibraries({ excludeCurrentUser = true } = {}) {
    const ref = this.getReferenceLocation();
    const books = this.getBooks();
    const currentUser = this.getCurrentUser();

    return this.getUsers()
      .filter(u => u.role !== 'admin')
      .filter(u => !(excludeCurrentUser && currentUser && u.id === currentUser.id))
      .map(u => {
        const userBooks  = books.filter(b => b.owner_id === u.id);
        const available  = userBooks.filter(b => b.available);
        const distanceKm = this.haversineDistance(ref.lat, ref.lng, u.lat, u.lng);
        const lastDays   = this._daysSince(
          userBooks.map(b => b.added).sort().pop()
        );

        /* Indice di attività: pesa i libri disponibili al prestito e
           premia le pubblicazioni recenti (bonus che decade in ~60 gg). */
        const recencyBonus = lastDays !== null
          ? Math.max(0, 60 - lastDays) / 10
          : 0;
        const activityIndex = available.length * 2 + recencyBonus;

        return {
          ...u,
          book_count:      userBooks.length,
          available_count: available.length,
          total_views:     userBooks.reduce((s, b) => s + (b.views || 0), 0),
          distance_km:     distanceKm,
          last_added_days: lastDays,
          activity_index:  activityIndex,
          prefs:           this.getProfilePrefs(u.id),
          /* Punteggio composito: la distanza penalizza, l'attività
             premia. Ordinamento ascendente → vicino + attivo in cima. */
          rank_score:      distanceKm - activityIndex * 0.4
        };
      })
      .filter(u => u.book_count > 0)
      .sort((a, b) => a.rank_score - b.rank_score);
  },

  /* -------------------------------------------------------------
     Dati per la copertina generata di una libreria.
     La copertina NON è un'immagine: è prodotta proceduralmente a
     partire dalle scelte dell'utente nella sua area personale
     (tema cromatico + stile dell'avatar). Restituisce la classe CSS
     del tema e il glifo da stampare al centro.
     ------------------------------------------------------------- */
  libraryCoverData(user, prefs) {
    prefs = prefs || this.getProfilePrefs(user.id);
    const themeClass = `cover--${prefs.theme || 'classic'}`;
    const glyph = prefs.avatar_style === 'symbol'
      ? (prefs.avatar_symbol || '§')
      : (user.display_name || user.username || '?').trim()[0].toUpperCase();
    return { themeClass, glyph };
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
  },

  /* -------------------------------------------------------------
     Card "Libreria utente" — nuovo componente per la home.
     Mostra un mini-profilo con bio, conteggio libri e link.
     ------------------------------------------------------------- */
  renderLibraryCard(user) {
    const initial = (user.display_name || user.username || '?')
      .trim()[0].toUpperCase();
    const bookLabel = user.book_count === 1 ? 'volume' : 'volumi';
    return `
      <a href="profile.html?user=${user.id}" class="library-card">
        <div class="library-card__head">
          <div class="library-card__avatar" aria-hidden="true">${initial}</div>
          <div>
            <h3 class="library-card__name">${user.display_name}</h3>
            <span class="library-card__city">${user.city || '—'}</span>
          </div>
        </div>
        <p class="library-card__bio">${user.bio || 'Nessuna biografia disponibile.'}</p>
        <div class="library-card__footer">
          <span class="library-card__count">${user.book_count} ${bookLabel}</span>
          <span class="library-card__link">visita →</span>
        </div>
      </a>`;
  },

  /* -------------------------------------------------------------
     Card "Libreria vicino a te" — variante ricca del componente
     libreria, con copertina generata, distanza dichiarata e numero
     di volumi disponibili al prestito messo graficamente in risalto.
     ------------------------------------------------------------- */
  renderNearbyLibraryCard(lib) {
    const { themeClass, glyph } = API.libraryCoverData(lib, lib.prefs);

    /* Distanza in linguaggio naturale */
    const dist = lib.distance_km;
    const distLabel = dist < 1
      ? `a ${Math.round(dist * 1000)} m da te`
      : `a ${dist.toFixed(1).replace('.', ',')} km da te`;

    /* Descrizione breve: il motto personalizzato se presente,
       altrimenti la biografia, altrimenti un testo neutro. */
    const shortDesc = lib.prefs && lib.prefs.motto
      ? `«${lib.prefs.motto}»`
      : (lib.bio || 'Collezione privata condivisa con la comunità.');

    /* Badge "attiva di recente": pubblicazione negli ultimi 45 giorni */
    const recentBadge = (lib.last_added_days !== null && lib.last_added_days <= 45)
      ? '<span class="nearby-card__badge">attiva di recente</span>'
      : '';

    const availClass = lib.available_count === 0 ? ' nearby-card__available--empty' : '';
    const availLabel = lib.available_count === 1
      ? 'libro disponibile<br>da chiedere in prestito'
      : 'libri disponibili<br>da chiedere in prestito';

    return `
      <a href="profile.html?user=${lib.id}" class="nearby-card">
        <div class="nearby-card__cover ${themeClass}">
          ${recentBadge}
          <span class="nearby-card__glyph" aria-hidden="true">${glyph}</span>
          <span class="nearby-card__cover-name">${lib.display_name}</span>
        </div>
        <div class="nearby-card__body">
          <h3 class="nearby-card__name">${lib.display_name}</h3>
          <p class="nearby-card__desc">${shortDesc}</p>
          <div class="nearby-card__place">
            <span class="nearby-card__city">${lib.city || '—'}</span>
            <span class="nearby-card__distance">${distLabel}</span>
          </div>
          <div class="nearby-card__available${availClass}">
            <span class="nearby-card__available-count">${lib.available_count}</span>
            <span class="nearby-card__available-label">${availLabel}</span>
          </div>
        </div>
      </a>`;
  },

  /* -------------------------------------------------------------
     Validazione live: collega ascoltatori 'input'/'blur' a un form
     per applicare le classi visive .touched / .is-valid / .is-invalid
     mostrando feedback testuale immediato sotto ogni campo.
     ------------------------------------------------------------- */
  attachLiveValidation(form, customRules = {}) {
    const fields = form.querySelectorAll('input, select, textarea');

    fields.forEach(field => {
      // Salta i checkbox/radio: la loro UX è diversa
      if (['checkbox', 'radio', 'file', 'hidden'].includes(field.type)) return;

      const group = field.closest('.form__group');
      if (group) group.classList.add('form__group--validated');

      // Crea contenitore feedback se assente
      let feedback = group?.querySelector('.form__feedback');
      if (group && !feedback) {
        feedback = document.createElement('span');
        feedback.className = 'form__feedback';
        feedback.setAttribute('aria-live', 'polite');
        group.appendChild(feedback);
      }

      const validate = () => {
        if (!field.value && !field.required) {
          // Campo facoltativo lasciato vuoto: stato neutro
          group?.classList.remove('is-valid', 'is-invalid');
          if (feedback) { feedback.textContent = ''; feedback.className = 'form__feedback'; }
          return;
        }

        let ok = field.checkValidity();
        let msg = '';

        // Regola personalizzata aggiuntiva (es. minLen descrizione)
        if (ok && customRules[field.name]) {
          const result = customRules[field.name](field.value, field);
          if (result !== true) { ok = false; msg = result; }
        }

        // Messaggi italianizzati per i validity state nativi
        if (!ok && !msg) {
          if (field.validity.valueMissing)        msg = 'Campo obbligatorio.';
          else if (field.validity.typeMismatch)   msg = 'Formato non valido.';
          else if (field.validity.patternMismatch)msg = 'Formato non valido.';
          else if (field.validity.tooShort)       msg = `Minimo ${field.minLength} caratteri.`;
          else if (field.validity.tooLong)        msg = `Massimo ${field.maxLength} caratteri.`;
          else if (field.validity.rangeUnderflow) msg = `Valore minimo: ${field.min}.`;
          else if (field.validity.rangeOverflow)  msg = `Valore massimo: ${field.max}.`;
          else                                    msg = 'Valore non valido.';
        }

        group?.classList.toggle('is-valid', ok);
        group?.classList.toggle('is-invalid', !ok);
        if (feedback) {
          feedback.textContent = ok ? '✓ Campo valido.' : msg;
          feedback.className = 'form__feedback ' +
            (ok ? 'form__feedback--ok' : 'form__feedback--error');
        }
      };

      // Marca come "toccato" al primo blur (per evitare di mostrare
      // errori prima ancora che l'utente abbia interagito col campo)
      field.addEventListener('blur',  () => { field.classList.add('touched'); validate(); });
      field.addEventListener('input', () => {
        if (field.classList.contains('touched')) validate();
      });
    });
  },

  /* -------------------------------------------------------------
     Inizializza il toggle dello stato di autenticazione (header).
     ------------------------------------------------------------- */
  initAuthToggle() {
    const state = API.getAuthState();
    document.body.dataset.authState = state;

    const toggle = document.querySelector('.auth-toggle');
    if (!toggle) return;

    const update = () => {
      const s = API.getAuthState();
      toggle.dataset.state = s;
      const txt = toggle.querySelector('.auth-toggle__text');
      if (txt) txt.textContent = s === 'user' ? 'visita autenticata' : 'visita anonima';
      toggle.setAttribute('aria-label',
        s === 'user'
          ? 'Sei in modalità autenticata. Clicca per simulare un nuovo visitatore.'
          : 'Sei in modalità visitatore. Clicca per simulare l\'accesso utente.');
    };

    update();
    toggle.addEventListener('click', () => {
      const next = API.getAuthState() === 'user' ? 'guest' : 'user';
      API.setAuthState(next);
      update();
      document.dispatchEvent(new CustomEvent('auth:change', { detail: { state: next }}));
    });
  }
};

/* -----------------------------------------------------------------
   5. INIZIALIZZAZIONE GLOBALE
   ----------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  Storage.init();
  UI.initMobileNav();
  UI.highlightActiveNav();
  UI.initAuthToggle();
});

/* Esposizione globale per uso in altri script */
window.API = API;
window.UI = UI;
window.Storage = Storage;
