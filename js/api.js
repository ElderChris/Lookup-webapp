/* =============================================================================
   api.js — Logica applicativa (business layer)
   =============================================================================
   L'oggetto API espone tutti i metodi che il frontend chiama per leggere/modificare
   lo stato dell'applicazione. È puro JS, senza riferimenti al DOM.

   ⚠ TODO(alpha-fase1+2): ogni metodo qui dentro avrà un endpoint REST 1:1 nel
   backend Fastify. Es: API.getBooks() → GET /api/books. La firma esterna NON
   cambierà, ma diventerà async (Promise-returning). Vedi docs/architecture.md §5.

   Cosa contiene (~2600 righe, sezioni interne marcate con commenti):
   - Books, Users, Loans, Reviews, Posts, Notifications, Follows, Likes
   - Stats: getGlobalStats, getFeaturedBooks (algoritmo trend), ridgeline
   - Geo: haversineDistance, getReferenceLocation
   - Auth (mock): authenticate, registerUser, requestPasswordReset
   ============================================================================= */

import { Storage } from './storage.js';
import {
  SAMPLE_USERS, SAMPLE_BOOKS, SAMPLE_LOANS, SAMPLE_MESSAGES,
  SAMPLE_REVIEWS, SAMPLE_POSTS, SAMPLE_CATEGORIES,
  SAMPLE_FOLLOWS, SAMPLE_LIKES, SAMPLE_FOLLOWER_BASE,
  SAMPLE_PROFILE_PREFS, SAMPLE_ORG_PROFILES,
  BISAC_CATEGORIES, BISAC_FLAT, BISAC_PARENT,
  ORG_CATEGORIES, LOAN_STATUS, LOAN_STATUS_ORDER,
  LOAN_STATUS_LABEL, LOAN_STATUS_HINT,
  LIBRARY_COVER_DESIGN_MAP,
  daysAgo
} from './data.js';

export const API = {

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
      results = results.filter(b => {
        // Testo bibliografico
        if (b.title.toLowerCase().includes(q) ||
            b.author.toLowerCase().includes(q) ||
            (b.description && b.description.toLowerCase().includes(q))) {
          return true;
        }
        // Informazioni spaziali del proprietario: città, e — per gli enti —
        // indirizzo pubblico (che contiene via e CAP). Permette di cercare
        // per nome di città, quartiere, indirizzo o codice di avviamento
        // postale, oltre che per titolo/autore.
        const owner = this.getUser(b.owner_id);
        if (owner) {
          if (owner.city && owner.city.toLowerCase().includes(q)) return true;
          const org = this.getOrgProfile ? this.getOrgProfile(owner.id) : null;
          if (org && org.public_address &&
              org.public_address.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    /* Filtro per tag BISAC: filters.categories è un array di tag
       (etichette esatte). Un libro passa il filtro se *almeno uno*
       dei suoi tag coincide con uno di quelli richiesti — semantica
       OR coerente con il modo in cui chi cerca aggiunge i tag.
       Compat: accetta anche filters.category (stringa, modalità v0.5). */
    if (Array.isArray(filters.categories) && filters.categories.length) {
      const set = new Set(filters.categories);
      results = results.filter(b => {
        const tags = b.categories || (b.category ? [b.category] : []);
        return tags.some(t => set.has(t));
      });
    } else if (filters.category) {
      results = results.filter(b => {
        const tags = b.categories || (b.category ? [b.category] : []);
        return tags.includes(filters.category);
      });
    }
    if (filters.available !== undefined) results = results.filter(b => b.available === filters.available);
    /* Filtro per distanza (in km) — entro il raggio dato dalla posizione
       di riferimento (utente loggato o centro di Napoli per gli ospiti). */
    if (filters.max_km !== undefined && filters.max_km !== null) {
      const ref = this.getReferenceLocation();
      results = results.filter(b => {
        const owner = this.getUser(b.owner_id);
        if (!owner) return false;
        return this.haversineDistance(ref.lat, ref.lng, owner.lat, owner.lng) <= filters.max_km;
      });
    }
    return results;
  },

  /* Tutti i tag BISAC esistenti, ordinati alfabeticamente. Usato
     dall'autocomplete dell'input multi-tag. */
  getAllCategoryTags() { return BISAC_FLAT.slice(); },
  /* Macro-area BISAC di appartenenza di un tag (per il dropdown). */
  getCategoryParent(tag) { return BISAC_PARENT[tag] || ''; },

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

  // --- Richiesta prestito (v1.5: ciclo completo a 5 stati) -------
  // v1.6: aggiunge daysRequested (5..28) per il calcolo del sollecito.
  requestLoan(bookId, requesterId, message, daysRequested) {
    const requests = Storage.get('loan_requests', []);
    const book = this.getBooks().find(b => b.id === +bookId);
    if (!book) return { ok: false, reason: 'book-not-found' };
    if (!book.available) return { ok: false, reason: 'not-available' };
    if (+book.owner_id === +requesterId) return { ok: false, reason: 'self' };

    // Validazione days: range 5..28, default 14
    let days = parseInt(daysRequested, 10);
    if (!(days >= 5 && days <= 28)) days = 14;

    const newId = requests.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
    const loan = {
      id: newId,
      book_id: +bookId,
      requester_id: +requesterId,
      lender_id: +book.owner_id,
      status: LOAN_STATUS.REQUESTED,
      requested_at: new Date().toISOString(),
      days_requested: days,
      message: message || ''
    };
    requests.push(loan);
    Storage.set('loan_requests', requests);

    // Incrementa contatore sul libro (richieste storiche)
    const books = this.getBooks();
    const b = books.find(b => b.id === +bookId);
    if (b) { b.loan_requests = (b.loan_requests || 0) + 1; Storage.set('books', books); }

    // Notifica al prestatore
    this.addNotification(loan.lender_id, {
      type: 'loan_request',
      actor_id: requesterId,
      book_id: bookId,
      loan_id: loan.id,
      message: `Hai una nuova richiesta di prestito per <strong>${book.title}</strong> (${days} giorni).`,
      created_at: new Date().toISOString()
    });
    // v1.7: messaggio di sistema nella chat
    this._addSystemMessage(loan.id, 'requested', 'Richiesta di prestito inviata.');
    return { ok: true, loan };
  },

  /** v1.6: Il prestatore RIFIUTA la richiesta con una motivazione.
      Richiede un testo di almeno 10 caratteri (l'esperienza chiede di
      non sparire in silenzio, di lasciare un motivo). Stato terminale. */
  rejectLoan(loanId, reason) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    if (!reason || reason.trim().length < 10)
      return { ok: false, reason: 'reason-short' };

    const requests = Storage.get('loan_requests', []) || [];
    const loan = requests.find(l => l.id === +loanId);
    if (!loan) return { ok: false, reason: 'not-found' };
    if (+me.id !== +loan.lender_id) return { ok: false, reason: 'forbidden' };
    if (loan.status !== LOAN_STATUS.REQUESTED)
      return { ok: false, reason: 'invalid-state' };

    loan.status = 'rejected';
    loan.rejection_reason = reason.trim();
    loan.rejected_at = new Date().toISOString();
    Storage.set('loan_requests', requests);

    const book = this.getBooks().find(b => b.id === loan.book_id);
    this.addNotification(loan.requester_id, {
      type: 'loan_rejected',
      actor_id: loan.lender_id,
      book_id: loan.book_id,
      loan_id: loan.id,
      message: `La tua richiesta per <strong>${book ? book.title : 'un volume'}</strong> non è stata accettata.`,
      created_at: new Date().toISOString()
    });
    this._addSystemMessage(loan.id, 'rejected',
      `Richiesta rifiutata. Motivo: «${reason.trim()}»`);
    return { ok: true, loan };
  },

  /** v1.6: Il richiedente ANNULLA una richiesta non ancora confermata.
      Permesso solo da stato `requested` (dopo la conferma, il flusso
      prosegue: per annullare un prestito già confermato servirebbe una
      "cancellazione" più complessa che non implementiamo nel prototipo). */
  cancelLoan(loanId) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    const requests = Storage.get('loan_requests', []) || [];
    const loan = requests.find(l => l.id === +loanId);
    if (!loan) return { ok: false, reason: 'not-found' };
    if (+me.id !== +loan.requester_id) return { ok: false, reason: 'forbidden' };
    if (loan.status !== LOAN_STATUS.REQUESTED)
      return { ok: false, reason: 'invalid-state' };

    loan.status = 'cancelled';
    loan.cancelled_at = new Date().toISOString();
    Storage.set('loan_requests', requests);

    const book = this.getBooks().find(b => b.id === loan.book_id);
    this.addNotification(loan.lender_id, {
      type: 'loan_cancelled',
      actor_id: loan.requester_id,
      book_id: loan.book_id,
      loan_id: loan.id,
      message: `Il richiedente ha annullato la richiesta di prestito per <strong>${book ? book.title : 'un volume'}</strong>.`,
      created_at: new Date().toISOString()
    });
    this._addSystemMessage(loan.id, 'cancelled', 'Richiesta annullata dal richiedente.');
    return { ok: true, loan };
  },

  /** v1.6: Verifica i prestiti `borrowed` che hanno superato i giorni
      pattuiti senza essere stati restituiti. Per ciascuno (e una sola
      volta, controllando il flag `reminder_sent_at`):
      - imposta `reminder_sent_at` al momento corrente
      - genera una notifica al richiedente
      - registra un'email simulata di sollecito
      Chiamato a ogni Storage.init e su loans.html load.
      Restituisce il numero di solleciti inviati nel run corrente. */
  checkOverdueLoans() {
    const loans = Storage.get('loan_requests', []) || [];
    const now = Date.now();
    let count = 0;

    loans.forEach(loan => {
      if (loan.status !== LOAN_STATUS.BORROWED) return;
      if (loan.reminder_sent_at) return;
      if (!loan.borrowed_at || !loan.days_requested) return;

      const deadline = new Date(loan.borrowed_at).getTime() + loan.days_requested * 86400000;
      if (now < deadline) return;

      // PRESTITO SCADUTO — invia sollecito
      const book = this.getBooks().find(b => b.id === loan.book_id);
      const lender = this.getUser(loan.lender_id);
      const requester = this.getUser(loan.requester_id);
      const overdueDays = Math.floor((now - deadline) / 86400000);

      loan.reminder_sent_at = new Date().toISOString();

      // Notifica piattaforma al richiedente
      this.addNotification(loan.requester_id, {
        type: 'loan_overdue',
        actor_id: loan.lender_id,
        book_id: loan.book_id,
        loan_id: loan.id,
        message: `Sollecito: il volume <strong>${book ? book.title : ''}</strong> ` +
                 `andava restituito ${overdueDays === 0 ? 'oggi' : (overdueDays === 1 ? 'ieri' : overdueDays + ' giorni fa')}. ` +
                 `Avvia la restituzione il prima possibile.`,
        created_at: new Date().toISOString()
      });

      // Email simulata al richiedente
      this._saveSimulatedEmail({
        to: requester ? requester.email : '',
        to_name: requester ? requester.display_name : '',
        subject: `Sollecito restituzione: ${book ? book.title : 'un volume'}`,
        body_html: `
          <p>Ciao ${requester ? requester.display_name : ''},</p>
          <p>Questo è un sollecito automatico: il volume <em>${book ? book.title : ''}</em>,
          prestato da <strong>${lender ? lender.display_name : ''}</strong>,
          andava restituito entro <strong>${loan.days_requested} giorni</strong> dal ritiro
          (${overdueDays === 0 ? 'oggi è il giorno della scadenza' : 'scadenza superata di ' + overdueDays + ' ' + (overdueDays === 1 ? 'giorno' : 'giorni')}).</p>
          <p>Ti chiediamo di avviare la procedura di restituzione il prima possibile dalla
          pagina dei tuoi prestiti:</p>
          <p><a href="loans.html?id=${loan.id}">→ Apri la pagina del prestito</a></p>
          <p style="color:#666;font-size:.85em;">Questo è un messaggio automatico, non
          rispondere direttamente.</p>`,
        loan_id: loan.id,
        created_at: new Date().toISOString()
      });
      this._addSystemMessage(loan.id, 'overdue_reminder',
        `Sollecito automatico: il termine di restituzione (${loan.days_requested} giorni) è stato superato.`);

      count++;
    });

    if (count > 0) Storage.set('loan_requests', loans);
    return count;
  },

  /** Tutti i prestiti dove l'utente è richiedente (i "miei prestiti"). */
  getLoansByRequester(userId) {
    return (Storage.get('loan_requests', []) || [])
      .filter(l => +l.requester_id === +userId)
      .sort((a, b) => (b.requested_at || '').localeCompare(a.requested_at || ''));
  },

  /** v2.0: Aggrega tutti i prestiti dove l'utente è partecipante
      (richiedente O prestatore), ordinati dal più recente. La pagina
      master-detail su loans.html usa questo come fonte unica. */
  getLoansForUser(userId) {
    const uid = +userId;
    return (Storage.get('loan_requests', []) || [])
      .filter(l => +l.requester_id === uid || +l.lender_id === uid)
      .sort((a, b) => (b.requested_at || '').localeCompare(a.requested_at || ''));
  },

  /** v2.0: Conteggio dei prestiti CONCLUSI dall'utente, aggregato sia
      come richiedente sia come prestatore. È l'indicatore di "esperienza"
      mostrato accanto alle recensioni: dimostra quanti scambi l'utente ha
      portato a termine con successo. Sono inclusi solo i prestiti in stato
      'returned' (cioè quelli per cui il prestatore ha confermato la
      ricezione del volume), perché solo quelli sono vere transazioni
      completate. */
  getCompletedLoansCount(userId) {
    const uid = +userId;
    return (Storage.get('loan_requests', []) || [])
      .filter(l => l.status === 'returned' &&
        (+l.requester_id === uid || +l.lender_id === uid))
      .length;
  },

  /** Tutti i prestiti dove l'utente è prestatore (richieste ricevute). */
  getLoansByLender(userId) {
    return (Storage.get('loan_requests', []) || [])
      .filter(l => +l.lender_id === +userId)
      .sort((a, b) => (b.requested_at || '').localeCompare(a.requested_at || ''));
  },

  /** Singolo prestito per id. */
  getLoan(id) {
    return (Storage.get('loan_requests', []) || []).find(l => l.id === +id);
  },

  /** Aggiorna lo stato di un prestito con controllo di proprietà.
      `actorRole`: 'requester' | 'lender' per chi sta facendo l'azione. */
  _transitionLoan(loanId, fromStatus, toStatus, actorRole, tsField) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    const requests = Storage.get('loan_requests', []) || [];
    const loan = requests.find(l => l.id === +loanId);
    if (!loan) return { ok: false, reason: 'not-found' };
    if (loan.status !== fromStatus) return { ok: false, reason: 'invalid-state' };
    const allowedActor = actorRole === 'requester' ? loan.requester_id : loan.lender_id;
    if (+me.id !== +allowedActor) return { ok: false, reason: 'forbidden' };

    loan.status = toStatus;
    loan[tsField] = new Date().toISOString();
    Storage.set('loan_requests', requests);
    return { ok: true, loan };
  },

  /** Il prestatore conferma la richiesta. → 'confirmed' */
  confirmLoan(loanId) {
    const r = this._transitionLoan(loanId, LOAN_STATUS.REQUESTED, LOAN_STATUS.CONFIRMED, 'lender', 'confirmed_at');
    if (r.ok) {
      const book = this.getBooks().find(b => b.id === r.loan.book_id);
      this.addNotification(r.loan.requester_id, {
        type: 'loan_confirmed',
        actor_id: r.loan.lender_id,
        book_id: r.loan.book_id,
        loan_id: r.loan.id,
        message: `La tua richiesta per <strong>${book ? book.title : 'un volume'}</strong> è stata accettata. Puoi recarti a ritirarlo.`,
        created_at: new Date().toISOString()
      });
      this._addSystemMessage(r.loan.id, 'confirmed',
        'Richiesta confermata. Il richiedente può recarsi a ritirare il volume.');
    }
    return r;
  },

  /** Il richiedente conferma il ritiro fisico. → 'borrowed' */
  confirmPickup(loanId) {
    const r = this._transitionLoan(loanId, LOAN_STATUS.CONFIRMED, LOAN_STATUS.BORROWED, 'requester', 'borrowed_at');
    if (r.ok) {
      // Segna il libro come non disponibile
      const books = this.getBooks();
      const book = books.find(b => b.id === r.loan.book_id);
      if (book) { book.available = false; Storage.set('books', books); }
      // Notifica al prestatore
      this.addNotification(r.loan.lender_id, {
        type: 'loan_picked_up',
        actor_id: r.loan.requester_id,
        book_id: r.loan.book_id,
        loan_id: r.loan.id,
        message: `Il volume <strong>${book ? book.title : ''}</strong> è ora in possesso del richiedente.`,
        created_at: new Date().toISOString()
      });
      this._addSystemMessage(r.loan.id, 'borrowed',
        `Volume ritirato. Periodo pattuito: ${r.loan.days_requested || 14} giorni.`);
    }
    return r;
  },

  /** Il richiedente avvia la restituzione. → 'returning'
      Genera anche l'email simulata che il prestatore "riceverà". */
  startReturn(loanId) {
    const r = this._transitionLoan(loanId, LOAN_STATUS.BORROWED, LOAN_STATUS.RETURNING, 'requester', 'returning_at');
    if (r.ok) {
      const book = this.getBooks().find(b => b.id === r.loan.book_id);
      const lender = this.getUser(r.loan.lender_id);
      const requester = this.getUser(r.loan.requester_id);
      // Notifica al prestatore
      this.addNotification(r.loan.lender_id, {
        type: 'loan_returning',
        actor_id: r.loan.requester_id,
        book_id: r.loan.book_id,
        loan_id: r.loan.id,
        message: `<strong>${requester ? requester.display_name : 'Il richiedente'}</strong> ha avviato la restituzione di <strong>${book ? book.title : 'un volume'}</strong>.`,
        created_at: new Date().toISOString()
      });
      // Email simulata: la salviamo in localStorage per la demo
      this._saveSimulatedEmail({
        to: lender ? lender.email : '',
        to_name: lender ? lender.display_name : '',
        subject: `Restituzione in corso: ${book ? book.title : 'un volume'}`,
        body_html: `
          <p>Ciao ${lender ? lender.display_name : ''},</p>
          <p><strong>${requester ? requester.display_name : 'Il richiedente'}</strong> ha avviato la
          procedura di restituzione del volume <em>${book ? book.title : ''}</em>.</p>
          <p>Per visualizzare lo stato del prestito e confermare la ricezione una volta
          tornato in tuo possesso, vai alla pagina dei prestiti:</p>
          <p><a href="loans.html?id=${r.loan.id}">→ Apri la pagina del prestito</a></p>`,
        loan_id: r.loan.id,
        created_at: new Date().toISOString()
      });
      this._addSystemMessage(r.loan.id, 'returning',
        'Restituzione avviata dal richiedente.');
    }
    return r;
  },

  /** Il prestatore conferma la ricezione del libro restituito. → 'returned' */
  confirmReturn(loanId) {
    const r = this._transitionLoan(loanId, LOAN_STATUS.RETURNING, LOAN_STATUS.RETURNED, 'lender', 'returned_at');
    if (r.ok) {
      const books = this.getBooks();
      const book = books.find(b => b.id === r.loan.book_id);
      if (book) { book.available = true; Storage.set('books', books); }
      this.addNotification(r.loan.requester_id, {
        type: 'loan_returned',
        actor_id: r.loan.lender_id,
        book_id: r.loan.book_id,
        loan_id: r.loan.id,
        message: `Il prestito di <strong>${book ? book.title : 'un volume'}</strong> è chiuso. Ora puoi lasciare una recensione.`,
        created_at: new Date().toISOString()
      });
      this._addSystemMessage(r.loan.id, 'returned',
        'Prestito concluso. Ora puoi lasciare una recensione.');
    }
    return r;
  },

  /** Salva un'email simulata nella "casella" del destinatario.
      In produzione: SMTP. Qui è una struttura in localStorage che la
      pagina del prestito potrà mostrare in un box "Demo del prototipo".
      TODO(alpha): rimuovere _saveSimulatedEmail e simulated_emails store.
      Sostituire con chiamata backend POST /api/notifications/email che
      invia tramite nodemailer → MailHog (dev) o SMTP del cliente (prod). */
  _saveSimulatedEmail(email) {
    const inbox = Storage.get('simulated_emails', []) || [];
    inbox.push(Object.assign({ id: Date.now() }, email));
    Storage.set('simulated_emails', inbox);
  },
  getSimulatedEmailsForLoan(loanId) {
    return (Storage.get('simulated_emails', []) || [])
      .filter(e => e.loan_id === +loanId);
  },

  /* =============================================================
     CHAT DI PRESTITO (v1.7) — messaggi associati al singolo loan
     ============================================================= */

  /** Restituisce tutti i messaggi di un prestito, ordinati per data. */
  getMessagesForLoan(loanId) {
    return (Storage.get('loan_messages', []) || [])
      .filter(m => +m.loan_id === +loanId)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  },

  /** Conta i messaggi NON letti dall'utente in un prestito. */
  getUnreadMessageCount(loanId, userId) {
    return this.getMessagesForLoan(loanId)
      .filter(m => !m.read_by || !m.read_by.includes(+userId))
      .length;
  },

  /** Conta i messaggi non letti totali su tutti i prestiti dell'utente. */
  getTotalUnreadMessages(userId) {
    const loans = (Storage.get('loan_requests', []) || []).filter(l =>
      +l.requester_id === +userId || +l.lender_id === +userId);
    return loans.reduce((sum, l) => sum + this.getUnreadMessageCount(l.id, userId), 0);
  },

  /** Marca tutti i messaggi di un prestito come letti dall'utente. */
  markLoanMessagesRead(loanId, userId) {
    const messages = Storage.get('loan_messages', []) || [];
    let changed = false;
    messages.forEach(m => {
      if (+m.loan_id !== +loanId) return;
      if (!m.read_by) m.read_by = [];
      if (!m.read_by.includes(+userId)) {
        m.read_by.push(+userId);
        changed = true;
      }
    });
    if (changed) Storage.set('loan_messages', messages);
  },

  /** L'utente invia un messaggio dentro la chat del prestito.
      Controlli: deve essere uno dei due partecipanti e non vuoto. */
  sendMessage(loanId, text) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    const loan = this.getLoan(loanId);
    if (!loan) return { ok: false, reason: 'not-found' };
    if (+me.id !== +loan.requester_id && +me.id !== +loan.lender_id)
      return { ok: false, reason: 'forbidden' };
    const content = (text || '').trim();
    if (!content) return { ok: false, reason: 'empty' };
    if (content.length > 2000) return { ok: false, reason: 'too-long' };

    const messages = Storage.get('loan_messages', []) || [];
    const newId = messages.reduce((m, msg) => Math.max(m, msg.id || 0), 0) + 1;
    const msg = {
      id: newId,
      loan_id: +loanId,
      sender_id: +me.id,
      type: 'user',
      content: content,
      created_at: new Date().toISOString(),
      read_by: [+me.id]   // automaticamente letto da chi lo scrive
    };
    messages.push(msg);
    Storage.set('loan_messages', messages);

    // Notifica all'ALTRO partecipante (non a chi ha appena scritto)
    const otherId = +me.id === +loan.requester_id ? loan.lender_id : loan.requester_id;
    const book = this.getBooks().find(b => b.id === loan.book_id);
    this.addNotification(otherId, {
      type: 'loan_message',
      actor_id: me.id,
      book_id: loan.book_id,
      loan_id: loan.id,
      message: `Nuovo messaggio da <strong>${me.display_name}</strong> sulla chat di <em>${book ? book.title : 'un volume'}</em>.`,
      created_at: new Date().toISOString()
    });

    return { ok: true, message: msg };
  },

  /** Aggiunge un messaggio di SISTEMA alla chat del prestito.
      Chiamato internamente dai metodi di transizione (confirmLoan,
      confirmPickup, startReturn, ecc.) per dare alla chat una "scia
      narrativa" del ciclo. content può essere semplice testo. */
  _addSystemMessage(loanId, eventType, content) {
    const messages = Storage.get('loan_messages', []) || [];
    const newId = messages.reduce((m, msg) => Math.max(m, msg.id || 0), 0) + 1;
    messages.push({
      id: newId,
      loan_id: +loanId,
      sender_id: null,
      type: 'system',
      event_type: eventType,
      content: content,
      created_at: new Date().toISOString(),
      read_by: []
    });
    Storage.set('loan_messages', messages);
  },

  /** v1.9: Simulatore demo — fa avanzare lo stato del prestito allo
      step successivo bypassando i controlli di ruolo (usato solo per
      la pagina dimostrativa loans.html). Inoltre genera una risposta
      contestuale dall'altro partecipante nella chat. Restituisce
      `{ ok, fromState, toState, message }` per permettere all'UI di
      animare la transizione.

      Transizioni simulabili:
        requested  → confirmed  (azione del prestatore)
        confirmed  → borrowed   (azione del richiedente)
        borrowed   → returning  (azione del richiedente)
        returning  → returned   (azione del prestatore)
      Stati terminali (returned/rejected/cancelled) → no-op. */
  simulateNextState(loanId) {
    const loan = this.getLoan(loanId);
    if (!loan) return { ok: false, reason: 'not-found' };

    // Determina la prossima transizione e l'attore che la eseguirebbe
    const next = {
      requested: { to: 'confirmed', method: 'confirmLoan',    actor: 'lender' },
      confirmed: { to: 'borrowed',  method: 'confirmPickup',  actor: 'requester' },
      borrowed:  { to: 'returning', method: 'startReturn',    actor: 'requester' },
      returning: { to: 'returned',  method: 'confirmReturn',  actor: 'lender' }
    }[loan.status];

    if (!next) return { ok: false, reason: 'terminal-state' };

    // Trucco: swap temporaneo del current user per superare i check
    // di proprietà nei transition method. È accettabile perché siamo
    // in un simulatore esplicito; nessun dato dell'altro user cambia.
    const savedCurrent = Storage.get('current_user_id', 1);
    const actorId = next.actor === 'lender' ? loan.lender_id : loan.requester_id;
    Storage.set('current_user_id', actorId);
    const result = this[next.method](loanId);
    Storage.set('current_user_id', savedCurrent);

    if (!result.ok) return { ok: false, reason: result.reason };

    // Aggiunge la risposta contestuale dall'ALTRO partecipante
    // (rispetto all'utente che sta guardando la pagina). La selezione
    // del testo dipende dal nuovo stato e da chi è "l'altro".
    const me = this.getCurrentUser();
    const otherIsLender = me && +me.id === +loan.requester_id;
    const otherId = otherIsLender ? loan.lender_id : loan.requester_id;
    const replyText = this._contextualReply(next.to, otherIsLender, me, loan);
    if (replyText) {
      // Swap di nuovo per inviare il messaggio "dall'altro"
      Storage.set('current_user_id', otherId);
      this.sendMessage(loanId, replyText);
      Storage.set('current_user_id', savedCurrent);
    }

    return { ok: true, fromState: loan.status, toState: next.to, loan: this.getLoan(loanId) };
  },

  /** Banca di risposte automatiche realistiche, scelte in base al
      nuovo stato e a chi è "l'altro" rispetto all'utente attivo. */
  _contextualReply(newState, otherIsLender, me, loan) {
    const meName = me ? me.display_name.split(' ')[0] : '';
    const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];

    if (otherIsLender) {
      // L'altro è il prestatore: risponde a me che sono il richiedente
      const banks = {
        confirmed: [
          `Ciao ${meName}! Ti ho confermato la richiesta, puoi venire a prenderti il libro quando ti torna comodo. Ti serve aiuto con la posizione?`,
          `Tutto bene, confermato! Quando passi a ritirarlo? Sono libero/a nel pomeriggio per la maggior parte dei giorni.`,
          `Confermato volentieri ${meName}, è un libro a cui tengo molto. Ti aspetto, fammi sapere quando vuoi passare.`
        ],
        borrowed: [
          `Grazie per essere passato/a! Goditi la lettura, fammi sapere se ti piace.`,
          `Perfetto, è in buone mani. Quando l'avrai finito avviamo la procedura di restituzione dalla piattaforma.`,
          `Felice di averti dato il libro. Buona lettura ${meName}!`
        ],
        returning: [
          `Va bene, ho ricevuto la notifica di restituzione. Quando passi a riportarlo? Stessi orari di prima.`,
          `Ottimo, ti aspetto per la restituzione. Ti è piaciuto?`,
          `Perfetto ${meName}, ci sentiamo per concordare la riconsegna.`
        ],
        returned: [
          `Tutto a posto, ho confermato la ricezione. Grazie ancora, è stato un piacere prestartelo!`,
          `Confermato, il libro è tornato a casa. Se hai apprezzato, lascia pure una recensione — fa sempre piacere.`,
          `Restituzione registrata. A presto per un altro prestito!`
        ]
      };
      return pickRandom(banks[newState] || []);
    } else {
      // L'altro è il richiedente: risponde a me che sono il prestatore
      const banks = {
        confirmed: [
          `Grazie mille per aver confermato! Passo a ritirarlo nei prossimi giorni, ti avviso prima.`,
          `Confermato ricevuto, grazie! A quando posso passare?`,
          `Perfetto, non vedo l'ora di leggerlo. Grazie!`
        ],
        borrowed: [
          `Ho appena ritirato il volume, grazie ancora! Lo tratterò con cura.`,
          `Ritirato, tutto bene. Mi metto a leggere stasera, sembra molto interessante!`,
          `Grazie ${meName}, ricevuto. Ti faccio sapere come va con la lettura.`
        ],
        returning: [
          `Ho appena avviato la restituzione. Quando posso passare? Per me andrebbe bene oggi nel tardo pomeriggio.`,
          `Restituzione partita! Ti riporto il libro domani se ti va, dimmi solo l'orario.`,
          `Procedo con la restituzione. Grazie, è stato prezioso.`
        ],
        returned: [
          `Grazie infinitamente! Mi è piaciuto moltissimo, lascio anche una recensione.`,
          `Grazie ancora ${meName}, conservo un bellissimo ricordo. A presto per altri prestiti!`,
          `Tutto chiuso! È stato un piacere, sicuramente ti chiederò ancora qualcosa.`
        ]
      };
      return pickRandom(banks[newState] || []);
    }
  },

  /** v2.3: Registra una visualizzazione del libro. Viene chiamato
      da book-detail.html al primo accesso nella session corrente
      (deduplicato via sessionStorage per non gonfiare i numeri ad ogni
      reload). Crea un evento timestampato in book_views[] e
      incrementa il counter book.views per backward compat con il
      resto del codice che lo usa. */
  recordBookView(bookId) {
    // Deduplica per session: stesso libro visitato più volte nella
    // stessa session conta come una sola visualizzazione.
    const sessKey = `viewed_${bookId}`;
    if (sessionStorage.getItem(sessKey)) return { ok: false, reason: 'already-viewed-this-session' };
    sessionStorage.setItem(sessKey, '1');

    const events = Storage.get('book_views', []) || [];
    const me = this.getCurrentUser();
    events.push({
      id: 'v' + Date.now() + Math.random().toString(36).slice(2, 6),
      book_id: +bookId,
      viewer_id: me ? me.id : null,
      ts: new Date().toISOString()
    });
    Storage.set('book_views', events);

    // Aggiorna il counter sul libro (per compatibilità con il resto
    // del codice). Quando il prototipo sarà a regime, questo verrà
    // ricalcolato dinamicamente dalla tabella book_views.
    const books = this.getBooks();
    const book = books.find(b => +b.id === +bookId);
    if (book) {
      book.views = (book.views || 0) + 1;
      Storage.set('books', books);
    }
    return { ok: true };
  },

  /** v2.3: Cancella definitivamente un libro dal catalogo. È
      permesso solo se l'utente corrente è il proprietario E ha
      almeno la libreria aperta (curator/admin). Vengono rimossi
      anche tutti i dati derivati (richieste di prestito, view
      events, like) per non sporcare i ranking storici con dati
      orfani. In produzione qui sarebbe DELETE /api/books/:id con
      ON DELETE CASCADE sulle tabelle correlate. */
  deleteBook(bookId) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    const books = this.getBooks();
    const book = books.find(b => +b.id === +bookId);
    if (!book) return { ok: false, reason: 'not-found' };
    if (+book.owner_id !== +me.id && !me.is_admin) {
      return { ok: false, reason: 'forbidden' };
    }
    // Rimuovi il libro
    Storage.set('books', books.filter(b => +b.id !== +bookId));
    // Rimuovi i prestiti collegati (history dei prestiti perde
    // questo libro; era una scelta consapevole — la cronologia
    // del libro muore con il libro)
    const loans = Storage.get('loan_requests', []) || [];
    Storage.set('loan_requests', loans.filter(l => +l.book_id !== +bookId));
    // Rimuovi view events
    const views = Storage.get('book_views', []) || [];
    Storage.set('book_views', views.filter(v => +v.book_id !== +bookId));
    // Rimuovi like per il libro (sparsi nei likes_<userId>)
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith('likes_'));
    allKeys.forEach(k => {
      const list = Storage.get(k, []) || [];
      Storage.set(k, list.filter(id => +id !== +bookId));
    });
    return { ok: true };
  },

  /** v2.3: Timeline completa di un singolo libro per il grafico
      espandibile nella pagina stats. Restituisce eventi ordinati
      cronologicamente: aggiunta, view, prestito, like.
      Aggrega anche per mese per il line chart cumulativo. */
  getBookTimeline(bookId) {
    const book = this.getBooks().find(b => +b.id === +bookId);
    if (!book) return null;

    const addedTs = new Date(book.added).getTime();
    const nowTs = Date.now();
    const events = [];

    // Evento "aggiunta in piattaforma"
    events.push({ type: 'added', ts: addedTs, label: 'Aggiunto in piattaforma' });

    // Views: ogni evento da book_views[]
    const views = (Storage.get('book_views', []) || []).filter(v => +v.book_id === +bookId);
    views.forEach(v => events.push({ type: 'view', ts: new Date(v.ts).getTime() }));

    // Richieste di prestito
    const loans = (Storage.get('loan_requests', []) || []).filter(l => +l.book_id === +bookId);
    loans.forEach(l => events.push({ type: 'loan', ts: new Date(l.requested_at).getTime(),
      status: l.status, label: 'Richiesta di prestito' }));

    // Like: scansiona tutti i likes_<userId>
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith('likes_'));
    allKeys.forEach(k => {
      const list = Storage.get(k, []) || [];
      if (list.includes(+bookId) || list.includes(bookId)) {
        // Nei sample i like non hanno timestamp; aggiungiamo "added"
        // come stima conservativa: il like è stato dato dopo l'aggiunta
        events.push({ type: 'like', ts: addedTs + 86400000, label: 'Like ricevuto' });
      }
    });

    events.sort((a, b) => a.ts - b.ts);

    // Aggrega per mese per il line chart cumulativo
    const start = new Date(addedTs); start.setDate(1); start.setHours(0,0,0,0);
    const endMs = nowTs;
    const monthLabels = [];
    const monthBuckets = { views: [], loans: [], likes: [] };
    let cursor = new Date(start);
    const cumul = { views: 0, loans: 0, likes: 0 };
    let safety = 0;
    while (cursor.getTime() <= endMs && safety++ < 120) {
      const monthEnd = new Date(cursor); monthEnd.setMonth(monthEnd.getMonth() + 1);
      const lo = cursor.getTime(), hi = monthEnd.getTime();
      events.forEach(e => {
        if (e.ts >= lo && e.ts < hi) {
          if (e.type === 'view') cumul.views++;
          else if (e.type === 'loan') cumul.loans++;
          else if (e.type === 'like') cumul.likes++;
        }
      });
      monthLabels.push(cursor.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }));
      monthBuckets.views.push(cumul.views);
      monthBuckets.loans.push(cumul.loans);
      monthBuckets.likes.push(cumul.likes);
      cursor = monthEnd;
    }

    const ageDays = Math.floor((nowTs - addedTs) / 86400000);

    return {
      book,
      events,
      monthLabels,
      monthBuckets,
      summary: {
        added_at: book.added,
        age_days: ageDays,
        total_views: views.length,
        total_loans: loans.length,
        total_likes: cumul.likes,
        completed_loans: loans.filter(l => l.status === 'returned').length,
        active_loans: loans.filter(l => ['requested','confirmed','borrowed','returning'].includes(l.status)).length
      }
    };
  },

  /** v2.3: Aggiorna i campi modificabili di un libro. Solo admin
      o proprietario. */
  updateBook(bookId, patch) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    const books = this.getBooks();
    const book = books.find(b => +b.id === +bookId);
    if (!book) return { ok: false, reason: 'not-found' };
    if (+book.owner_id !== +me.id && !me.is_admin) {
      return { ok: false, reason: 'forbidden' };
    }
    // Whitelist dei campi modificabili (no id, no views, no added)
    const allowed = ['title', 'author', 'year', 'language', 'isbn',
      'category', 'category_tags', 'available', 'description'];
    allowed.forEach(k => {
      if (patch[k] !== undefined) book[k] = patch[k];
    });
    Storage.set('books', books);
    return { ok: true, book };
  },

  /** v2.3: Aggiorna i campi modificabili di un utente. Solo admin
      può modificare altri utenti; un utente può solo modificare sé
      stesso (in pratica però gli utenti normali usano profile-setup,
      non questo metodo). */
  updateUser(userId, patch) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    if (+userId !== +me.id && !me.is_admin) {
      return { ok: false, reason: 'forbidden' };
    }
    const users = this.getUsers();
    const user = users.find(u => +u.id === +userId);
    if (!user) return { ok: false, reason: 'not-found' };
    const allowed = ['display_name', 'username', 'email', 'city',
      'bio', 'library_role', 'public_profile', 'account_type',
      'avatar_data_url'];  // v2.5: foto profilo personalizzata
    allowed.forEach(k => {
      if (patch[k] !== undefined) user[k] = patch[k];
    });
    Storage.set('users', users);
    return { ok: true, user };
  },

  /** v2.5: setta o cancella la foto profilo dell'utente corrente.
      `dataUrl` è un base64 data URL (o null per rimuovere).
      Il caller (UI) deve aver già ridimensionato l'immagine a un
      crop quadrato — qui salvo il data URL così com'è. */
  setUserAvatar(dataUrl) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    return this.updateUser(me.id, { avatar_data_url: dataUrl });
  },

  clearUserAvatar() {
    return this.setUserAvatar(null);
  },

  /** v2.3: Cancella un utente. Solo admin. Non può cancellare sé
      stesso (per evitare di rimanere senza admin). Cancella anche
      i libri e i dati collegati. */
  deleteUser(userId) {
    const me = this.getCurrentUser();
    if (!me || !me.is_admin) return { ok: false, reason: 'forbidden' };
    if (+userId === +me.id) return { ok: false, reason: 'cannot-delete-self' };
    const users = this.getUsers();
    const user = users.find(u => +u.id === +userId);
    if (!user) return { ok: false, reason: 'not-found' };
    // Cancella i libri di proprietà
    const books = this.getBooks();
    const userBookIds = books.filter(b => +b.owner_id === +userId).map(b => b.id);
    Storage.set('books', books.filter(b => +b.owner_id !== +userId));
    // Cancella i prestiti dove era coinvolto + view events sui libri
    // cancellati
    const loans = (Storage.get('loan_requests', []) || []).filter(l =>
      +l.requester_id !== +userId && +l.lender_id !== +userId &&
      !userBookIds.includes(l.book_id));
    Storage.set('loan_requests', loans);
    // Cancella le recensioni scritte e ricevute
    const reviews = (Storage.get('reviews', []) || []).filter(r =>
      +r.author_id !== +userId && +r.subject_id !== +userId);
    Storage.set('reviews', reviews);
    // Cancella view events sui libri cancellati
    const views = (Storage.get('book_views', []) || []).filter(v =>
      !userBookIds.includes(v.book_id));
    Storage.set('book_views', views);
    // Rimuovi utente
    Storage.set('users', users.filter(u => +u.id !== +userId));
    // Pulisci preferences / org profiles
    localStorage.removeItem(`profile_prefs_${userId}`);
    localStorage.removeItem(`org_profile_${userId}`);
    localStorage.removeItem(`follows_${userId}`);
    localStorage.removeItem(`likes_${userId}`);
    return { ok: true };
  },

  /** v2.3: Aggiunge un libro (usato dall'admin panel per inserire
      libri arbitrari). Stesso schema di addBook ma senza richiedere
      che l'owner sia l'utente corrente. */
  adminAddBook(data) {
    const me = this.getCurrentUser();
    if (!me || !me.is_admin) return { ok: false, reason: 'forbidden' };
    const books = this.getBooks();
    const newId = books.reduce((max, b) => Math.max(max, b.id), 0) + 1;
    const newBook = {
      id: newId,
      owner_id: +data.owner_id,
      title: data.title || 'Senza titolo',
      author: data.author || 'Autore sconosciuto',
      year: +data.year || new Date().getFullYear(),
      language: data.language || 'Italiano',
      isbn: data.isbn || '—',
      category: data.category || 'Narrativa',
      category_tags: data.category_tags || [data.category || 'Narrativa contemporanea'],
      description: data.description || '',
      condition: data.condition || 'buone',
      available: true,
      added: new Date().toISOString().slice(0, 10),
      views: 0,
      loan_requests: 0,
      cover_gradient: this.randomGradient()
    };
    books.push(newBook);
    Storage.set('books', books);
    return { ok: true, book: newBook };
  },

  /* ─────────────────────────────────────────────────────────────────
     v2.4: POSTS — annunci brevi degli utenti curatori
     ─────────────────────────────────────────────────────────────────
     Store: `posts` = [{id, author_id, content, created_at, reactions: {emoji: [userId,...]}, reports: [...]}]
     Vincolo di pubblicazione: solo utenti che hanno almeno un libro
     pubblicato (i Lettori puri non hanno voce in capitolo finché non
     diventano curatori — coerente col modello di v1.9). */

  /** v2.6: helper "freschezza" — un libro è considerato "novità" se
      è stato aggiunto da meno di 14 giorni. */
  isBookRecent(book, daysWindow = 14) {
    if (!book || !book.added) return false;
    const days = (Date.now() - new Date(book.added).getTime()) / 86400000;
    return days <= daysWindow;
  },

  /** v2.6: helper "libreria appena aperta" — la libreria è
      considerata "appena aperta" se l'utente si è iscritto da meno
      di 14 giorni. In produzione esisterebbe un campo dedicato
      `library_opened_at` da settare quando library_role passa a 'curator',
      ma per il prototipo usiamo `user.joined`. */
  isLibraryFresh(user, daysWindow = 14) {
    if (!user || !user.joined) return false;
    const days = (Date.now() - new Date(user.joined).getTime()) / 86400000;
    return days <= daysWindow;
  },

  REACTION_EMOJI: ['👍', '❤️', '👏', '🤔'],
  POST_MAX_LENGTH: 500,

  /** v2.6: messaggi di benvenuto gender-neutral. {name} viene sostituito
      col primo nome dell'utente. Rotazione: si sceglie una frase diversa
      per ogni nuovo login (login_count viene incrementato in authenticate).
      Niente "Bentornata/Bentornato" perché dicotomia di genere, niente
      formule che presuppongano un orario specifico. */
  WELCOME_MESSAGES: [
    'Ciao {name}, buona lettura.',
    'Eccoti, {name}.',
    'Bentornat* nella tua libreria, {name}.',
    'È bello rivederti, {name}.',
    'Si riapre il libro, {name}.',
    'Pronti a scoprire qualcosa, {name}?',
    'Avanti tutta, {name}.',
    'La pagina ti aspettava, {name}.',
    'Un nuovo capitolo ti attende, {name}.',
    'Quale libro ti chiamerà oggi, {name}?',
    'I tuoi libri ti hanno cercato, {name}.',
    'Tra gli scaffali c\'è movimento, {name}.',
    'La libreria diffusa ti dà il benvenuto, {name}.',
    'Si torna a sfogliare, {name}.',
    'Buon ritorno fra le pagine, {name}.',
    'Quante storie da scoprire oggi, {name}.',
    'La tua biblioteca ti riaccoglie, {name}.'
  ],

  /** Restituisce un messaggio di benvenuto per l'utente corrente,
      ruotando fra quelli disponibili in base a `welcome_index`
      (incrementato ad ogni login). */
  getWelcomeMessage(user) {
    if (!user) return '';
    const first = (user.display_name || user.username || '').split(' ')[0];
    const idx = (user.welcome_index || 0) % this.WELCOME_MESSAGES.length;
    return this.WELCOME_MESSAGES[idx].replace('{name}', first);
  },

  getPosts() {
    return (Storage.get('posts', []) || [])
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  getPostsByAuthor(userId) {
    return this.getPosts().filter(p => +p.author_id === +userId);
  },

  /** v2.6: serie temporali settimanali di attività per ciascuno dei
      top N utenti, da usare nel ridgeline chart della pagina stats.
      Per ogni utente: array di N_WEEKS interi (count totale eventi per
      settimana, eventi = libri pubblicati + prestiti + recensioni + messaggi).
      Restituisce { users: [{id, name, weeks: [int...]}, ...], labels: [...] }
      ordinato per attività totale decrescente. */
  getUserActivityRidgeline(limit = 10, weeks = 26) {
    const now = Date.now();
    const WEEK_MS = 7 * 86400 * 1000;
    const firstWeekStart = (() => {
      const d = new Date(now - (weeks - 1) * WEEK_MS);
      const day = d.getDay() || 7;
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (day - 1));
      return d.getTime();
    })();
    const weekIdxOf = (iso) => {
      if (!iso) return -1;
      const t = new Date(iso).getTime();
      if (isNaN(t)) return -1;
      const idx = Math.floor((t - firstWeekStart) / WEEK_MS);
      return (idx >= 0 && idx < weeks) ? idx : -1;
    };

    const users = this.getUsers().filter(u => !u.is_admin);
    const books = this.getBooks();
    const loans = Storage.get('loan_requests', []) || [];
    const reviews = Storage.get('reviews', []) || [];
    const messages = (Storage.get('loan_messages', []) || []).filter(m => m.type === 'user');

    const series = users.map(u => {
      const arr = new Array(weeks).fill(0);
      books.filter(b => +b.owner_id === u.id).forEach(b => {
        const i = weekIdxOf(b.added);
        if (i >= 0) arr[i]++;
      });
      loans.filter(l => +l.requester_id === u.id || +l.lender_id === u.id).forEach(l => {
        const i = weekIdxOf(l.requested_at);
        if (i >= 0) arr[i]++;
      });
      reviews.filter(r => +r.author_id === u.id).forEach(r => {
        const i = weekIdxOf(r.created_at);
        if (i >= 0) arr[i]++;
      });
      messages.filter(m => +m.sender_id === u.id).forEach(m => {
        const i = weekIdxOf(m.created_at);
        if (i >= 0) arr[i]++;
      });
      const total = arr.reduce((a, b) => a + b, 0);
      return { id: u.id, name: u.display_name, username: u.username,
               city: u.city, weeks: arr, total };
    });

    series.sort((a, b) => b.total - a.total);

    // Etichette: ogni 4 settimane mostra il mese
    const labels = [];
    for (let i = 0; i < weeks; i++) {
      const d = new Date(firstWeekStart + i * WEEK_MS);
      labels.push(i % 4 === 0
        ? d.toLocaleDateString('it-IT', { month: 'short' })
        : '');
    }

    return {
      users: series.slice(0, limit),
      labels,
      maxValue: series.length > 0
        ? Math.max(1, ...series.slice(0, limit).flatMap(s => s.weeks))
        : 1
    };
  },

  /** v2.4: Feed cronologico dei post degli utenti seguiti dal current
      user, ordinato per data. Usato in home.html ("Aggiornamenti recenti").
      v2.6: NON include i post propri (l'utente vede i propri post nella
      tab "Post" del suo profilo, qui vuole solo quello che fanno gli altri). */
  getPostsFromFollowed(userId, limit = 20) {
    const follows = Storage.get(`follows_${userId}`, []) || [];
    const ids = new Set(follows.map(Number));
    return this.getPosts()
      .filter(p => ids.has(+p.author_id))
      .slice(0, limit);
  },

  /** Verifica se l'utente può pubblicare post. Requisito: avere
      almeno un libro pubblicato (è il "diritto di parola" del
      curatore — chi non ha condiviso nulla, non parla ancora). */
  canPublishPosts(userId) {
    if (!userId) return false;
    const books = this.getBooks();
    return books.some(b => +b.owner_id === +userId);
  },

  /** Crea un post. Validazioni: utente autenticato, può pubblicare,
      contenuto non vuoto e ≤500 char. Notifica i follower. */
  createPost(content) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    if (!this.canPublishPosts(me.id)) return { ok: false, reason: 'no-books' };
    const text = (content || '').trim();
    if (!text) return { ok: false, reason: 'empty' };
    if (text.length > this.POST_MAX_LENGTH) return { ok: false, reason: 'too-long' };

    const posts = Storage.get('posts', []) || [];
    const newPost = {
      id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6),
      author_id: me.id,
      content: text,
      created_at: new Date().toISOString(),
      reactions: {},   // mappa emoji → [userId, userId, ...]
      reports: []      // array di {reporter_id, reason, note, ts}
    };
    posts.push(newPost);
    Storage.set('posts', posts);

    // Notifica i follower
    const allUsers = this.getUsers();
    allUsers.forEach(u => {
      if (+u.id === +me.id) return;
      const theirFollows = Storage.get(`follows_${u.id}`, []) || [];
      if (theirFollows.map(Number).includes(+me.id)) {
        this.addNotification(u.id, {
          type: 'new_post',
          actor_id: me.id,
          post_id: newPost.id,
          message: `<strong>${me.display_name}</strong> ha pubblicato un nuovo aggiornamento.`,
          created_at: newPost.created_at
        });
      }
    });

    return { ok: true, post: newPost };
  },

  /** Elimina un post. Solo autore o admin. */
  deletePost(postId) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    const posts = Storage.get('posts', []) || [];
    const post = posts.find(p => p.id === postId);
    if (!post) return { ok: false, reason: 'not-found' };
    if (+post.author_id !== +me.id && !me.is_admin) {
      return { ok: false, reason: 'forbidden' };
    }
    Storage.set('posts', posts.filter(p => p.id !== postId));
    return { ok: true };
  },

  /** Aggiunge/sostituisce/rimuove la reazione dell'utente al post.
      Un utente può lasciare al massimo una reazione per post. Se
      clicca la stessa emoji che ha già lasciato → rimuove. Se ne
      clicca una diversa → sostituisce. */
  togglePostReaction(postId, emoji) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    if (!this.REACTION_EMOJI.includes(emoji)) {
      return { ok: false, reason: 'invalid-emoji' };
    }
    const posts = Storage.get('posts', []) || [];
    const post = posts.find(p => p.id === postId);
    if (!post) return { ok: false, reason: 'not-found' };

    post.reactions = post.reactions || {};
    // Rimuovi reazione esistente dell'utente (in qualsiasi emoji)
    let hadSame = false;
    this.REACTION_EMOJI.forEach(em => {
      if (!post.reactions[em]) return;
      const idx = post.reactions[em].indexOf(me.id);
      if (idx >= 0) {
        if (em === emoji) hadSame = true;
        post.reactions[em].splice(idx, 1);
        if (post.reactions[em].length === 0) delete post.reactions[em];
      }
    });
    // Se non era la stessa emoji, aggiungi la nuova
    if (!hadSame) {
      if (!post.reactions[emoji]) post.reactions[emoji] = [];
      post.reactions[emoji].push(me.id);
    }
    Storage.set('posts', posts);
    return { ok: true, post };
  },

  /** Quale reazione (se esiste) ha lasciato l'utente per il post. */
  getUserReaction(postId, userId) {
    const post = (Storage.get('posts', []) || []).find(p => p.id === postId);
    if (!post || !post.reactions) return null;
    for (const em of this.REACTION_EMOJI) {
      if ((post.reactions[em] || []).includes(+userId)) return em;
    }
    return null;
  },

  /** Segnalazione di un post come contenuto inappropriato. Salva il
      motivo per la revisione admin. Un utente può segnalare lo
      stesso post una sola volta. */
  reportPost(postId, reason, note = '') {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    const posts = Storage.get('posts', []) || [];
    const post = posts.find(p => p.id === postId);
    if (!post) return { ok: false, reason: 'not-found' };
    post.reports = post.reports || [];
    if (post.reports.some(r => +r.reporter_id === +me.id)) {
      return { ok: false, reason: 'already-reported' };
    }
    post.reports.push({
      reporter_id: me.id,
      reason: reason || 'altro',
      note: (note || '').trim().slice(0, 300),
      ts: new Date().toISOString()
    });
    Storage.set('posts', posts);
    return { ok: true };
  },

  /** Per il pannello admin: tutti i post segnalati con almeno 1 report. */
  getReportedPosts() {
    return this.getPosts().filter(p => (p.reports || []).length > 0);
  },

  /** Admin: archivia tutte le segnalazioni del post (lo lascia online). */
  clearPostReports(postId) {
    const me = this.getCurrentUser();
    if (!me || !me.is_admin) return { ok: false, reason: 'forbidden' };
    const posts = Storage.get('posts', []) || [];
    const post = posts.find(p => p.id === postId);
    if (!post) return { ok: false, reason: 'not-found' };
    post.reports = [];
    Storage.set('posts', posts);
    return { ok: true };
  },

  /** v2.6: Selezione "in evidenza" della settimana.
      Algoritmo ispirato a Reddit Hot + Hacker News, adattato al
      contesto del book sharing. Per ogni libro disponibile calcola:

        trend_score = (views_7d × 1 + loans_7d × 3 + likes × 2)
                      × quality_multiplier
                      ÷ (days_since_added + 7) ^ 0.5

      quality_multiplier = 1 + 0.4 × (avg_rating - 3) / 2
      (in [0.6, 1.4] se rating presente; 1 se nessuna recensione).

      Diversity penalty: i candidati di una categoria già selezionata
      2+ volte vengono moltiplicati ×0.5 (evita dominanza di un genere).

      I prestiti pesano 3× perché sono il segnale più forte di interesse
      ("qualcuno ha davvero voluto leggerlo"); le views 1×; like 2×.
      Decay sqrt(days+7) mantiene libri vecchi ma attivi, fa emergere
      libri freschi con picco di engagement. */
  getFeaturedBooks(limit = 4) {
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 86400 * 1000;
    const sevenDaysAgo = now - SEVEN_DAYS_MS;

    const books = this.getBooks().filter(b => b.available);
    const views = Storage.get('book_views', []) || [];
    const loans = Storage.get('loan_requests', []) || [];
    const reviews = Storage.get('reviews', []) || [];
    const allLikes = Object.keys(localStorage)
      .filter(k => k.startsWith('likes_'))
      .reduce((acc, k) => {
        const arr = Storage.get(k, []) || [];
        arr.forEach(bookId => { acc[bookId] = (acc[bookId] || 0) + 1; });
        return acc;
      }, {});

    const candidates = books.map(book => {
      const bookViews = views.filter(v =>
        +v.book_id === +book.id && new Date(v.ts).getTime() > sevenDaysAgo).length;
      const bookLoans = loans.filter(l =>
        +l.book_id === +book.id && new Date(l.requested_at).getTime() > sevenDaysAgo).length;
      const bookLikes = allLikes[book.id] || 0;
      const ownerReviews = reviews.filter(r => +r.subject_id === +book.owner_id);
      const avgRating = ownerReviews.length
        ? ownerReviews.reduce((s, r) => s + r.rating, 0) / ownerReviews.length
        : 3;
      const qualityMultiplier = 1 + 0.4 * (avgRating - 3) / 2;
      const daysOld = Math.max(0,
        Math.floor((now - new Date(book.added).getTime()) / 86400000));
      const decay = Math.sqrt(daysOld + 7);
      const rawScore = (bookViews * 1 + bookLoans * 3 + bookLikes * 2)
        * qualityMultiplier / decay;

      return {
        book, trend_score: rawScore,
        recent_views: bookViews, recent_loans: bookLoans,
        likes: bookLikes, avg_rating: avgRating, days_old: daysOld
      };
    });

    candidates.sort((a, b) => b.trend_score - a.trend_score);

    // Diversity penalty
    const selected = [];
    const categoryCount = {};
    for (const c of candidates) {
      const cat = c.book.category;
      if ((categoryCount[cat] || 0) >= 2) {
        c.trend_score *= 0.5;
        c.diversity_penalized = true;
      }
      selected.push(c);
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }
    selected.sort((a, b) => b.trend_score - a.trend_score);

    // Fallback se nessuna attività recente: per non avere classifica
    // vuota appena dopo il seed, ripiega sulle book.views storiche.
    if (selected.length > 0 && selected[0].trend_score === 0) {
      return books
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, limit)
        .map(book => ({
          book, trend_score: 0,
          recent_views: 0, recent_loans: 0, likes: 0,
          avg_rating: 3, days_old: 0, fallback: true
        }));
    }
    return selected.slice(0, limit);
  },

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

  /* ─────────────────────────────────────────────────────────────────
     v2.2: Statistiche per la nuova pagina stats.html
     ───────────────────────────────────────────────────────────────── */

  /** KPI calcolati al 100% sui dati persistiti — niente seed o mock.
      v2.3: include anche `total_views` ora che il view-tracking è
      reale (book_views[] events). */
  getRealStats() {
    const books = this.getBooks();
    const users = this.getUsers().filter(u => !u.is_admin);
    const loans = Storage.get('loan_requests', []) || [];
    const reviews = Storage.get('reviews', []) || [];
    const messages = (Storage.get('loan_messages', []) || []).filter(m => m.type === 'user');
    const notifications = Object.values(Storage.get('notifications', {}) || {})
      .reduce((a, arr) => a.concat(arr || []), []);
    const viewEvents = Storage.get('book_views', []) || [];
    return {
      total_books: books.length,
      total_users: users.length,
      total_loans: loans.length,
      completed_loans: loans.filter(l => l.status === 'returned').length,
      active_loans: loans.filter(l => ['requested','confirmed','borrowed','returning'].includes(l.status)).length,
      total_reviews: reviews.length,
      total_messages: messages.length,
      total_notifications: notifications.length,
      total_views: viewEvents.length,
      avg_views_per_book: books.length ? Math.round(viewEvents.length / books.length) : 0,
      avg_rating: reviews.length
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2)
        : null,
      curators_count: users.filter(u => u.library_role === 'curator').length,
      borrowers_count: users.filter(u => u.library_role === 'borrower').length
    };
  },

  /** v2.3: kept for backward compat. Vuoto perché tutto è reale ora. */
  getSimulatedStats() {
    return {};
  },

  /** v2.2: Timeline reale di attività della piattaforma, aggregata
      per settimana, derivata da TIMESTAMP reali di eventi persistenti:
      libri pubblicati (book.added), prestiti richiesti (loan.requested_at),
      recensioni (review.created_at), messaggi (m.created_at).
      Ritorna [{ weekStart, totals: {books, loans, reviews, messages}, total }]
      per le ultime 12 settimane. */
  getActivityTimeline() {
    const now = Date.now();
    const WEEK_MS = 7 * 86400 * 1000;
    const WEEKS = 12;

    // Bucketing helper: data → "lunedì della settimana"
    const weekStartOf = (iso) => {
      if (!iso) return null;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      const day = d.getDay() || 7;            // dom=0 → 7
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (day - 1));
      return d.getTime();
    };

    // Inizializza buckets vuoti per le ultime WEEKS settimane
    const firstWeekStart = weekStartOf(new Date(now - (WEEKS - 1) * WEEK_MS).toISOString());
    const buckets = [];
    for (let i = 0; i < WEEKS; i++) {
      buckets.push({
        weekStart: firstWeekStart + i * WEEK_MS,
        books: 0, loans: 0, reviews: 0, messages: 0, total: 0
      });
    }
    const placeIn = (ts, kind) => {
      if (!ts) return;
      const idx = Math.floor((ts - firstWeekStart) / WEEK_MS);
      if (idx >= 0 && idx < WEEKS) {
        buckets[idx][kind]++;
        buckets[idx].total++;
      }
    };

    this.getBooks().forEach(b => placeIn(weekStartOf(b.added), 'books'));
    (Storage.get('loan_requests', []) || []).forEach(l => placeIn(weekStartOf(l.requested_at), 'loans'));
    (Storage.get('reviews', []) || []).forEach(r => placeIn(weekStartOf(r.created_at), 'reviews'));
    (Storage.get('loan_messages', []) || []).filter(m => m.type === 'user')
      .forEach(m => placeIn(weekStartOf(m.created_at), 'messages'));

    return buckets;
  },

  /** v2.2: Distribuzione BISAC GERARCHICA: per ogni macro-genere
      restituisce il conteggio totale + breakdown per sotto-genere.
      Usata dal sunburst sulla pagina stats. */
  getBisacHierarchy() {
    const books = this.getBooks();
    const macros = {};

    // Inizializza tutti i macro-generi anche se vuoti (per coerenza visiva)
    Object.keys(BISAC_CATEGORIES).forEach(macro => {
      macros[macro] = { name: macro, count: 0, children: {} };
      BISAC_CATEGORIES[macro].forEach(sub => {
        macros[macro].children[sub] = 0;
      });
    });

    books.forEach(book => {
      const tags = book.category_tags || [book.category];
      tags.forEach(tag => {
        const macro = BISAC_PARENT[tag];
        if (macro && macros[macro]) {
          macros[macro].count++;
          if (macros[macro].children[tag] !== undefined) {
            macros[macro].children[tag]++;
          }
        }
      });
    });

    // Ordina i macro per count discendente, filtra i vuoti
    return Object.values(macros)
      .filter(m => m.count > 0)
      .map(m => ({
        name: m.name,
        count: m.count,
        children: Object.entries(m.children)
          .filter(([, c]) => c > 0)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      }))
      .sort((a, b) => b.count - a.count);
  },

  /** v2.2: Matrice di co-occorrenza 11×11 (macro × macro) per
      visualizzare le INTERSEZIONI fra generi: quante volte due
      macro-categorie compaiono nello stesso libro. La diagonale
      è il conteggio "puro" della categoria. */
  getCategoryCooccurrence() {
    const books = this.getBooks();
    const macros = Object.keys(BISAC_CATEGORIES);
    // Matrice indicizzata per nome
    const matrix = {};
    macros.forEach(m1 => {
      matrix[m1] = {};
      macros.forEach(m2 => { matrix[m1][m2] = 0; });
    });

    books.forEach(book => {
      const tags = book.category_tags || [book.category];
      const bookMacros = [...new Set(tags
        .map(t => BISAC_PARENT[t])
        .filter(Boolean))];
      // Per ogni coppia (incluso (m,m) sulla diagonale)
      bookMacros.forEach(m1 => {
        bookMacros.forEach(m2 => {
          matrix[m1][m2]++;
        });
      });
    });

    return { macros, matrix };
  },

  /** v2.2: Top libri con micro-timeline: per ognuno, il numero di
      "interazioni" (richieste prestito + like) per ciascuno degli
      ultimi 12 mesi. Usato per renderizzare mini sparkline accanto
      al titolo nelle classifiche. */
  getTopBooksWithTimeline(limit = 8) {
    const books = this.getBooks();
    const loans = Storage.get('loan_requests', []) || [];
    const likes = Storage.get('book_likes', {}) || {};

    const now = new Date(); now.setDate(1); now.setHours(0,0,0,0);
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      months.push({ year: d.getFullYear(), month: d.getMonth(), start: d.getTime() });
    }
    const monthIndexOf = (iso) => {
      if (!iso) return -1;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return -1;
      for (let i = months.length - 1; i >= 0; i--) {
        if (d.getTime() >= months[i].start) return i;
      }
      return -1;
    };

    const ranked = books.map(book => {
      const timeline = new Array(12).fill(0);
      // Conta richieste di prestito per il libro
      loans.filter(l => +l.book_id === +book.id).forEach(l => {
        const idx = monthIndexOf(l.requested_at);
        if (idx >= 0) timeline[idx]++;
      });
      // Conta i like (timestampati nel formato {userId: ts})
      const bookLikes = likes[book.id] || {};
      Object.values(bookLikes).forEach(ts => {
        const idx = monthIndexOf(ts);
        if (idx >= 0) timeline[idx]++;
      });
      const totalInteractions = timeline.reduce((a, b) => a + b, 0);
      return {
        ...book,
        timeline,
        total_interactions: totalInteractions
      };
    });

    return ranked
      .sort((a, b) => b.total_interactions - a.total_interactions
        || (b.views || 0) - (a.views || 0))
      .slice(0, limit);
  },

  /** v2.2: Top utenti più attivi della piattaforma. Combina più
      metriche per dare una vista pluri-dimensionale. */
  getTopUsers(limit = 8) {
    const users = this.getUsers().filter(u => !u.is_admin);
    const books = this.getBooks();
    const loans = Storage.get('loan_requests', []) || [];
    const reviews = Storage.get('reviews', []) || [];
    const follows = Storage.get('follows', {}) || {};

    const userStats = users.map(u => {
      const myBooks = books.filter(b => +b.owner_id === u.id);
      const myCompletedLoans = loans.filter(l =>
        l.status === 'returned' &&
        (+l.requester_id === u.id || +l.lender_id === u.id)).length;
      const myReviews = reviews.filter(r => +r.author_id === u.id).length;
      const myFollowers = Object.values(follows)
        .filter(set => Array.isArray(set) && set.includes(u.id)).length;
      return {
        id: u.id,
        name: u.display_name,
        username: u.username,
        city: u.city,
        books_count: myBooks.length,
        completed_loans: myCompletedLoans,
        reviews_written: myReviews,
        followers: myFollowers,
        // Punteggio composito per il ranking principale
        score: myCompletedLoans * 3 + myReviews * 2 + myBooks.length + myFollowers
      };
    });

    return {
      by_score: [...userStats].sort((a, b) => b.score - a.score).slice(0, limit),
      by_loans: [...userStats].sort((a, b) => b.completed_loans - a.completed_loans).slice(0, limit),
      by_reviews: [...userStats].sort((a, b) => b.reviews_written - a.reviews_written).slice(0, limit),
      by_books: [...userStats].sort((a, b) => b.books_count - a.books_count).slice(0, limit),
      by_followers: [...userStats].sort((a, b) => b.followers - a.followers).slice(0, limit)
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
  /* v2.2: Autenticazione "soft" per il prototipo.
     Verifica username|email + password contro l'array users.
     In produzione qui ci sarebbe POST /api/login con bcrypt + JWT.
     Per il prototipo:
       - admin/admin → match esatto della password (unico con credenziali "vere")
       - chiunque altro → accetta qualsiasi password ≥8 char (siamo in demo)
     Ritorna {ok, user} o {ok: false, reason}. */
  authenticate(usernameOrEmail, password) {
    const id = (usernameOrEmail || '').trim().toLowerCase();
    if (!id || !password) return { ok: false, reason: 'missing-credentials' };
    const user = this.getUsers().find(u =>
      (u.username || '').toLowerCase() === id ||
      (u.email || '').toLowerCase() === id);
    if (!user) return { ok: false, reason: 'user-not-found' };
    // TODO(alpha): rimuovere validazione mock e sostituire con
    // bcrypt.compare(password, user.password_hash) lato backend.
    // Il prototipo accetta admin/admin per is_admin, qualsiasi
    // password ≥8 char per gli altri utenti.
    if (user.is_admin) {
      if (password !== 'admin') return { ok: false, reason: 'wrong-password' };
    } else {
      if (password.length < 8) return { ok: false, reason: 'password-too-short' };
    }
    Storage.set('current_user_id', user.id);
    this.setAuthState('user');
    // v2.6: incrementa welcome_index per ruotare il messaggio di
    // benvenuto sulla home ad ogni nuovo login
    const users = this.getUsers();
    const u = users.find(x => +x.id === +user.id);
    if (u) {
      u.welcome_index = ((u.welcome_index || 0) + 1) % this.WELCOME_MESSAGES.length;
      Storage.set('users', users);
    }
    return { ok: true, user: u || user };
  },

  /** v2.2: Gate amministrativo — reindirizza al login se non auth,
      o alla home se auth ma non admin. */
  requireAdmin(redirectIfMissing = 'login.html', redirectIfForbidden = 'index.html') {
    const me = this.getCurrentUser();
    if (!me) { location.href = redirectIfMissing; return null; }
    if (!me.is_admin) { location.href = redirectIfForbidden; return null; }
    return me;
  },

  setAuthState(state) {
    if (state !== 'user' && state !== 'guest') return;
    Storage.set('auth_state', state);
    document.body.dataset.authState = state;
  },
  /* Utente attualmente "loggato". In modalità autenticata restituisce
     l'utente il cui id è memorizzato in current_user_id (default: 1,
     Chiara Morandi). Dopo una registrazione, current_user_id viene
     aggiornato così il nuovo iscritto diventa l'utente corrente. */
  getCurrentUser() {
    if (this.getAuthState() !== 'user') return null;
    const id = Storage.get('current_user_id', 1);
    return this.getUser(id) || this.getUser(1);
  },
  setCurrentUser(userId) {
    Storage.set('current_user_id', userId);
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

     TODO(alpha): in Alpha la posizione fallback hard-coded di Napoli
     non sarà più accettabile. Comportamento atteso:
       1) Al primo login chiedere consenso geolocalizzazione browser
       2) Se concesso → salvare coordinate utente in user.location
       3) Se negato → mostrare campo city/CAP testuale, geocoding
          server-side (Nominatim self-host via Docker o servizio esterno)
       4) Nessun fallback hard-coded: senza coords → niente "vicino a te"
          ma offrire ricerca per città testuale.
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
     del tema, il glifo da stampare al centro, e la grafica di
     copertina (15 design selezionabili — v1.1).
     ------------------------------------------------------------- */
  libraryCoverData(user, prefs) {
    prefs = prefs || this.getProfilePrefs(user.id);
    const themeClass = `cover--${prefs.theme || 'classic'}`;
    const glyph = prefs.avatar_style === 'symbol'
      ? (prefs.avatar_symbol || '§')
      : (user.display_name || user.username || '?').trim()[0].toUpperCase();

    /* Grafica cover: usa la scelta dell'utente se presente; altrimenti
       default diverso per tipo libreria (enti → 'i-shelf' più
       istituzionale, personali → 'g-section' più decorativo). */
    const defaultKey = this.isOrganization(user) ? 'i-shelf' : 'g-section';
    const designKey  = prefs.cover_design || defaultKey;
    const design = LIBRARY_COVER_DESIGN_MAP[designKey] || LIBRARY_COVER_DESIGN_MAP[defaultKey];

    /* Per il design monogramma serve la lettera iniziale del nome */
    const letter = (user.display_name || user.username || '?').trim()[0].toUpperCase();

    return { themeClass, glyph, design, designKey, letter };
  },

  /* Restituisce il markup SVG della grafica cover scelta. Riusato sia
     dalle card "Librerie vicine" sia dal picker in profile-setup. */
  renderLibraryCoverArt(designKeyOrUser, letter = 'A') {
    const key = typeof designKeyOrUser === 'string' ? designKeyOrUser : 'g-section';
    const design = LIBRARY_COVER_DESIGN_MAP[key] || LIBRARY_COVER_DESIGN_MAP['g-section'];
    return `<svg class="cover-art" viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice"
                  xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              ${design.render({ letter })}
            </svg>`;
  },

  /* =============================================================
     ORGANIZZAZIONI — librerie-ente
     ============================================================= */

  /** Vero se l'utente è una libreria-ente (associazione, biblioteca…) */
  isOrganization(user) {
    return !!user && user.account_type === 'organization';
  },

  /** Profilo esteso dell'ente (null per le persone) */
  getOrgProfile(userId) {
    return Storage.get(`org_profile_${userId}`, null);
  },
  setOrgProfile(userId, profile) {
    Storage.set(`org_profile_${userId}`, profile);
  },

  /* Ruolo della libreria: 'curator' (cura volumi propri) oppure
     'borrower' (iscritto per prendere in prestito). Chi ha pubblicato
     almeno un volume è considerato curatore a prescindere dal valore
     memorizzato — pubblicare un libro "promuove" di fatto il lettore. */
  getLibraryRole(userId) {
    const stored = (this.getProfilePrefs(userId) || {}).library_role || 'curator';
    if (stored === 'borrower' && this.getBooksByOwner(userId).length > 0) {
      return 'curator';
    }
    return stored;
  },
  isBorrower(userId) {
    return this.getLibraryRole(userId) === 'borrower';
  },

  /* =============================================================
     SOCIAL — FOLLOW di utenti/librerie
     Modello: array di id seguiti per ciascun utente
     (follows_{userId}). In produzione → tabella user_follows.
     ============================================================= */
  getFollows(userId) {
    return Storage.get(`follows_${userId}`, []);
  },
  isFollowing(followerId, targetId) {
    return this.getFollows(followerId).includes(+targetId);
  },
  /** Numero di follower mostrato: base di esempio + l'utente corrente */
  getFollowerCount(targetId) {
    const base = SAMPLE_FOLLOWER_BASE[targetId] || 0;
    const me = this.getCurrentUser();
    const meFollows = me && me.id !== +targetId && this.isFollowing(me.id, targetId);
    return base + (meFollows ? 1 : 0);
  },
  /** L'utente corrente inizia a seguire targetId. Genera le notifiche
      "recupero attività recente" della libreria seguita. */
  followUser(targetId) {
    const me = this.requireAuthSilent();
    if (!me || me.id === +targetId) return false;
    const list = this.getFollows(me.id);
    if (!list.includes(+targetId)) {
      list.push(+targetId);
      Storage.set(`follows_${me.id}`, list);
      this.generateFollowNotifications(me.id, +targetId);
    }
    return true;
  },
  unfollowUser(targetId) {
    const me = this.requireAuthSilent();
    if (!me) return false;
    Storage.set(`follows_${me.id}`, this.getFollows(me.id).filter(id => id !== +targetId));
    // Pulizia: rimuove le notifiche provenienti da quella libreria
    this.removeNotificationsFromActor(me.id, +targetId);
    return true;
  },
  toggleFollow(targetId) {
    return this.isFollowing((this.getCurrentUser() || {}).id, targetId)
      ? (this.unfollowUser(targetId), false)
      : (this.followUser(targetId), true);
  },
  /** Le librerie seguite dall'utente, come oggetti utente */
  getFollowedLibraries(userId) {
    return this.getFollows(userId).map(id => this.getUser(id)).filter(Boolean);
  },

  /* =============================================================
     SOCIAL — LIKE ai volumi
     Modello: array di id libro per ciascun utente (likes_{userId}).
     In produzione → tabella book_likes.
     ============================================================= */
  getLikes(userId) {
    return Storage.get(`likes_${userId}`, []);
  },
  isLiked(userId, bookId) {
    return this.getLikes(userId).includes(+bookId);
  },
  /** Conteggio "mi piace" mostrato: base derivata dalle visualizzazioni
      + l'utente corrente se ha messo like. */
  getLikeCount(bookId) {
    const book = this.getBook(bookId);
    const base = book ? Math.max(1, Math.round((book.views || 0) / 18)) : 0;
    const me = this.getCurrentUser();
    return base + (me && this.isLiked(me.id, bookId) ? 1 : 0);
  },
  toggleLike(bookId) {
    const me = this.requireAuthSilent();
    if (!me) return null;                 // gestito dal chiamante (richiede login)
    const list = this.getLikes(me.id);
    const i = list.indexOf(+bookId);
    if (i >= 0) { list.splice(i, 1); }
    else        { list.push(+bookId); }
    Storage.set(`likes_${me.id}`, list);
    return i < 0;                         // true = ora piace
  },
  /** I libri a cui l'utente ha messo like, come oggetti libro */
  getLikedBooks(userId) {
    return this.getLikes(userId).map(id => this.getBook(id)).filter(Boolean);
  },

  /* =============================================================
     NOTIFICHE — alimentano la campanella nell'header
     Tipi: 'new_book' (nuovo volume da una libreria seguita),
           'profile_update' (la libreria ha aggiornato le info),
           'book_available' (un volume con like è tornato disponibile).
     In produzione → tabella notifications (con read_at).
     ============================================================= */
  getNotifications(userId) {
    return Storage.get(`notifications_${userId}`, [])
      .slice()
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },
  getUnreadCount(userId) {
    return this.getNotifications(userId).filter(n => !n.read).length;
  },
  addNotification(userId, notif) {
    const list = Storage.get(`notifications_${userId}`, []);
    list.push(Object.assign({
      id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6),
      read: false,
      created_at: new Date().toISOString()
    }, notif));
    Storage.set(`notifications_${userId}`, list);
  },
  markAllNotificationsRead(userId) {
    const list = Storage.get(`notifications_${userId}`, []);
    list.forEach(n => n.read = true);
    Storage.set(`notifications_${userId}`, list);
  },

  /** v1.7: Esporta tutti i dati dell'utente in un singolo oggetto JSON.
      Implementa il diritto di portabilità GDPR (art. 20). Include solo
      dati dell'utente o di cui è partecipante (non quelli privati altrui).
      Restituisce un oggetto serializzabile direttamente in JSON.stringify. */
  exportUserData(userId) {
    const uid = +userId;
    const user = this.getUser(uid);
    if (!user) return null;

    // Prestiti: tutti quelli dove l'utente è uno dei due partecipanti
    const allLoans = Storage.get('loan_requests', []) || [];
    const myLoans = allLoans.filter(l =>
      +l.requester_id === uid || +l.lender_id === uid);
    const loanIds = new Set(myLoans.map(l => l.id));

    // Messaggi: solo quelli dei prestiti dell'utente
    const allMessages = Storage.get('loan_messages', []) || [];
    const myMessages = allMessages.filter(m => loanIds.has(+m.loan_id));

    // Recensioni: ricevute (target=me) + scritte (reviewer=me)
    const allReviews = Storage.get('reviews', []) || [];
    const myReviewsReceived = allReviews.filter(r => +r.target_user_id === uid);
    const myReviewsWritten = allReviews.filter(r => +r.reviewer_id === uid);

    // Notifiche personali
    const myNotifications = Storage.get(`notifications_${uid}`, []) || [];

    // Libri pubblicati dall'utente
    const myBooks = (Storage.get('books', []) || [])
      .filter(b => +b.owner_id === uid);

    // Email simulate dei prestiti dell'utente
    const allEmails = Storage.get('simulated_emails', []) || [];
    const myEmails = allEmails.filter(e => loanIds.has(+e.loan_id));

    return {
      _meta: {
        exported_at: new Date().toISOString(),
        platform: 'Libreria Diffusa',
        version: Storage.DATA_VERSION,
        gdpr_note: 'Esportazione conforme al diritto di portabilità (GDPR art. 20). ' +
                   'Contiene esclusivamente dati che ti riguardano direttamente.'
      },
      user: user,
      preferences: Storage.get(`profile_prefs_${uid}`) || null,
      org_profile: Storage.get(`org_profile_${uid}`) || null,
      books: myBooks,
      loans: {
        as_requester: myLoans.filter(l => +l.requester_id === uid),
        as_lender:    myLoans.filter(l => +l.lender_id === uid)
      },
      messages: myMessages,
      reviews: {
        received: myReviewsReceived,
        written: myReviewsWritten
      },
      follows: Storage.get(`follows_${uid}`) || [],
      likes:   Storage.get(`likes_${uid}`)   || [],
      notifications: myNotifications,
      simulated_emails: myEmails
    };
  },
  removeNotificationsFromActor(userId, actorId) {
    Storage.set(`notifications_${userId}`,
      Storage.get(`notifications_${userId}`, []).filter(n => n.actor_id !== +actorId));
  },
  /** Genera le notifiche di "recupero" quando si inizia a seguire una
      libreria: i suoi volumi più recenti + (per gli enti) un avviso di
      aggiornamento informazioni. Simula in modo credibile il flusso che
      in produzione sarebbe alimentato in tempo reale dal backend. */
  generateFollowNotifications(userId, targetId) {
    const target = this.getUser(targetId);
    if (!target) return;
    // Evita duplicati: prima rimuove eventuali notifiche già presenti da questo attore
    this.removeNotificationsFromActor(userId, targetId);

    const recent = this.getBooksByOwner(targetId)
      .slice()
      .sort((a, b) => (b.added || '').localeCompare(a.added || ''))
      .slice(0, 2);

    recent.forEach(b => {
      this.addNotification(userId, {
        type: 'new_book',
        actor_id: targetId,
        book_id: b.id,
        message: `<strong>${target.display_name}</strong> ha pubblicato «${b.title}»`,
        created_at: (b.added || new Date().toISOString().slice(0, 10)) + 'T10:00:00'
      });
    });

    // Per gli enti, un avviso di aggiornamento informazioni
    if (this.isOrganization(target)) {
      this.addNotification(userId, {
        type: 'profile_update',
        actor_id: targetId,
        book_id: null,
        message: `<strong>${target.display_name}</strong> ha aggiornato le informazioni della libreria`,
        created_at: new Date(Date.now() - 2 * 86400000).toISOString()
      });
    }
  },
  /** Variante "silenziosa" di requireAuth: restituisce l'utente o null
      senza reindirizzare (per azioni come follow/like). */
  requireAuthSilent() {
    return this.getCurrentUser();
  },

  /** Popola una volta sola le notifiche dimostrative per l'utente di
      esempio: attività recente delle librerie già seguite + un volume
      con like tornato disponibile. Le notifiche più vecchie di una
      settimana vengono marcate come lette, per un conteggio realistico. */
  seedSocialDemo() {
    if (Storage.get('_social_demo_done')) return;
    const demoUserId = 1;

    // Notifiche dalle librerie seguite di default
    this.getFollows(demoUserId).forEach(targetId =>
      this.generateFollowNotifications(demoUserId, targetId));

    // Un volume con "like" tornato disponibile (dimostra il tipo book_available)
    const likedAvailable = this.getLikedBooks(demoUserId).find(b => b.available);
    if (likedAvailable) {
      this.addNotification(demoUserId, {
        type: 'book_available',
        actor_id: this.getBook(likedAvailable.id).owner_id,
        book_id: likedAvailable.id,
        message: `Il volume «${likedAvailable.title}», fra i tuoi preferiti, è di nuovo disponibile per il prestito`,
        created_at: new Date(Date.now() - 4 * 3600000).toISOString()   // 4 ore fa
      });
    }

    // Realismo: marca come lette le notifiche più vecchie di 7 giorni
    const weekAgo = Date.now() - 7 * 86400000;
    const list = Storage.get(`notifications_${demoUserId}`, []);
    list.forEach(n => { if (new Date(n.created_at).getTime() < weekAgo) n.read = true; });
    Storage.set(`notifications_${demoUserId}`, list);

    Storage.set('_social_demo_done', true);
  },

  /** Etichetta leggibile della categoria di ente */
  orgCategoryLabel(key) {
    return ORG_CATEGORIES[key] || ORG_CATEGORIES.altro;
  },

  /* =============================================================
     PROTEZIONE / PROPRIETÀ
     Un utente può modificare SOLO la propria libreria. Tutte le
     pagine di gestione (profile, profile-setup, add-book) passano
     da questo controllo prima di consentire scritture.
     ============================================================= */
  canEdit(userId) {
    const me = this.getCurrentUser();
    return !!me && me.id === +userId;
  },
  /** Richiede l'autenticazione: restituisce l'utente o reindirizza */
  requireAuth(redirectTo = 'login.html') {
    const me = this.getCurrentUser();
    if (!me) { window.location.href = redirectTo; return null; }
    return me;
  },

  /* =============================================================
     CREAZIONE NUOVI UTENTI / LIBRERIE
     Crea un account persona oppure organizzazione, lo persiste e
     ne fa (opzionalmente) l'utente corrente. In produzione questo
     corrisponde a POST /api/users con hashing della password lato
     server; qui la password non viene nemmeno memorizzata.
     ============================================================= */
  createUser(data) {
    const users = this.getUsers();

    // v2.1: validazione univocità username (case-insensitive)
    const normalizedUsername = (data.username || '').trim().toLowerCase();
    if (!normalizedUsername) {
      return { ok: false, reason: 'username-empty' };
    }
    const usernameTaken = users.some(u =>
      (u.username || '').trim().toLowerCase() === normalizedUsername);
    if (usernameTaken) {
      return { ok: false, reason: 'username-taken' };
    }

    // v2.1: validazione univocità email (utile per il login + sicurezza)
    const normalizedEmail = (data.email || '').trim().toLowerCase();
    if (normalizedEmail) {
      const emailTaken = users.some(u =>
        (u.email || '').trim().toLowerCase() === normalizedEmail);
      if (emailTaken) {
        return { ok: false, reason: 'email-taken' };
      }
    }

    const newId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;

    const user = {
      id: newId,
      username: data.username,
      display_name: data.display_name,
      account_type: data.account_type === 'organization' ? 'organization' : 'person',
      email: data.email,
      city: data.city || '',
      lat: typeof data.lat === 'number' ? data.lat : 40.8358,
      lng: typeof data.lng === 'number' ? data.lng : 14.2488,
      bio: data.bio || '',
      joined: new Date().toISOString().slice(0, 10),
      public_profile: true,
      // v2.1: library_role è ora sul user object (coerente con il wizard
      // inline di v1.9 che lo aggiorna lì). Resta anche nelle prefs per
      // retrocompatibilità con codice che legge da quel posto.
      library_role: data.library_role || 'curator'
    };
    users.push(user);
    Storage.set('users', users);

    // Preferenze iniziali di personalizzazione
    this.setProfilePrefs(newId, {
      view_mode: data.view_mode || 'grid',
      theme: data.theme || 'classic',
      avatar_style: data.avatar_style || (user.account_type === 'organization' ? 'symbol' : 'initials'),
      avatar_symbol: data.avatar_symbol || '§',
      motto: data.motto || '',
      sort_by: 'recent',
      privacy_level: user.account_type === 'organization' ? 3 : 2,
      show_email: user.account_type === 'organization',
      // 'curator'  = cura una propria libreria (persona/ente)
      // 'borrower' = iscritto per prendere in prestito; potrà aprire
      //              la libreria in seguito aggiungendo un volume.
      library_role: data.library_role || 'curator'
    });

    // Se è un ente, salva anche il profilo esteso
    if (user.account_type === 'organization' && data.org_profile) {
      this.setOrgProfile(newId, data.org_profile);
    }

    /* v1.3: notifiche di onboarding per ogni nuovo iscritto.
       Servono a "spingere" verso le due azioni che fanno funzionare
       davvero la libreria: pubblicare il primo volume e personalizzare
       l'aspetto. Compaiono nella campanella accanto alle notifiche
       sociali, con icona dedicata 👋. */
    this.seedOnboardingNotifications(newId, user);

    return { ok: true, user };
  },

  /** Genera le due notifiche di benvenuto per un nuovo utente:
      "aggiungi il primo volume" + "personalizza la libreria".
      Sono marcate come type='onboarding' per essere distinguibili
      dalle notifiche sociali (new_book, profile_update, ecc.). */
  seedOnboardingNotifications(userId, user) {
    const isOrg = user && user.account_type === 'organization';
    this.addNotification(userId, {
      type: 'onboarding',
      actor_id: null,
      book_id: null,
      message: `<strong>Benvenuto su Libreria Diffusa!</strong> Pubblica il primo volume per dare vita alla ${isOrg ? 'tua biblioteca' : 'tua libreria'}.`,
      onboarding_action: 'add-book',
      created_at: new Date().toISOString()
    });
    this.addNotification(userId, {
      type: 'onboarding',
      actor_id: null,
      book_id: null,
      message: `Dai un tocco personale alla tua libreria: scegli un tema, un motto e una grafica di copertina.`,
      onboarding_action: 'personalize',
      // 1 minuto dopo, così appare leggermente sotto la prima nel pannello
      created_at: new Date(Date.now() - 60_000).toISOString()
    });
  },

  /** Aggiorna i dati anagrafici di un utente (con controllo proprietà) */
  updateUser(userId, patch) {
    if (!this.canEdit(userId)) {
      throw new Error('Operazione non consentita: non sei il proprietario di questa libreria.');
    }
    const users = this.getUsers();
    const user = users.find(u => u.id === +userId);
    if (!user) return null;
    Object.assign(user, patch);
    Storage.set('users', users);
    return user;
  },

  /* =============================================================
     PASSWORD RESET — flusso simulato in stile state-of-the-art
     (v1.3). In produzione: la richiesta genererebbe un token su
     una tabella password_reset_tokens(user_id, token, expires_at,
     used_at), invierebbe l'email, e il consumo del link
     aggiornerebbe la password con bcrypt. Qui rispecchiamo
     fedelmente la logica via localStorage; il "link che
     l'utente riceverebbe via email" viene mostrato a video
     per consentire la dimostrazione del flusso completo.
     ============================================================= */

  /** STEP 1 — l'utente chiede il reset fornendo la sua email.
      Per ragioni di sicurezza si risponde sempre uniformemente
      ("se l'email è registrata...") evitando di rivelare se
      esiste un account; internamente però generiamo davvero il
      token solo se l'utente esiste. Restituisce { ok, token,
      preview_url } — il preview_url va mostrato nella pagina di
      demo come "email simulata". */
  requestPasswordReset(email) {
    if (!email) return { ok: false, error: 'email-missing' };
    const user = this.getUsers().find(u =>
      (u.email || '').toLowerCase() === email.toLowerCase());

    // risposta omogenea (anche se l'email non esiste) per non
    // divulgare l'esistenza di account
    if (!user) return { ok: true, token: null, preview_url: null, simulated_only: true };

    // TODO(alpha): sostituire generazione token con UUID v4 cryptographically
    // secure (crypto.randomUUID()), salvataggio in tabella password_reset_tokens
    // del DB con UNIQUE constraint, single-use enforcement server-side, expiry
    // validata server-side al claim. Non esporre il token nella response (mai
    // restituirlo al client del richiedente) — viene solo inviato via SMTP
    // all'indirizzo del titolare dell'account.
    const token = (Date.now().toString(36) +
                   Math.random().toString(36).slice(2, 10) +
                   Math.random().toString(36).slice(2, 10));
    const tokens = Storage.get('password_reset_tokens', {});
    tokens[token] = {
      user_id: user.id,
      email: user.email,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      used: false
    };
    Storage.set('password_reset_tokens', tokens);

    return {
      ok: true,
      token,
      preview_url: `reset-password.html?token=${token}`,
      simulated_only: false
    };
  },

  /** STEP 2 — convalida un token (esistenza, scadenza, non già usato).
      Restituisce { valid, reason, email? } per la pagina di reset. */
  validateResetToken(token) {
    if (!token) return { valid: false, reason: 'missing' };
    const tokens = Storage.get('password_reset_tokens', {});
    const t = tokens[token];
    if (!t) return { valid: false, reason: 'unknown' };
    if (t.used) return { valid: false, reason: 'used' };
    if (new Date(t.expires_at).getTime() < Date.now()) return { valid: false, reason: 'expired' };
    return { valid: true, email: t.email };
  },

  /** STEP 3 — completa il reset usando il token + nuova password.
      Marca il token come usato (single-use) e salva la nuova password.
      Nel prototipo la password "vive" solo come campo dell'utente;
      in produzione sarebbe un hash bcrypt nel record `users`. */
  completePasswordReset(token, newPassword) {
    const check = this.validateResetToken(token);
    if (!check.valid) return { ok: false, reason: check.reason };
    if (!newPassword || newPassword.length < 8) return { ok: false, reason: 'weak' };

    const tokens = Storage.get('password_reset_tokens', {});
    const t = tokens[token];
    const users = this.getUsers();
    const user = users.find(u => u.id === t.user_id);
    if (!user) return { ok: false, reason: 'unknown' };

    // "salva" la nuova password (qui in chiaro per il prototipo;
    // in produzione: bcrypt → password_hash)
    user.password = newPassword;
    Storage.set('users', users);

    // brucia il token
    t.used = true;
    t.used_at = new Date().toISOString();
    Storage.set('password_reset_tokens', tokens);

    return { ok: true, email: t.email };
  },

  /* =============================================================
     RECENSIONI E VALUTAZIONI (v1.4)
     Ogni utente autenticato può recensire qualunque altra libreria
     (escluso se stesso). Una sola recensione per coppia recensore/
     destinatario: l'eventuale seconda submission è un update.
     ============================================================= */

  /** Tutte le recensioni ricevute da un utente, ordinate dalla più
      recente alla più vecchia. */
  getReviewsForUser(userId) {
    const all = Storage.get('reviews', []) || [];
    return all
      .filter(r => +r.target_user_id === +userId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  /** v1.6: tutte le recensioni SCRITTE da un utente (quelle che lui ha
      lasciato ad altri). Utile per la tab "Mie recensioni / Scritte"
      sul profilo personale. */
  getReviewsByReviewer(userId) {
    const all = Storage.get('reviews', []) || [];
    return all
      .filter(r => +r.reviewer_id === +userId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  /** Statistica riassuntiva delle recensioni di un utente.
      - average: media aritmetica (0 se nessuna recensione)
      - count: numero totale
      - distribution: { 1: n, 2: n, ..., 5: n } per la breakdown */
  getReviewSummary(userId) {
    const reviews = this.getReviewsForUser(userId);
    if (!reviews.length) return { average: 0, count: 0, distribution: {1:0,2:0,3:0,4:0,5:0} };
    const sum = reviews.reduce((s, r) => s + (+r.rating || 0), 0);
    const distribution = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    reviews.forEach(r => { distribution[+r.rating] = (distribution[+r.rating] || 0) + 1; });
    return {
      average: Math.round((sum / reviews.length) * 10) / 10,  // 1 decimale
      count: reviews.length,
      distribution
    };
  },

  /** Recensione scritta dal "recensore" per il "destinatario", se esiste. */
  getReviewByPair(targetUserId, reviewerId) {
    return (Storage.get('reviews', []) || []).find(r =>
      +r.target_user_id === +targetUserId && +r.reviewer_id === +reviewerId);
  },

  /** Se l'utente corrente può recensire un dato profilo:
      - deve essere autenticato
      - diverso dal destinatario
      - (v1.5) deve aver concluso almeno un prestito ('returned') con
        quel destinatario, in entrambe le direzioni (lui ha prestato a
        me o io ho prestato a lui). I sample IDs ≤ 45 sono in modalità
        "grandfathered": esistono pre-esistenti senza prestito a monte. */
  canReview(targetUserId) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    if (+me.id === +targetUserId) return { ok: false, reason: 'self' };
    // Cerca almeno un prestito 'returned' fra i due (in qualsiasi direzione)
    const loans = Storage.get('loan_requests', []) || [];
    const completed = loans.some(l =>
      l.status === LOAN_STATUS.RETURNED &&
      ((+l.requester_id === +me.id && +l.lender_id === +targetUserId) ||
       (+l.lender_id    === +me.id && +l.requester_id === +targetUserId))
    );
    if (!completed) return { ok: false, reason: 'no-completed-loan' };
    return { ok: true };
  },

  /** Crea o aggiorna la recensione del recensore per il destinatario.
      Validazioni: rating 1..5, testo non vuoto e abbastanza lungo. */
  submitReview(targetUserId, rating, text) {
    const check = this.canReview(targetUserId);
    if (!check.ok) return { ok: false, reason: check.reason };
    const r = parseInt(rating, 10);
    if (!(r >= 1 && r <= 5)) return { ok: false, reason: 'rating' };
    const trimmed = (text || '').trim();
    if (trimmed.length < 20) return { ok: false, reason: 'text-short' };

    const me = this.getCurrentUser();
    const reviews = Storage.get('reviews', []) || [];
    const existing = reviews.find(rv =>
      +rv.target_user_id === +targetUserId && +rv.reviewer_id === +me.id);

    if (existing) {
      // update
      existing.rating = r;
      existing.text = trimmed;
      existing.updated_at = new Date().toISOString();
      Storage.set('reviews', reviews);
      return { ok: true, review: existing, updated: true };
    }

    const newId = reviews.reduce((m, rv) => Math.max(m, rv.id || 0), 0) + 1;
    const review = {
      id: newId,
      target_user_id: +targetUserId,
      reviewer_id: +me.id,
      rating: r,
      text: trimmed,
      created_at: new Date().toISOString()
    };
    reviews.push(review);
    Storage.set('reviews', reviews);
    return { ok: true, review, updated: false };
  },

  /** Cancella una recensione (solo il suo autore). */
  deleteReview(reviewId) {
    const me = this.getCurrentUser();
    if (!me) return { ok: false, reason: 'not-authenticated' };
    const reviews = Storage.get('reviews', []) || [];
    const idx = reviews.findIndex(r => r.id === +reviewId);
    if (idx === -1) return { ok: false, reason: 'not-found' };
    if (reviews[idx].reviewer_id !== me.id) return { ok: false, reason: 'forbidden' };
    reviews.splice(idx, 1);
    Storage.set('reviews', reviews);
    return { ok: true };
  },

  /* =============================================================
     DATI DELLA LIBRERIA — bundle per la pagina library.html
     Raccoglie in un solo oggetto tutto ciò che serve a renderizzare
     la pagina pubblica di una libreria: utente, libri, preferenze,
     profilo ente (se applicabile), statistiche e flag di proprietà.
     ============================================================= */
  getLibraryData(userId) {
    const user = this.getUser(userId);
    if (!user) return null;

    const books = this.getBooksByUser(userId);
    const available = books.filter(b => b.available);
    const prefs = this.getProfilePrefs(userId);
    const ref = this.getReferenceLocation();

    return {
      user,
      is_organization: this.isOrganization(user),
      org_profile: this.isOrganization(user) ? this.getOrgProfile(userId) : null,
      prefs,
      books,
      stats: {
        total:      books.length,
        available:  available.length,
        on_loan:    books.length - available.length,
        total_views: books.reduce((s, b) => s + (b.views || 0), 0)
      },
      distance_km: (typeof user.lat === 'number')
        ? this.haversineDistance(ref.lat, ref.lng, user.lat, user.lng)
        : null,
      can_edit: this.canEdit(userId)
    };
  }
};

/* -----------------------------------------------------------------
   4. UTILITY DI RENDERING E UI
   ----------------------------------------------------------------- */

