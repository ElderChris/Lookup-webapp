/* =============================================================================
   storage.js — Persistenza key-value
   =============================================================================
   Layer di astrazione sopra localStorage. Tutti i metodi sono sincroni.

   ⚠ TODO(alpha-fase2): in Fase 2 questo modulo verrà sostituito con un client
   API asincrono (fetch wrappers) che parla con il backend Fastify. La firma
   esterna resterà identica per minimizzare il refactor dei call site, ma:
   - Storage.get(key)        → await api.get(key)
   - Storage.set(key, value) → await api.set(key, value)
   - Storage.init()          → no-op (DB già esistente)

   Cosa contiene:
   - Storage.get/set/remove/clear: wrapper su localStorage
   - Storage.DATA_VERSION + reseed logic per refresh automatico dei sample
   - Storage.init: bootstrap iniziale
   ============================================================================= */

import {
  SAMPLE_USERS, SAMPLE_BOOKS, SAMPLE_CATEGORIES, SAMPLE_LOANS,
  SAMPLE_MESSAGES, SAMPLE_REVIEWS, SAMPLE_POSTS,
  SAMPLE_FOLLOWS, SAMPLE_LIKES,
  SAMPLE_PROFILE_PREFS, SAMPLE_ORG_PROFILES,
  daysAgo
} from './data.js';

export const Storage = {
  /* Versione del set di dati di esempio. Quando questa stringa cambia
     (es. perché aggiungiamo nuovi utenti-ente o categorie BISAC), il
     prossimo caricamento ri-semina i campioni preservando però le
     creazioni dell'utente (libri pubblicati di proprio pugno, follow,
     like, notifiche, preferenze). */
  DATA_VERSION: '3.0.0-alpha.0',

  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },

  /* Re-semina i campioni di librerie e libri se la versione dati salvata
     è diversa da quella corrente. Le creazioni dell'utente (ID > IDmax
     dei campioni) sono mantenute, così come like/follow/notifiche. */
  _reseedSampleDataIfStale() {
    const stored = this.get('data_version');
    if (stored === this.DATA_VERSION) return;

    // --- Utenti: mantiene quelli con id > max campioni, riscrive i campioni
    const sampleUserIds = new Set(SAMPLE_USERS.map(u => u.id));
    const existingUsers = this.get('users') || [];
    const userCreated = existingUsers.filter(u => !sampleUserIds.has(u.id));
    this.set('users', [...SAMPLE_USERS, ...userCreated]);

    // --- Libri: stessa logica
    const sampleBookIds = new Set(SAMPLE_BOOKS.map(b => b.id));
    const existingBooks = this.get('books') || [];
    const bookCreated = existingBooks.filter(b => !sampleBookIds.has(b.id));
    this.set('books', [...SAMPLE_BOOKS, ...bookCreated]);

    // --- Categorie: rimpiazza sempre con il nuovo elenco BISAC
    this.set('categories', SAMPLE_CATEGORIES);

    // --- Preferenze e profili-ente dei campioni: ri-popola le mancanti
    Object.entries(SAMPLE_PROFILE_PREFS).forEach(([id, prefs]) => {
      this.set(`profile_prefs_${id}`, Object.assign({}, prefs, this.get(`profile_prefs_${id}`) || {}));
    });
    Object.entries(SAMPLE_ORG_PROFILES).forEach(([id, profile]) => {
      if (!this.get(`org_profile_${id}`)) this.set(`org_profile_${id}`, profile);
    });

    // --- Recensioni (v1.4): stessa logica di libri/utenti.
    // Mantiene le recensioni con id > max sample, sovrascrive i campioni.
    const sampleReviewIds = new Set(SAMPLE_REVIEWS.map(r => r.id));
    const existingReviews = this.get('reviews') || [];
    const reviewCreated = existingReviews.filter(r => !sampleReviewIds.has(r.id));
    this.set('reviews', [...SAMPLE_REVIEWS, ...reviewCreated]);

    // --- Prestiti (v1.5): le date dei sample sono dinamiche (daysAgo)
    // quindi il reseed le ricalcola sempre dal momento corrente.
    const sampleLoanIds = new Set(SAMPLE_LOANS.map(l => l.id));
    const existingLoans = this.get('loan_requests') || [];
    const loanCreated = existingLoans.filter(l => !sampleLoanIds.has(l.id));
    this.set('loan_requests', [...SAMPLE_LOANS, ...loanCreated]);

    // --- Messaggi (v1.7): stessa logica, preserva quelli con id > max sample
    const sampleMessageIds = new Set(SAMPLE_MESSAGES.map(m => m.id));
    const existingMessages = this.get('loan_messages') || [];
    const messageCreated = existingMessages.filter(m => !sampleMessageIds.has(m.id));
    this.set('loan_messages', [...SAMPLE_MESSAGES, ...messageCreated]);

    // v2.4: post di esempio. Le creazioni utente hanno id 'p_' + ts,
    // i sample 'p_sample_xxx'. Filtriamo per non sovrascrivere.
    const samplePostIds = new Set(SAMPLE_POSTS.map(p => p.id));
    const existingPosts = this.get('posts') || [];
    const postCreated = existingPosts.filter(p => !samplePostIds.has(p.id));
    this.set('posts', [...SAMPLE_POSTS, ...postCreated]);

    this.set('data_version', this.DATA_VERSION);
    console.info(`[Lookup] dati di esempio aggiornati a v${this.DATA_VERSION}`);
  },

  init() {
    // Re-seed se necessario (gestisce gli aggiornamenti di versione)
    this._reseedSampleDataIfStale();

    // Popolamento iniziale se non presente
    if (!this.get('users')) this.set('users', SAMPLE_USERS);
    if (!this.get('books')) this.set('books', SAMPLE_BOOKS);
    if (!this.get('categories')) this.set('categories', SAMPLE_CATEGORIES);
    if (!this.get('loan_requests')) this.set('loan_requests', SAMPLE_LOANS);
    if (!this.get('loan_messages')) this.set('loan_messages', SAMPLE_MESSAGES);
    if (!this.get('posts')) this.set('posts', SAMPLE_POSTS);
    // Preferenze di personalizzazione degli utenti di esempio
    Object.entries(SAMPLE_PROFILE_PREFS).forEach(([id, prefs]) => {
      if (!this.get(`profile_prefs_${id}`)) {
        this.set(`profile_prefs_${id}`, prefs);
      }
    });
    // Profili degli enti (solo per gli account organizzazione)
    Object.entries(SAMPLE_ORG_PROFILES).forEach(([id, profile]) => {
      if (!this.get(`org_profile_${id}`)) {
        this.set(`org_profile_${id}`, profile);
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

    // Dati social di esempio (follow + like) per l'utente dimostrativo
    Object.entries(SAMPLE_FOLLOWS).forEach(([id, list]) => {
      if (!this.get(`follows_${id}`)) this.set(`follows_${id}`, list);
    });
    Object.entries(SAMPLE_LIKES).forEach(([id, list]) => {
      if (!this.get(`likes_${id}`)) this.set(`likes_${id}`, list);
    });
    // Recensioni di esempio (v1.4): ~50 recensioni per i 10 utenti
    // sample, con voti diversificati e contenuti realistici.
    if (!this.get('reviews')) this.set('reviews', SAMPLE_REVIEWS);
  },
  reset() {
    localStorage.clear();
    this.init();
  }
};

/* -----------------------------------------------------------------
   3. API LOCALE — simula un backend REST
   ----------------------------------------------------------------- */

