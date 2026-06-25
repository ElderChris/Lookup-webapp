/* =============================================================================
   data.js — Dati di esempio (seed fixtures), costanti tassonomiche
   =============================================================================
   In Alpha (Fase 1) questi diventeranno prisma/seed.ts caricato in dev/staging.
   In produzione il DB partirà vuoto e si popolerà dagli utenti reali.

   Cosa contiene:
   - SAMPLE_USERS, SAMPLE_BOOKS, SAMPLE_LOANS, SAMPLE_MESSAGES, SAMPLE_REVIEWS,
     SAMPLE_POSTS, SAMPLE_FOLLOWS, SAMPLE_LIKES, SAMPLE_FOLLOWER_BASE,
     SAMPLE_PROFILE_PREFS, SAMPLE_ORG_PROFILES, SAMPLE_NOTIFICATIONS_BASE
   - BISAC_CATEGORIES, BISAC_FLAT, BISAC_PARENT, SAMPLE_CATEGORIES
   - ORG_CATEGORIES
   - LOAN_STATUS, LOAN_STATUS_ORDER, LOAN_STATUS_LABEL, LOAN_STATUS_HINT
   - LIBRARY_COVER_DESIGNS, LIBRARY_COVER_DESIGN_MAP
   - Helper temporale `daysAgo()` (qui per vicinanza alle date dei sample)
   ============================================================================= */

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

export const SAMPLE_USERS = [
  { id: 1, username: 'chiara.morandi', display_name: 'Chiara Morandi',
    account_type: 'person',
    email: 'c.morandi@mail.it', city: 'Napoli, Chiaia',
    lat: 40.8358, lng: 14.2351, bio: 'Appassionata di letteratura italiana del Novecento e di saggistica filosofica.',
    joined: '2024-03-12', public_profile: true, library_role: 'curator' },
  { id: 2, username: 'marco.devito', display_name: 'Marco De Vito',
    account_type: 'person',
    email: 'm.devito@mail.it', city: 'Napoli, Vomero',
    lat: 40.8488, lng: 14.2295, bio: 'Collezionista di gialli e noir, con particolare attenzione agli autori scandinavi.',
    joined: '2024-01-22', public_profile: true, library_role: 'curator' },
  { id: 3, username: 'anna.russo', display_name: 'Anna Russo',
    account_type: 'person',
    email: 'a.russo@mail.it', city: 'Napoli, Posillipo',
    lat: 40.8145, lng: 14.2055, bio: 'Biblioteca di famiglia con edizioni ottocentesche di classici.',
    joined: '2023-11-05', public_profile: true, library_role: 'curator' },
  { id: 4, username: 'luca.esposito', display_name: 'Luca Esposito',
    account_type: 'person',
    email: 'l.esposito@mail.it', city: 'Napoli, Centro Storico',
    lat: 40.8518, lng: 14.2681, bio: 'Saggi di storia locale e tradizioni campane.',
    joined: '2024-05-08', public_profile: true, library_role: 'curator' },
  { id: 5, username: 'giulia.ferrari', display_name: 'Giulia Ferrari',
    account_type: 'person',
    email: 'g.ferrari@mail.it', city: 'Portici',
    lat: 40.8147, lng: 14.3417, bio: 'Poesia contemporanea italiana e traduzioni dal tedesco.',
    joined: '2024-02-18', public_profile: true, library_role: 'curator' },
  { id: 6, username: 'roberto.mazzone', display_name: 'Roberto Mazzone',
    account_type: 'person',
    email: 'r.mazzone@mail.it', city: 'Pozzuoli',
    lat: 40.8240, lng: 14.1204, bio: 'Fantascienza classica e distopie.',
    joined: '2024-04-01', public_profile: true, library_role: 'curator' },

  /* Librerie-ente: raccolte gestite da organizzazioni indipendenti
     che mettono i propri volumi a disposizione per il prestito.
     I dati specifici dell'ente vivono in SAMPLE_ORG_PROFILES. */
  { id: 7, username: 'biblioteca.sanita', display_name: 'Biblioteca di Comunità Rione Sanità',
    account_type: 'organization',
    email: 'info@bibliosanita.org', city: 'Napoli, Rione Sanità',
    lat: 40.8585, lng: 14.2515, bio: 'Biblioteca di comunità nata dal basso: un presidio culturale aperto nel cuore del Rione Sanità, con un fondo dedicato alla storia e alle voci del quartiere.',
    joined: '2023-09-20', public_profile: true, library_role: 'curator' },
  { id: 8, username: 'lettori.erranti', display_name: 'Associazione I Lettori Erranti',
    account_type: 'organization',
    email: 'contatti@lettorierranti.it', city: 'Napoli, Fuorigrotta',
    lat: 40.8270, lng: 14.1920, bio: 'Associazione culturale che promuove la lettura condivisa attraverso circoli, presentazioni e una biblioteca circolante di narrativa e saggistica contemporanea.',
    joined: '2024-01-10', public_profile: true, library_role: 'curator' },
  { id: 9, username: 'libreria.spaccanapoli', display_name: 'Libreria Indipendente Spaccanapoli',
    account_type: 'organization',
    email: 'ciao@libreriaspaccanapoli.it', city: 'Napoli, Spaccanapoli',
    lat: 40.8497, lng: 14.2570, bio: 'Libreria indipendente del centro storico, specializzata in editoria meridionale, poesia e piccoli editori. Mette in prestito una selezione del proprio fondo storico.',
    joined: '2023-06-14', public_profile: true, library_role: 'curator' },
  { id: 10, username: 'centro.mezzogiorno', display_name: 'Centro Culturale Mezzogiorno',
    account_type: 'organization',
    email: 'info@centromezzogiorno.org', city: 'Napoli, Vomero',
    lat: 40.8438, lng: 14.2270, bio: 'Centro culturale di quartiere con sala lettura, gruppi di studio sulla storia del Mezzogiorno e una biblioteca tematica aperta ai soci e al pubblico.',
    joined: daysAgo(5).slice(0, 10), public_profile: true, library_role: 'curator' },

  /* v2.2: Utente amministratore — accesso al pannello admin solo
     per chi ha is_admin=true. Sample credenziali: username 'admin',
     password 'admin' (vedi authenticate). In produzione l'admin
     sarebbe un ruolo separato gestito dal backend con permission
     check sui propri endpoint, non un utente sample. */
  { id: 11, username: 'admin', display_name: 'Amministratore',
    account_type: 'person',
    email: 'admin@libreriadiffusa.it', city: 'Napoli',
    lat: 40.8358, lng: 14.2488, bio: 'Account di amministrazione della piattaforma. Modera contenuti, gestisce utenti, monitora KPI.',
    joined: '2023-01-01', public_profile: false,
    is_admin: true, library_role: 'admin' }
];

/* ------------------------------------------------------------------
   TASSONOMIA BISAC (Book Industry Standards and Communications) — v1.0
   ------------------------------------------------------------------
   BISAC è lo standard commerciale internazionale usato da editori,
   distributori e librerie (Amazon, IBS, IngramSpark...) per classificare
   i libri. Lo schema reale conta migliaia di codici organizzati in
   macro-aree. Qui adottiamo un sottoinsieme italiano-friendly delle
   macro-aree principali con le sotto-categorie più diffuse, abbastanza
   ricco da permettere ricerche granulari ma gestibile in un prototipo.
   Ogni libro può portare uno o più tag (modello many-to-many). */
export const BISAC_CATEGORIES = {
  'Narrativa': [
    'Narrativa contemporanea', 'Classici', 'Narrativa letteraria',
    'Narrativa storica', 'Gialli e noir', 'Thriller', 'Fantascienza',
    'Fantasy', 'Romanzo rosa', 'Avventura', 'Racconti', 'Distopia',
    'Romanzo di formazione', 'Satira e umorismo'
  ],
  'Saggistica': [
    'Saggistica generale', 'Storia', 'Filosofia', 'Politica',
    'Economia', 'Sociologia', 'Antropologia', 'Scienze',
    'Tecnologia', 'Critica letteraria', 'Religione e spiritualità',
    'Psicologia', 'Educazione'
  ],
  'Biografie': [
    'Biografie storiche', 'Autobiografie', 'Memorie',
    'Personaggi politici', 'Artisti e scrittori', 'Sportivi e musicisti'
  ],
  'Poesia': [
    'Poesia contemporanea', 'Poesia classica',
    'Poesia italiana', 'Poesia internazionale'
  ],
  'Teatro': [
    'Teatro classico', 'Teatro contemporaneo', 'Sceneggiature'
  ],
  'Arte e fotografia': [
    'Pittura', 'Scultura', 'Architettura', 'Fotografia', 'Design',
    'Storia dell\'arte', 'Cataloghi di mostre'
  ],
  'Fumetti e graphic novel': [
    'Graphic novel', 'Manga', 'Fumetto franco-belga',
    'Fumetto italiano', 'Supereroi'
  ],
  'Letteratura per ragazzi': [
    'Albi illustrati', 'Narrativa per ragazzi', 'Young adult',
    'Educativi per bambini'
  ],
  'Cucina e casa': [
    'Cucina', 'Giardinaggio', 'Fai-da-te', 'Decorazione d\'interni'
  ],
  'Viaggi': [
    'Guide di viaggio', 'Letteratura di viaggio', 'Diari di viaggio'
  ],
  'Salute e benessere': [
    'Salute', 'Alimentazione', 'Sport e fitness', 'Mindfulness'
  ]
};

/* Lista piatta di tutti i tag BISAC, ordinata alfabeticamente —
   usata dall'autocomplete della ricerca e della pubblicazione. */
export const BISAC_FLAT = Object.values(BISAC_CATEGORIES).flat().sort((a, b) => a.localeCompare(b, 'it'));

/* Macro-area di appartenenza di un tag (per visualizzare il contesto
   nel dropdown dell'autocomplete: "Gialli e noir · Narrativa"). */
export const BISAC_PARENT = (() => {
  const map = {};
  Object.entries(BISAC_CATEGORIES).forEach(([macro, subs]) =>
    subs.forEach(s => { map[s] = macro; }));
  return map;
})();

/* Alias mantenuto per retro-compatibilità con codice che leggeva
   SAMPLE_CATEGORIES (statistiche, dropdown legacy). */
export const SAMPLE_CATEGORIES = BISAC_FLAT;

/* Preferenze di personalizzazione del profilo per gli utenti di
   esempio — rispecchiano il seed SQL (sql/seed_data.sql). Servono a
   dare a ogni libreria una copertina generata distintiva, coerente
   con le scelte estetiche del suo curatore. */
export const SAMPLE_PROFILE_PREFS = {
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
       motto: 'Il futuro lo immaginiamo prima di costruirlo',   sort_by: 'year',   privacy_level: 3, show_email: false },
  /* Le librerie-ente mostrano l'email pubblicamente: vogliono essere
     contattate. Privacy_level 3 perché l'indirizzo dell'ente è
     pubblico per definizione. */
  7: { view_mode: 'list',     theme: 'bordeaux', avatar_style: 'symbol',   avatar_symbol: '❦',
       motto: 'La cultura è un bene comune',                    sort_by: 'title',  privacy_level: 3, show_email: true },
  8: { view_mode: 'grid',     theme: 'classic',  avatar_style: 'symbol',   avatar_symbol: '❧',
       motto: 'Leggere insieme, camminare lontano',             sort_by: 'recent', privacy_level: 3, show_email: true },
  9: { view_mode: 'shelf',    theme: 'bordeaux', avatar_style: 'symbol',   avatar_symbol: '⌘',
       motto: 'Editoria meridionale e piccoli editori',         sort_by: 'recent', privacy_level: 3, show_email: true },
  10:{ view_mode: 'list',     theme: 'sage',     avatar_style: 'symbol',   avatar_symbol: '✦',
       motto: 'Il Sud che legge se stesso',                     sort_by: 'title',  privacy_level: 3, show_email: true }
};

/* Profili degli enti — dati specifici delle librerie-organizzazione.
   Rispecchiano la tabella organization_profiles del database
   (relazione 1:1 con users, popolata solo per account_type =
   'organization'). */
export const SAMPLE_ORG_PROFILES = {
  7: {
    legal_name: 'Associazione Biblioteca di Comunità Rione Sanità APS',
    org_category: 'biblioteca',
    contact_person: 'Dott.ssa Federica Improta',
    website: 'https://www.bibliosanita.org',
    public_email: 'info@bibliosanita.org',
    public_phone: '+39 081 555 0142',
    public_address: 'Via della Sanità 124, 80136 Napoli',
    opening_hours: 'Lun–Ven 10:00–13:00 e 15:00–19:00 · Sab 10:00–13:00 · Dom chiuso'
  },
  8: {
    legal_name: 'I Lettori Erranti — Associazione di Promozione Sociale',
    org_category: 'associazione',
    contact_person: 'Salvatore Acanfora',
    website: 'https://www.lettorierranti.it',
    public_email: 'contatti@lettorierranti.it',
    public_phone: '+39 081 555 0987',
    public_address: 'Piazzale Tecchio 8, 80125 Napoli',
    opening_hours: 'Mar e Gio 16:00–20:00 · Sab 10:00–18:00 · prestito su appuntamento'
  },
  9: {
    legal_name: 'Libreria Spaccanapoli S.r.l.',
    org_category: 'libreria_indipendente',
    contact_person: 'Giuseppe Capuano',
    website: 'https://www.libreriaspaccanapoli.it',
    public_email: 'ciao@libreriaspaccanapoli.it',
    public_phone: '+39 081 555 0211',
    public_address: 'Via San Biagio dei Librai 32, 80138 Napoli',
    opening_hours: 'Lun–Sab 9:30–19:30 · Dom 10:00–13:00'
  },
  10: {
    legal_name: 'Centro Culturale Mezzogiorno ETS',
    org_category: 'centro_culturale',
    contact_person: 'Dott. Antonio Iervolino',
    website: 'https://www.centromezzogiorno.org',
    public_email: 'info@centromezzogiorno.org',
    public_phone: '+39 081 555 0388',
    public_address: 'Via Luca Giordano 21, 80127 Napoli',
    opening_hours: 'Lun–Ven 16:00–20:00 · Sab 10:00–13:00 · iscritti e ospiti'
  }
};

/* Categorie di ente ammesse (enum allineato al CHECK del database) */
export const ORG_CATEGORIES = {
  biblioteca:           'Biblioteca',
  associazione:         'Associazione culturale',
  libreria_indipendente:'Libreria indipendente',
  centro_culturale:     'Centro culturale',
  scuola:               'Scuola o istituto',
  altro:                'Altro ente'
};

/* -----------------------------------------------------------------
   Dati SOCIAL di esempio (follow, like, notifiche)
   L'utente dimostrativo (Chiara, id 1) segue già alcune librerie e
   ha messo "like" ad alcuni volumi, così le funzioni sociali sono
   popolate al primo avvio. In produzione questi dati vivono nelle
   tabelle user_follows, book_likes e notifications.
   ----------------------------------------------------------------- */
export const SAMPLE_FOLLOWS = { 1: [7, 8, 3, 9, 10] };    // chi-segue → [seguiti]
export const SAMPLE_LIKES   = { 1: [15, 5, 17] };        // utente → [libri piaciuti]

/* ============================================================
   RECENSIONI (v1.4) — un membro della comunità lascia una valutazione
   da 1 a 5 stelle + testo a un altro membro, dopo aver avuto un prestito
   o un'interazione. Una sola recensione per coppia recensore/destinatario
   (modificabile). I curatori non possono recensire la propria libreria.
   Lo schema rispecchia la tabella `reviews` di sql/schema.sql:
   (id, target_user_id, reviewer_id, rating, text, created_at).
   ============================================================ */
export const SAMPLE_REVIEWS = [
  // Recensioni per id 1 — Chiara Morandi (letteratura italiana '900, filosofia)
  { id: 1,  target_user_id: 1, reviewer_id: 2, rating: 5,
    text: 'Chiara è una lettrice attentissima: mi ha consigliato un Calvino che non avevo mai considerato e mi ha prestato il volume con cura. Da rifare assolutamente.',
    created_at: '2025-09-14' },
  { id: 2,  target_user_id: 1, reviewer_id: 4, rating: 5,
    text: 'Selezione curatissima. Le sue edizioni del Novecento sono in condizioni perfette e si percepisce l\'amore per i libri. Restituzione e prestito gestiti con grande precisione.',
    created_at: '2025-08-22' },
  { id: 3,  target_user_id: 1, reviewer_id: 6, rating: 4,
    text: 'Esperienza piacevole, mi sono trovato benissimo con la consegna a Chiaia. Toglierei una stellina solo perché orari un po\' rigidi, ma comprensibili.',
    created_at: '2025-07-03' },
  { id: 4,  target_user_id: 1, reviewer_id: 8, rating: 5,
    text: 'Una libreria personale di rara qualità per chi cerca saggistica filosofica. Chiara ha collaborato volentieri con noi su un ciclo di letture: persona seria e competente.',
    created_at: '2025-06-15' },
  { id: 5,  target_user_id: 1, reviewer_id: 3, rating: 5,
    text: 'Volume restituito in tempo, conversazioni interessanti al passaggio. Una di quelle persone che ti fa amare di più Libreria Diffusa.',
    created_at: '2025-10-01' },

  // Recensioni per id 2 — Marco De Vito (gialli e noir, scandinavi)
  { id: 6,  target_user_id: 2, reviewer_id: 1, rating: 5,
    text: 'Marco è un vero appassionato del genere: mi ha procurato un Mankell che cercavo da anni. Libri ben tenuti, consegna puntuale.',
    created_at: '2025-09-08' },
  { id: 7,  target_user_id: 2, reviewer_id: 5, rating: 4,
    text: 'Ottima collezione di noir, qualche edizione un po\' usurata ma niente di problematico. Comunicazione rapida e cordiale.',
    created_at: '2025-08-19' },
  { id: 8,  target_user_id: 2, reviewer_id: 3, rating: 5,
    text: 'Se cercate gialli scandinavi siete nel posto giusto. Marco sa di che parla e mi ha fatto scoprire Indriðason. Affidabile al 100%.',
    created_at: '2025-07-25' },
  { id: 9,  target_user_id: 2, reviewer_id: 7, rating: 4,
    text: 'Abbiamo richiesto in prestito due titoli per una serata tematica del Rione Sanità: disponibilità totale e libri restituiti in ottimo stato.',
    created_at: '2025-06-02' },

  // Recensioni per id 3 — Anna Russo (biblioteca di famiglia, edizioni ottocentesche)
  { id: 10, target_user_id: 3, reviewer_id: 1, rating: 5,
    text: 'Anna conserva una biblioteca di famiglia con edizioni storiche di altissimo pregio. Mi ha prestato una rilegatura ottocentesca con la stessa fiducia che si dà a un amico. Grazie davvero.',
    created_at: '2025-09-20' },
  { id: 11, target_user_id: 3, reviewer_id: 6, rating: 5,
    text: 'Esperienza memorabile. Le edizioni che tiene sono pezzi rari, e lei è molto generosa nel condividerle previa cura. Cinque stelle senza esitazione.',
    created_at: '2025-08-11' },
  { id: 12, target_user_id: 3, reviewer_id: 9, rating: 4,
    text: 'Volume cinquecentesco prestato per una nostra mostra: ottima collaborazione, qualche difficoltà negli orari ma legittima viste le edizioni in gioco.',
    created_at: '2025-07-14' },
  { id: 13, target_user_id: 3, reviewer_id: 4, rating: 5,
    text: 'Affidabile, gentile, conoscitrice profonda dei classici. Una libreria privata che vale una visita in biblioteca civica.',
    created_at: '2025-06-28' },
  { id: 14, target_user_id: 3, reviewer_id: 10, rating: 5,
    text: 'Collaborazione preziosa per il nostro progetto sulla letteratura meridionale. Anna è una risorsa per tutta la comunità.',
    created_at: '2025-05-30' },

  // Recensioni per id 4 — Luca Esposito
  { id: 15, target_user_id: 4, reviewer_id: 1, rating: 4,
    text: 'Catalogo interessante e ben organizzato. Luca risponde rapidamente. Solo da migliorare la disponibilità nel weekend.',
    created_at: '2025-09-25' },
  { id: 16, target_user_id: 4, reviewer_id: 2, rating: 5,
    text: 'Sempre cortese, sempre disponibile. Mi ha prestato tre libri e la consegna è stata impeccabile.',
    created_at: '2025-08-30' },
  { id: 17, target_user_id: 4, reviewer_id: 6, rating: 4,
    text: 'Buona esperienza, libri in condizioni dignitose. Mi ha consigliato anche altri titoli simili a quello che cercavo.',
    created_at: '2025-07-19' },
  { id: 18, target_user_id: 4, reviewer_id: 5, rating: 5,
    text: 'Lettore appassionato e curatore generoso. Niente da eccepire, lo consiglio.',
    created_at: '2025-06-09' },

  // Recensioni per id 5 — Giulia Ferrari
  { id: 19, target_user_id: 5, reviewer_id: 1, rating: 5,
    text: 'Selezione di poesia contemporanea che difficilmente trovi altrove. Giulia è una compagnia preziosa per chi ama la lettura ad alta voce.',
    created_at: '2025-09-16' },
  { id: 20, target_user_id: 5, reviewer_id: 4, rating: 4,
    text: 'Mi sono trovato bene. Solo qualche libro un po\' segnato dal tempo, ma niente che ne comprometta la lettura.',
    created_at: '2025-08-04' },
  { id: 21, target_user_id: 5, reviewer_id: 8, rating: 5,
    text: 'Collaborazione su un nostro reading: Giulia ha portato libri e un\'energia rara. Persona di fiducia totale.',
    created_at: '2025-07-22' },
  { id: 22, target_user_id: 5, reviewer_id: 3, rating: 5,
    text: 'Tre prestiti, tre esperienze ottime. Restituzioni gestite via app senza intoppi.',
    created_at: '2025-06-11' },

  // Recensioni per id 6 — Roberto Mazzone
  { id: 23, target_user_id: 6, reviewer_id: 2, rating: 4,
    text: 'Roberto cura una raccolta di saggistica storica molto interessante. Comunicazione un po\' essenziale ma sempre puntuale.',
    created_at: '2025-09-12' },
  { id: 24, target_user_id: 6, reviewer_id: 4, rating: 5,
    text: 'Persona di sostanza. Mi ha aiutato a recuperare un volume fuori catalogo da decenni. Mille grazie.',
    created_at: '2025-08-26' },
  { id: 25, target_user_id: 6, reviewer_id: 7, rating: 5,
    text: 'Collaboratore prezioso per le nostre attività di studio. Roberto è un lettore serio e affidabile.',
    created_at: '2025-07-08' },
  { id: 26, target_user_id: 6, reviewer_id: 1, rating: 4,
    text: 'Catalogo di nicchia ma di alta qualità. Esperienza positiva.',
    created_at: '2025-06-30' },

  // Recensioni per id 7 — Biblioteca di Comunità Rione Sanità (ente)
  { id: 27, target_user_id: 7, reviewer_id: 1, rating: 5,
    text: 'Una realtà preziosa per il quartiere. Il personale è cortese, gli spazi accoglienti e il catalogo dedicato alla storia del Rione Sanità è ricchissimo. Da visitare.',
    created_at: '2025-09-18' },
  { id: 28, target_user_id: 7, reviewer_id: 2, rating: 5,
    text: 'Biblioteca di comunità nel senso pieno della parola: aperta, partecipata, attenta. Ho preso in prestito tre volumi senza alcuna difficoltà.',
    created_at: '2025-08-15' },
  { id: 29, target_user_id: 7, reviewer_id: 5, rating: 5,
    text: 'Tengono incontri settimanali sulla letteratura napoletana che sono veri gioielli. Cinque stelle alla cura con cui gestiscono il fondo storico.',
    created_at: '2025-07-29' },
  { id: 30, target_user_id: 7, reviewer_id: 3, rating: 4,
    text: 'Esperienza ottima nel complesso. Tolgo solo una stella perché in alcune fasce orarie c\'è poca disponibilità di volontari, ma è comprensibile.',
    created_at: '2025-06-20' },
  { id: 31, target_user_id: 7, reviewer_id: 9, rating: 5,
    text: 'Collaboriamo da anni: una realtà di riferimento per il presidio culturale dei quartieri di Napoli. Affidabilissimi.',
    created_at: '2025-05-12' },

  // Recensioni per id 8 — Associazione I Lettori Erranti (ente)
  { id: 32, target_user_id: 8, reviewer_id: 1, rating: 5,
    text: 'Un\'associazione vivace, organizza giri di lettura itineranti per la città che sono un\'esperienza unica. Catalogo eterogeneo e accessibile.',
    created_at: '2025-09-22' },
  { id: 33, target_user_id: 8, reviewer_id: 4, rating: 5,
    text: 'Lettori Erranti è quanto di più bello possa esistere per un appassionato. Eventi gratuiti, prestiti facili, persone gentilissime.',
    created_at: '2025-08-08' },
  { id: 34, target_user_id: 8, reviewer_id: 6, rating: 4,
    text: 'Mi sono iscritto all\'associazione e ho già preso in prestito quattro libri. Tutto bene, qualche piccola lentezza nella restituzione ma niente di grave.',
    created_at: '2025-07-17' },
  { id: 35, target_user_id: 8, reviewer_id: 2, rating: 5,
    text: 'Una realtà che dà senso all\'idea di "lettori in cammino". Bravi davvero.',
    created_at: '2025-06-05' },

  // Recensioni per id 9 — Libreria Indipendente Spaccanapoli (ente)
  { id: 36, target_user_id: 9, reviewer_id: 1, rating: 4,
    text: 'Libreria indipendente nel cuore della città, selezione curata di narrativa contemporanea. I libri prestati erano in ottime condizioni.',
    created_at: '2025-09-30' },
  { id: 37, target_user_id: 9, reviewer_id: 3, rating: 5,
    text: 'Punto di riferimento per chi cerca pubblicazioni di piccoli editori. Personale appassionato e competente.',
    created_at: '2025-08-23' },
  { id: 38, target_user_id: 9, reviewer_id: 7, rating: 5,
    text: 'Una libreria che fa la differenza nel quartiere. Collaborazioni sempre fruttuose, edizioni interessanti, prestiti gestiti con professionalità.',
    created_at: '2025-07-11' },
  { id: 39, target_user_id: 9, reviewer_id: 5, rating: 4,
    text: 'Bella esperienza, mi ha consigliato due titoli che non conoscevo. Un po\' caotici negli orari di chiusura ma è la vita di una libreria indipendente.',
    created_at: '2025-06-18' },
  { id: 40, target_user_id: 9, reviewer_id: 8, rating: 5,
    text: 'Una libreria coraggiosa, di quelle che resistono al tempo della grande distribuzione. La sosteniamo con convinzione.',
    created_at: '2025-05-25' },

  // Recensioni per id 10 — Centro Culturale Mezzogiorno (ente)
  { id: 41, target_user_id: 10, reviewer_id: 2, rating: 5,
    text: 'Il fondo dedicato alla questione meridionale è uno dei più ricchi della città. Personale preparato, ambienti raccolti.',
    created_at: '2025-09-05' },
  { id: 42, target_user_id: 10, reviewer_id: 6, rating: 5,
    text: 'Un centro di ricerca prezioso. Le pubblicazioni della loro biblioteca sono insostituibili per chi studia il Sud.',
    created_at: '2025-08-29' },
  { id: 43, target_user_id: 10, reviewer_id: 1, rating: 4,
    text: 'Catalogo di valore, però la procedura di prestito è un po\' più lenta che altrove. Comprensibile dato il valore delle edizioni.',
    created_at: '2025-07-26' },
  { id: 44, target_user_id: 10, reviewer_id: 4, rating: 5,
    text: 'Un\'istituzione culturale che vale dieci stelle. Persone serie, biblioteca eccellente, ambiente di studio impeccabile.',
    created_at: '2025-06-13' },
  { id: 45, target_user_id: 10, reviewer_id: 9, rating: 4,
    text: 'Buona collaborazione: hanno ospitato presso di noi alcuni loro volumi per una rassegna. Affidabili.',
    created_at: '2025-05-08' },
];

/* ============================================================
   PRESTITI E TIMELINE DI STATO (v1.5)
   ============================================================
   Ogni richiesta di prestito attraversa cinque stati:
     1. 'requested'  → richiesta inviata
     2. 'confirmed'  → richiesta confermata dal prestatore
     3. 'borrowed'   → ritirato dal richiedente (in suo possesso)
     4. 'returning'  → restituzione avviata dal richiedente
     5. 'returned'   → restituzione confermata dal prestatore (chiuso)
   Le transizioni sono unidirezionali. Ogni passaggio porta una data
   in modo da poter generare la timeline visuale di stato. */
export const LOAN_STATUS = {
  REQUESTED:  'requested',
  CONFIRMED:  'confirmed',
  BORROWED:   'borrowed',
  RETURNING:  'returning',
  RETURNED:   'returned'
};
export const LOAN_STATUS_ORDER = ['requested', 'confirmed', 'borrowed', 'returning', 'returned'];
export const LOAN_STATUS_LABEL = {
  requested:  'Richiesta inviata',
  confirmed:  'Richiesta confermata',
  borrowed:   'Prestato',
  returning:  'Restituzione in corso',
  returned:   'Restituito'
};
export const LOAN_STATUS_HINT = {
  requested:  'In attesa di conferma dal prestatore',
  confirmed:  'Ora puoi recarti fisicamente a prendere il volume',
  borrowed:   'Il volume è in tuo possesso. Quando hai finito, avvia la restituzione',
  returning:  'In attesa che il prestatore confermi la ricezione del volume',
  returned:   'Restituzione completata. Grazie!'
};

/* Date dinamiche: per non mostrare prestiti "vecchi di mesi" servono
   timestamp relativi al momento corrente. Calcoliamo le date a partire
   da oggi al primo seeding, così la demo è sempre "fresca". */
export function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

/* I prestiti di esempio raccontano l'intero ciclo: alcuni appena
   richiesti, alcuni in possesso, alcuni in restituzione, alcuni chiusi.
   v1.6: ogni prestito ha `days_requested` (5-28 giorni). I prestiti
   `borrowed` con borrowed_at oltre i days_requested ricevono un sollecito
   automatico al primo caricamento (vedi API.checkOverdueLoans). */
export const SAMPLE_LOANS = [
  // --- Chiara (id 1) come RICHIEDENTE: prestiti che ha chiesto ad altri ---
  {
    id: 1, book_id: 6, requester_id: 1, lender_id: 2,
    status: 'requested',
    requested_at: daysAgo(2),
    days_requested: 14,
    message: 'Mi piacerebbe leggerlo per un gruppo di lettura.'
  },
  {
    id: 2, book_id: 11, requester_id: 1, lender_id: 4,
    status: 'confirmed',
    requested_at: daysAgo(5),
    confirmed_at: daysAgo(1),
    days_requested: 21,
    message: 'Vorrei leggerlo prima delle vacanze.'
  },
  {
    id: 3, book_id: 14, requester_id: 1, lender_id: 5,
    status: 'borrowed',
    requested_at: daysAgo(12),
    confirmed_at: daysAgo(10),
    borrowed_at: daysAgo(8),
    days_requested: 14,           // ancora nei termini
    message: 'Per un saggio che sto scrivendo.'
  },
  {
    id: 4, book_id: 19, requester_id: 1, lender_id: 9,
    status: 'borrowed',
    requested_at: daysAgo(20),
    confirmed_at: daysAgo(18),
    borrowed_at: daysAgo(15),
    days_requested: 7,            // SCADUTO (in possesso da 15 gg, term 7)
    message: 'Mi serve per un articolo.'
  },
  {
    id: 5, book_id: 8, requester_id: 1, lender_id: 3,
    status: 'returning',
    requested_at: daysAgo(35),
    confirmed_at: daysAgo(33),
    borrowed_at: daysAgo(31),
    returning_at: daysAgo(2),
    days_requested: 28,
    message: 'Mi serve per una settimana.'
  },
  {
    id: 6, book_id: 7, requester_id: 1, lender_id: 3,
    status: 'returned',
    requested_at: daysAgo(60),
    confirmed_at: daysAgo(58),
    borrowed_at: daysAgo(55),
    returning_at: daysAgo(8),
    returned_at: daysAgo(5),
    days_requested: 21,
    message: 'Per la mia tesina.'
  },

  // --- Chiara (id 1) come PRESTATORE: richieste ricevute da altri ---
  {
    id: 7, book_id: 1, requester_id: 4, lender_id: 1,
    status: 'requested',
    requested_at: daysAgo(1),
    days_requested: 14,
    message: 'Vorrei rileggerlo, è anni che ci penso.'
  },
  {
    id: 8, book_id: 2, requester_id: 6, lender_id: 1,
    status: 'confirmed',
    requested_at: daysAgo(4),
    confirmed_at: daysAgo(2),
    days_requested: 10,
    message: 'Per un gruppo di studi.'
  },
  {
    id: 9, book_id: 5, requester_id: 8, lender_id: 1,
    status: 'borrowed',
    requested_at: daysAgo(15),
    confirmed_at: daysAgo(13),
    borrowed_at: daysAgo(11),
    days_requested: 14,           // ancora nei termini
    message: 'Per un ciclo di letture organizzate dall\'associazione.'
  },
  {
    id: 10, book_id: 3, requester_id: 5, lender_id: 1,
    status: 'returning',
    requested_at: daysAgo(40),
    confirmed_at: daysAgo(38),
    borrowed_at: daysAgo(35),
    returning_at: daysAgo(1),
    days_requested: 28,
    message: 'Restituzione in corso, grazie!'
  },

  // --- Prestiti returned per supportare la regola "recensisci solo dopo" ---
  { id: 11, book_id: 6, requester_id: 4, lender_id: 2, status: 'returned',
    requested_at: daysAgo(120), confirmed_at: daysAgo(118), borrowed_at: daysAgo(115),
    returning_at: daysAgo(90), returned_at: daysAgo(88), days_requested: 21 },
  { id: 12, book_id: 11, requester_id: 2, lender_id: 4, status: 'returned',
    requested_at: daysAgo(100), confirmed_at: daysAgo(98), borrowed_at: daysAgo(95),
    returning_at: daysAgo(70), returned_at: daysAgo(68), days_requested: 21 },
  { id: 13, book_id: 14, requester_id: 3, lender_id: 5, status: 'returned',
    requested_at: daysAgo(80), confirmed_at: daysAgo(78), borrowed_at: daysAgo(75),
    returning_at: daysAgo(50), returned_at: daysAgo(48), days_requested: 21 },
  { id: 14, book_id: 8, requester_id: 6, lender_id: 3, status: 'returned',
    requested_at: daysAgo(150), confirmed_at: daysAgo(148), borrowed_at: daysAgo(145),
    returning_at: daysAgo(120), returned_at: daysAgo(118), days_requested: 21 },
  { id: 15, book_id: 4, requester_id: 7, lender_id: 1, status: 'returned',
    requested_at: daysAgo(90), confirmed_at: daysAgo(88), borrowed_at: daysAgo(85),
    returning_at: daysAgo(60), returned_at: daysAgo(58), days_requested: 21 }
];

/* ============================================================
   MESSAGGI DI PRESTITO (v1.7) — chat associata a ciascun prestito
   ============================================================
   Ogni prestito ha una conversazione tra richiedente e prestatore.
   I messaggi sono di due tipi:
     - 'user': scritti da uno dei due partecipanti
     - 'system': generati automaticamente alle transizioni di stato
   I messaggi di sistema servono come "scia narrativa" del prestito
   nella chat: la conversazione racconta la storia del volume.
   `read_by` è la lista degli userId che hanno aperto la chat dopo
   la creazione di quel messaggio.
   ============================================================ */
export const SAMPLE_MESSAGES = [
  // Per il prestito id=2 (Chiara chiede a Luca, status: confirmed)
  { id: 1, loan_id: 2, sender_id: null, type: 'system',
    event_type: 'requested',
    content: 'Richiesta di prestito inviata.',
    created_at: daysAgo(5), read_by: [1, 4] },
  { id: 2, loan_id: 2, sender_id: 1, type: 'user',
    content: 'Ciao Luca, ti scrivo per la richiesta — vorrei leggerlo prima delle vacanze. Quando posso passare a prenderlo?',
    created_at: daysAgo(5), read_by: [1, 4] },
  { id: 3, loan_id: 2, sender_id: 4, type: 'user',
    content: 'Ciao Chiara! Tutto bene, ti confermo. Sono al Vomero, ti va bene passare nel pomeriggio fra le 17 e le 19?',
    created_at: daysAgo(2), read_by: [1, 4] },
  { id: 4, loan_id: 2, sender_id: null, type: 'system',
    event_type: 'confirmed',
    content: 'Richiesta confermata. Il richiedente può recarsi a ritirare il volume.',
    created_at: daysAgo(1), read_by: [4] },
  { id: 5, loan_id: 2, sender_id: 1, type: 'user',
    content: 'Perfetto, passo domani verso le 18. A presto!',
    created_at: daysAgo(1), read_by: [1] },

  // Per il prestito id=3 (Chiara → Giulia, status: borrowed, nei termini)
  { id: 6, loan_id: 3, sender_id: null, type: 'system',
    event_type: 'requested',
    content: 'Richiesta di prestito inviata.',
    created_at: daysAgo(12), read_by: [1, 5] },
  { id: 7, loan_id: 3, sender_id: 1, type: 'user',
    content: 'Ciao Giulia, mi servirebbe per un saggio che sto scrivendo. Se possibile vorrei tenerlo un paio di settimane.',
    created_at: daysAgo(12), read_by: [1, 5] },
  { id: 8, loan_id: 3, sender_id: null, type: 'system',
    event_type: 'confirmed',
    content: 'Richiesta confermata.',
    created_at: daysAgo(10), read_by: [1, 5] },
  { id: 9, loan_id: 3, sender_id: 5, type: 'user',
    content: 'Volentieri! Lo trovi da me quando vuoi. Spero ti sia utile.',
    created_at: daysAgo(10), read_by: [1, 5] },
  { id: 10, loan_id: 3, sender_id: null, type: 'system',
    event_type: 'borrowed',
    content: 'Volume ritirato. Periodo pattuito: 14 giorni.',
    created_at: daysAgo(8), read_by: [1, 5] },

  // Per il prestito id=4 (Chiara → Spaccanapoli, SCADUTO)
  { id: 11, loan_id: 4, sender_id: null, type: 'system',
    event_type: 'requested',
    content: 'Richiesta di prestito inviata.',
    created_at: daysAgo(20), read_by: [1, 9] },
  { id: 12, loan_id: 4, sender_id: null, type: 'system',
    event_type: 'confirmed',
    content: 'Richiesta confermata.',
    created_at: daysAgo(18), read_by: [1, 9] },
  { id: 13, loan_id: 4, sender_id: null, type: 'system',
    event_type: 'borrowed',
    content: 'Volume ritirato. Periodo pattuito: 7 giorni.',
    created_at: daysAgo(15), read_by: [1, 9] },

  // Per il prestito id=6 (Chiara → Anna, RETURNED — chat conclusa)
  { id: 14, loan_id: 6, sender_id: null, type: 'system',
    event_type: 'requested',
    content: 'Richiesta di prestito inviata.',
    created_at: daysAgo(60), read_by: [1, 3] },
  { id: 15, loan_id: 6, sender_id: 1, type: 'user',
    content: 'Anna, mi serve per la mia tesina. Tre settimane sono troppe?',
    created_at: daysAgo(60), read_by: [1, 3] },
  { id: 16, loan_id: 6, sender_id: 3, type: 'user',
    content: 'Nessun problema, lo trovi da me. Buon lavoro!',
    created_at: daysAgo(58), read_by: [1, 3] },
  { id: 17, loan_id: 6, sender_id: null, type: 'system',
    event_type: 'confirmed',
    content: 'Richiesta confermata.',
    created_at: daysAgo(58), read_by: [1, 3] },
  { id: 18, loan_id: 6, sender_id: null, type: 'system',
    event_type: 'borrowed',
    content: 'Volume ritirato.',
    created_at: daysAgo(55), read_by: [1, 3] },
  { id: 19, loan_id: 6, sender_id: null, type: 'system',
    event_type: 'returning',
    content: 'Restituzione avviata dal richiedente.',
    created_at: daysAgo(8), read_by: [1, 3] },
  { id: 20, loan_id: 6, sender_id: 1, type: 'user',
    content: 'Anna, grazie mille — è stato preziosissimo. Te lo riporto domani mattina.',
    created_at: daysAgo(7), read_by: [1, 3] },
  { id: 21, loan_id: 6, sender_id: null, type: 'system',
    event_type: 'returned',
    content: 'Prestito concluso.',
    created_at: daysAgo(5), read_by: [1, 3] },

  // Per il prestito id=9 (Lettori Erranti id=8 → Chiara, BORROWED)
  { id: 22, loan_id: 9, sender_id: null, type: 'system',
    event_type: 'requested',
    content: 'Richiesta di prestito inviata.',
    created_at: daysAgo(15), read_by: [1, 8] },
  { id: 23, loan_id: 9, sender_id: 8, type: 'user',
    content: 'Ciao Chiara, vorremmo includere il volume in un ciclo di letture organizzate dalla nostra associazione. Possiamo passare a ritirarlo?',
    created_at: daysAgo(15), read_by: [1, 8] },
  { id: 24, loan_id: 9, sender_id: 1, type: 'user',
    content: 'Volentieri! Sono molto contenta che lo includiate nelle vostre letture. Vi aspetto.',
    created_at: daysAgo(14), read_by: [1] }, // chiara non l'ha riletta
  { id: 25, loan_id: 9, sender_id: null, type: 'system',
    event_type: 'confirmed',
    content: 'Richiesta confermata.',
    created_at: daysAgo(13), read_by: [1, 8] },
  { id: 26, loan_id: 9, sender_id: null, type: 'system',
    event_type: 'borrowed',
    content: 'Volume ritirato.',
    created_at: daysAgo(11), read_by: [1, 8] }
];

/* v2.4: post di esempio dei sample user, con reazioni e (uno) report
   per popolare la tab "Segnalazioni" dell'admin. Date relative
   (daysAgo) così il feed è sempre fresco. */
export const SAMPLE_POSTS = [
  { id: 'p_sample_001', author_id: 7,
    content: 'Buongiorno! Da oggi nella nostra biblioteca trovate la collezione completa di Andrea Camilleri, donata da una famiglia del quartiere. Venite a sfogliarli.',
    created_at: daysAgo(2),
    reactions: { '👍': [1, 3, 5], '❤️': [2] },
    reports: [] },
  { id: 'p_sample_002', author_id: 9,
    content: 'Sabato pomeriggio organizziamo un piccolo gruppo di lettura su «Le città invisibili» di Calvino. Chi vuole partecipare può prenotarsi via messaggio.',
    created_at: daysAgo(5),
    reactions: { '👍': [1, 6], '👏': [3] },
    reports: [] },
  { id: 'p_sample_003', author_id: 3,
    content: 'Aggiunto un volume rarissimo: prima edizione di «Il Gattopardo» del 1958. Non lo presto, ma se passate ve lo faccio sfogliare.',
    created_at: daysAgo(1),
    reactions: { '❤️': [1, 5], '🤔': [2] },
    reports: [] },
  { id: 'p_sample_004', author_id: 1,
    content: 'Sto cercando una copia in italiano di «Stoner» di John Williams. Se qualcuno ce l\'ha e vorrebbe scambiarlo o prestarmelo, scrivetemi!',
    created_at: daysAgo(3),
    reactions: { '👍': [3, 7], '🤔': [5] },
    reports: [] },
  { id: 'p_sample_005', author_id: 4,
    content: 'Comprate solo libri usati! La sostenibilità passa anche da qui. Smettetela di sostenere l\'editoria che inquina.',
    created_at: daysAgo(4),
    reactions: { '🤔': [1, 3] },
    reports: [
      { reporter_id: 2, reason: 'off-topic', note: 'Sembra più un proclama politico che un post sulla libreria.', ts: daysAgo(3) }
    ] }
];


/* Base di follower per ogni libreria: il conteggio mostrato sarà
   base + 1 se l'utente corrente la segue. Approssimazione necessaria
   in un prototipo a singolo browser (non conosciamo i follow altrui). */
export const SAMPLE_FOLLOWER_BASE = { 1: 4, 2: 6, 3: 9, 4: 3, 5: 5, 6: 2, 7: 38, 8: 21 };

/* ------------------------------------------------------------------
   CATALOGO DELLE GRAFICHE COVER LIBRERIA (v1.1) — 15 design
   ------------------------------------------------------------------
   15 grafiche minimali selezionabili dalle impostazioni del profilo
   come "decorazione" della propria libreria. Sono raggruppate in tre
   famiglie (pattern, icone, glifi tipografici). Tutte usano
   currentColor così si adattano al tema cromatico scelto: per le
   librerie personali la decorazione è più morbida, per gli enti più
   strutturata (lo stile cambia leggermente in base al tipo).
   ------------------------------------------------------------------ */
export const LIBRARY_COVER_DESIGNS = [
  /* ---- PATTERN (decorazioni astratte di sfondo) ------------------ */
  { key: 'p-dots',    name: 'Pois',         kind: 'pattern', render() {
      let s = ''; for (let r = 0; r < 7; r++) for (let c = 0; c < 12; c++)
        s += `<circle cx="${c*18+10}" cy="${r*18+12}" r="2" fill="currentColor" opacity="0.45"/>`;
      return s;
  }},
  { key: 'p-stripes', name: 'Righe',        kind: 'pattern', render() {
      let s = '<g transform="rotate(-30 100 70)">';
      for (let i = -8; i < 22; i++)
        s += `<line x1="${i*16}" y1="-30" x2="${i*16}" y2="170" stroke="currentColor" stroke-width="2.5" opacity="0.30"/>`;
      return s + '</g>';
  }},
  { key: 'p-waves',   name: 'Onde',         kind: 'pattern', render() {
      let s = '';
      for (let r = 0; r < 5; r++) {
        let d = `M 0 ${r*32+24}`;
        for (let x = 0; x <= 200; x += 20)
          d += ` Q ${x+10} ${r*32+24+(x/20%2?10:-10)} ${x+20} ${r*32+24}`;
        s += `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" opacity="0.40"/>`;
      }
      return s;
  }},
  { key: 'p-grid',    name: 'Griglia',      kind: 'pattern', render() {
      let s = '';
      for (let x = 20; x < 200; x += 20)
        s += `<line x1="${x}" y1="0" x2="${x}" y2="140" stroke="currentColor" stroke-width="1" opacity="0.30"/>`;
      for (let y = 20; y < 140; y += 20)
        s += `<line x1="0" y1="${y}" x2="200" y2="${y}" stroke="currentColor" stroke-width="1" opacity="0.30"/>`;
      return s;
  }},
  { key: 'p-circles', name: 'Cerchi',       kind: 'pattern', render() {
      return `
        <circle cx="100" cy="70" r="60" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.30"/>
        <circle cx="100" cy="70" r="44" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.40"/>
        <circle cx="100" cy="70" r="28" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.50"/>
        <circle cx="100" cy="70" r="12" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.65"/>`;
  }},

  /* ---- ICONE (un soggetto centrale a tema lettura) --------------- */
  { key: 'i-book-open',  name: 'Libro aperto',  kind: 'icon', render() {
      return `<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.75">
        <path d="M40 95 Q100 75 100 50 Q100 75 160 95 L 160 38 Q100 18 100 38 Q100 18 40 38 Z"/>
        <line x1="100" y1="38" x2="100" y2="95"/>
        <line x1="55" y1="50" x2="88" y2="46"/>
        <line x1="55" y1="62" x2="88" y2="58"/>
        <line x1="55" y1="74" x2="88" y2="70"/>
        <line x1="112" y1="46" x2="145" y2="50"/>
        <line x1="112" y1="58" x2="145" y2="62"/>
        <line x1="112" y1="70" x2="145" y2="74"/>
      </g>`;
  }},
  { key: 'i-shelf',      name: 'Scaffale',      kind: 'icon', render() {
      let s = '<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.75">';
      // due ripiani
      s += '<line x1="36" y1="62" x2="164" y2="62" stroke-width="3"/>';
      s += '<line x1="36" y1="108" x2="164" y2="108" stroke-width="3"/>';
      // libri sul ripiano alto
      [40,52,62,75,88,98,110,122,134,148].forEach((x,i) => {
        const h = 22 + (i%3)*4, w = (i%2)?9:11;
        s += `<rect x="${x}" y="${62-h}" width="${w}" height="${h}" fill="currentColor" fill-opacity="0.35" stroke-width="1.5"/>`;
      });
      // libri sul ripiano basso
      [40,54,66,78,92,104,118,132,146].forEach((x,i) => {
        const h = 24 + (i%2)*5, w = (i%3)?10:12;
        s += `<rect x="${x}" y="${108-h}" width="${w}" height="${h}" fill="currentColor" fill-opacity="0.35" stroke-width="1.5"/>`;
      });
      return s + '</g>';
  }},
  { key: 'i-stack',      name: 'Pila',          kind: 'icon', render() {
      return `<g fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="2.5" opacity="0.85">
        <rect x="55" y="100" width="90" height="14" rx="2"/>
        <rect x="48" y="84"  width="104" height="14" rx="2"/>
        <rect x="60" y="68"  width="80"  height="14" rx="2"/>
        <rect x="50" y="52"  width="100" height="14" rx="2"/>
        <rect x="64" y="36"  width="72"  height="14" rx="2"/>
      </g>`;
  }},
  { key: 'i-feather',    name: 'Penna d\'oca', kind: 'icon', render() {
      return `<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">
        <path d="M140 28 Q60 50 56 116 L80 100 Q100 70 140 28 Z" fill="currentColor" fill-opacity="0.30"/>
        <line x1="80" y1="100" x2="56" y2="116"/>
        <line x1="56" y1="116" x2="32" y2="124"/>
        <path d="M76 78 Q100 70 130 50" stroke-width="1.5"/>
        <path d="M70 90 Q90 84 120 64" stroke-width="1.5"/>
      </g>`;
  }},
  { key: 'i-bookmark',   name: 'Segnalibro',    kind: 'icon', render() {
      return `<g opacity="0.85">
        <path d="M85 22 L115 22 L115 118 L100 105 L85 118 Z"
              fill="currentColor" fill-opacity="0.40"
              stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="100" cy="50" r="6" fill="currentColor" fill-opacity="0.8"/>
      </g>`;
  }},

  /* ---- GLIFI TIPOGRAFICI (lettera/segno grande al centro) -------- */
  { key: 'g-section', name: 'Paragrafo §',  kind: 'glyph', render() {
      return `<text x="100" y="98" text-anchor="middle" font-family="serif" font-style="italic" font-size="120" fill="currentColor" opacity="0.7">§</text>`;
  }},
  { key: 'g-aldus',   name: 'Foglia di Aldo ❧', kind: 'glyph', render() {
      return `<text x="100" y="100" text-anchor="middle" font-family="serif" font-size="110" fill="currentColor" opacity="0.75">❧</text>`;
  }},
  { key: 'g-fleuron', name: 'Fiorone ☙',    kind: 'glyph', render() {
      return `<text x="100" y="100" text-anchor="middle" font-family="serif" font-size="110" fill="currentColor" opacity="0.75">☙</text>`;
  }},
  { key: 'g-amp',     name: 'Et &amp;',     kind: 'glyph', render() {
      return `<text x="100" y="100" text-anchor="middle" font-family="serif" font-style="italic" font-size="120" fill="currentColor" opacity="0.7">&amp;</text>`;
  }},
  { key: 'g-monogram',name: 'Monogramma',   kind: 'glyph', render(opts) {
      const ch = (opts && opts.letter) ? opts.letter : 'A';
      return `<text x="100" y="100" text-anchor="middle" font-family="serif" font-size="110" fill="currentColor" opacity="0.85">${ch}</text>`;
  }}
];

/* Mappa rapida per chiave → design */
export const LIBRARY_COVER_DESIGN_MAP = Object.fromEntries(LIBRARY_COVER_DESIGNS.map(d => [d.key, d]));


export const SAMPLE_BOOKS = [
  { id: 1, title: 'Se questo è un uomo', author: 'Primo Levi', year: 1947,
    category: 'Classici', categories: ['Classici', 'Narrativa letteraria'], owner_id: 1, isbn: '',
    description: 'Testimonianza della prigionia di Primo Levi ad Auschwitz. Una delle opere fondamentali della letteratura del Novecento italiano.',
    language: 'Italiano', pages: 216, condition: 'buone condizioni',
    views: 342, loan_requests: 12, available: true,
    cover_gradient: 'linear-gradient(135deg, #7a1e2b, #3d342e)',
    added: '2024-03-15' },
  { id: 2, title: 'Le città invisibili', author: 'Italo Calvino', year: 1972,
    category: 'Narrativa contemporanea', categories: ['Narrativa contemporanea', 'Narrativa letteraria'], owner_id: 1, isbn: '',
    description: 'Dialogo immaginario tra Marco Polo e Kublai Khan sulle città visitate dal mercante veneziano, metafore delle città della memoria, del desiderio, dei segni.',
    language: 'Italiano', pages: 173, condition: 'ottime condizioni',
    views: 278, loan_requests: 8, available: true,
    cover_gradient: 'linear-gradient(135deg, #b08840, #6e7a5a)',
    added: '2024-03-20' },
  { id: 3, title: 'Uomini che odiano le donne', author: 'Stieg Larsson', year: 2005,
    category: 'Gialli e noir', categories: ['Gialli e noir', 'Thriller'], owner_id: 2, isbn: '',
    description: 'Primo capitolo della trilogia Millennium. Un giornalista investigativo e una hacker indagano su un caso di scomparsa irrisolto da quarant\'anni.',
    language: 'Italiano', pages: 678, condition: 'buone condizioni',
    views: 189, loan_requests: 5, available: true,
    cover_gradient: 'linear-gradient(135deg, #1a1512, #7a1e2b)',
    added: '2024-02-10' },
  { id: 4, title: 'Il nome della rosa', author: 'Umberto Eco', year: 1980,
    category: 'Classici', categories: ['Classici', 'Narrativa letteraria'], owner_id: 3, isbn: '',
    description: 'Romanzo storico ambientato in un\'abbazia benedettina del XIV secolo. Un maestro francescano indaga su una serie di morti misteriose.',
    language: 'Italiano', pages: 512, condition: 'eccellenti (edizione del 1980)',
    views: 456, loan_requests: 18, available: false,
    cover_gradient: 'linear-gradient(135deg, #5a141f, #b08840)',
    added: '2024-01-08' },
  { id: 5, title: 'Canti', author: 'Giacomo Leopardi', year: 1835,
    category: 'Poesia', categories: ['Poesia', 'Poesia italiana'], owner_id: 3, isbn: '',
    description: 'Raccolta completa dei componimenti poetici di Leopardi. Edizione ottocentesca con note critiche originali.',
    language: 'Italiano', pages: 280, condition: 'da collezione, 1867',
    views: 512, loan_requests: 3, available: true,
    cover_gradient: 'linear-gradient(135deg, #3d342e, #b08840)',
    added: '2023-12-15' },
  { id: 6, title: 'Storia di Napoli', author: 'Benedetto Croce', year: 1925,
    category: 'Storia', categories: ['Storia', 'Saggistica generale'], owner_id: 4, isbn: '',
    description: 'Opera monumentale di Croce sulla storia della città di Napoli dall\'antichità fino al Risorgimento.',
    language: 'Italiano', pages: 720, condition: 'buone condizioni',
    views: 298, loan_requests: 9, available: true,
    cover_gradient: 'linear-gradient(135deg, #6e7a5a, #3d342e)',
    added: '2024-05-12' },
  { id: 7, title: 'La coscienza di Zeno', author: 'Italo Svevo', year: 1923,
    category: 'Classici', categories: ['Classici', 'Narrativa letteraria'], owner_id: 5, isbn: '',
    description: 'Memoriale autobiografico di Zeno Cosini, scritto per il suo psicoanalista. Capolavoro del romanzo italiano del Novecento.',
    language: 'Italiano', pages: 480, condition: 'ottime condizioni',
    views: 234, loan_requests: 6, available: true,
    cover_gradient: 'linear-gradient(135deg, #7a1e2b, #b08840)',
    added: '2024-02-22' },
  { id: 8, title: 'Dune', author: 'Frank Herbert', year: 1965,
    category: 'Fantascienza', categories: ['Fantascienza', 'Distopia'], owner_id: 6, isbn: '',
    description: 'Epopea fantascientifica ambientata sul pianeta desertico Arrakis. Considerato uno dei capolavori assoluti della SF.',
    language: 'Italiano', pages: 820, condition: 'buone condizioni',
    views: 412, loan_requests: 15, available: true,
    cover_gradient: 'linear-gradient(135deg, #b08840, #5a141f)',
    added: '2024-04-05' },
  { id: 9, title: 'L\'amica geniale', author: 'Elena Ferrante', year: 2011,
    category: 'Narrativa contemporanea', categories: ['Narrativa contemporanea', 'Narrativa letteraria'], owner_id: 5, isbn: '9788866324119',
    description: 'Primo volume della quadrilogia napoletana. L\'amicizia tra Lila ed Elena in un rione di Napoli degli anni \'50.',
    language: 'Italiano', pages: 400, condition: 'come nuovo',
    views: 389, loan_requests: 22, available: true,
    cover_gradient: 'linear-gradient(135deg, #7a1e2b, #6e7a5a)',
    added: '2024-03-28' },
  { id: 10, title: 'Il sistema periodico', author: 'Primo Levi', year: 1975,
    category: 'Saggistica', categories: ['Saggistica', 'Saggistica generale'], owner_id: 1, isbn: '',
    description: 'Autobiografia strutturata sugli elementi chimici. Un dialogo tra la vita e la scienza.',
    language: 'Italiano', pages: 240, condition: 'ottime condizioni',
    views: 156, loan_requests: 4, available: true,
    cover_gradient: 'linear-gradient(135deg, #3d342e, #7a1e2b)',
    added: '2024-04-18' },
  { id: 11, title: 'Gomorra', author: 'Roberto Saviano', year: 2006,
    category: 'Saggistica', categories: ['Saggistica', 'Saggistica generale'], owner_id: 4, isbn: '',
    description: 'Inchiesta sulla camorra campana. Un viaggio nelle dinamiche del potere criminale contemporaneo.',
    language: 'Italiano', pages: 331, condition: 'buone condizioni',
    views: 267, loan_requests: 7, available: true,
    cover_gradient: 'linear-gradient(135deg, #1a1512, #5a141f)',
    added: '2024-05-20' },
  { id: 12, title: 'Neuromante', author: 'William Gibson', year: 1984,
    category: 'Fantascienza', categories: ['Fantascienza', 'Distopia'], owner_id: 6, isbn: '',
    description: 'Romanzo seminale del cyberpunk. La storia di Case, hacker-mercenario, in un futuro distopico dominato dalle corporazioni.',
    language: 'Italiano', pages: 288, condition: 'discrete',
    views: 178, loan_requests: 5, available: true,
    cover_gradient: 'linear-gradient(135deg, #6e7a5a, #1a1512)',
    added: '2024-05-28' },

  /* Volumi delle librerie-ente (owner_id 7 e 8) */
  { id: 13, title: 'La pelle', author: 'Curzio Malaparte', year: 1949,
    category: 'Classici', categories: ['Classici', 'Narrativa letteraria'], owner_id: 7, isbn: '',
    description: 'Romanzo crudo e visionario su Napoli durante la Seconda guerra mondiale, tra le rovine e la sopravvivenza.',
    language: 'Italiano', pages: 360, condition: 'buone condizioni',
    views: 198, loan_requests: 6, available: true,
    cover_gradient: 'linear-gradient(135deg, #5a141f, #b08840)',
    added: '2024-06-10' },
  { id: 14, title: 'Il ventre di Napoli', author: 'Matilde Serao', year: 1884,
    category: 'Saggistica', categories: ['Saggistica', 'Saggistica generale'], owner_id: 7, isbn: '',
    description: 'Inchiesta giornalistica sulle condizioni dei quartieri popolari napoletani di fine Ottocento.',
    language: 'Italiano', pages: 180, condition: 'discrete',
    views: 156, loan_requests: 4, available: true,
    cover_gradient: 'linear-gradient(135deg, #3d342e, #7a1e2b)',
    added: '2024-04-22' },
  { id: 15, title: 'Montedidio', author: 'Erri De Luca', year: 2001,
    category: 'Narrativa contemporanea', categories: ['Narrativa contemporanea', 'Narrativa letteraria'], owner_id: 7, isbn: '',
    description: 'Un ragazzo, una lingua che si fa adulta e un quartiere di Napoli che diventa mondo.',
    language: 'Italiano', pages: 180, condition: 'come nuovo',
    views: 134, loan_requests: 3, available: false,
    cover_gradient: 'linear-gradient(135deg, #7a1e2b, #3d342e)',
    added: '2024-05-30' },
  { id: 16, title: 'Le otto montagne', author: 'Paolo Cognetti', year: 2016,
    category: 'Narrativa contemporanea', categories: ['Narrativa contemporanea', 'Narrativa letteraria'], owner_id: 8, isbn: '',
    description: 'L\'amicizia tra due uomini e il loro rapporto con la montagna, lungo l\'arco di una vita.',
    language: 'Italiano', pages: 199, condition: 'ottime condizioni',
    views: 221, loan_requests: 9, available: true,
    cover_gradient: 'linear-gradient(135deg, #6e7a5a, #b08840)',
    added: '2024-06-05' },
  { id: 17, title: 'La Storia', author: 'Elsa Morante', year: 1974,
    category: 'Classici', categories: ['Classici', 'Narrativa letteraria'], owner_id: 8, isbn: '',
    description: 'Un grande romanzo corale sulla Seconda guerra mondiale vista dagli ultimi.',
    language: 'Italiano', pages: 656, condition: 'buone condizioni',
    views: 187, loan_requests: 7, available: true,
    cover_gradient: 'linear-gradient(135deg, #b08840, #6e7a5a)',
    added: '2024-03-18' },
  { id: 18, title: 'Il barone rampante', author: 'Italo Calvino', year: 1957,
    category: 'Classici', categories: ['Classici', 'Narrativa letteraria'], owner_id: 8, isbn: '',
    description: 'Cosimo decide di vivere sugli alberi e non scenderne mai più: una favola sulla libertà.',
    language: 'Italiano', pages: 264, condition: 'buone condizioni',
    views: 165, loan_requests: 5, available: true,
    cover_gradient: 'linear-gradient(135deg, #6e7a5a, #3d342e)',
    added: '2024-05-12' },
  /* ---- Libri della Libreria Indipendente Spaccanapoli (id 9) ----
     Per dimostrare il modello BISAC multi-tag: ogni volume porta 2-3
     tag, intrecciando macro-aree diverse (es. poesia + storica). */
  { id: 19, title: 'Napoli milionaria!', author: 'Eduardo De Filippo', year: 1945,
    category: 'Teatro contemporaneo', categories: ['Teatro contemporaneo', 'Classici', 'Narrativa storica'],
    owner_id: 9, isbn: '9788806065850',
    description: 'Commedia in tre atti ambientata nella Napoli del dopoguerra: il dramma della sopravvivenza e della dignità in una città devastata.',
    language: 'Italiano', pages: 96, condition: 'buone condizioni',
    views: 142, loan_requests: 4, available: true,
    cover_gradient: 'linear-gradient(135deg, #7a1e2b, #b08840)',
    added: '2024-06-08' },
  { id: 20, title: 'Vesuviana', author: 'Erri De Luca', year: 2009,
    category: 'Poesia italiana', categories: ['Poesia italiana', 'Poesia contemporanea'],
    owner_id: 9, isbn: '',
    description: 'Raccolta poetica dedicata al vulcano e al paesaggio campano: voci, fatiche e bellezze del territorio.',
    language: 'Italiano', pages: 112, condition: 'ottime condizioni',
    views: 96, loan_requests: 2, available: true,
    cover_gradient: 'linear-gradient(135deg, #b08840, #3d342e)',
    added: '2024-07-21' },
  { id: 21, title: 'Il resto di niente', author: 'Enzo Striano', year: 1986,
    category: 'Narrativa storica', categories: ['Narrativa storica', 'Biografie storiche'],
    owner_id: 9, isbn: '',
    description: 'La storia di Eleonora Pimentel Fonseca e della Repubblica Napoletana del 1799: una donna, un\'idea di libertà, una città.',
    language: 'Italiano', pages: 442, condition: 'buone condizioni',
    views: 211, loan_requests: 8, available: false,
    cover_gradient: 'linear-gradient(135deg, #7a1e2b, #3d342e)',
    added: '2024-04-30' },
  /* ---- Libri del Centro Culturale Mezzogiorno (id 10) ---- */
  { id: 22, title: 'L\'oro di Napoli', author: 'Giuseppe Marotta', year: 1947,
    category: 'Racconti', categories: ['Racconti', 'Classici', 'Narrativa storica'],
    owner_id: 10, isbn: '9788817010917',
    description: 'Raccolta di racconti che fotografano la Napoli del dopoguerra con tenerezza e ironia: ritratti popolari di una città stratificata.',
    language: 'Italiano', pages: 286, condition: 'buone condizioni',
    views: 178, loan_requests: 6, available: true,
    cover_gradient: 'linear-gradient(135deg, #b08840, #6e7a5a)',
    added: daysAgo(8).slice(0,10) },
  { id: 23, title: 'Storia del Mezzogiorno', author: 'Giuseppe Galasso', year: 1992,
    category: 'Storia', categories: ['Storia', 'Saggistica generale', 'Sociologia'],
    owner_id: 10, isbn: '',
    description: 'Sintesi monumentale della storia meridionale dall\'antichità all\'età contemporanea: una lettura strutturale del Sud Italia.',
    language: 'Italiano', pages: 720, condition: 'ottime condizioni',
    views: 134, loan_requests: 3, available: true,
    cover_gradient: 'linear-gradient(135deg, #3d342e, #6e7a5a)',
    added: daysAgo(3).slice(0,10) },
  { id: 24, title: 'Le vie dei canti', author: 'Bruce Chatwin', year: 1987,
    category: 'Letteratura di viaggio', categories: ['Letteratura di viaggio', 'Antropologia', 'Diari di viaggio'],
    owner_id: 10, isbn: '9788845911415',
    description: 'L\'Australia degli aborigeni come mappa di canti: un viaggio fra etnografia e narrativa, fra il visibile e l\'invisibile.',
    language: 'Italiano', pages: 312, condition: 'discrete condizioni',
    views: 188, loan_requests: 5, available: true,
    cover_gradient: 'linear-gradient(135deg, #6e7a5a, #b08840)',
    added: daysAgo(1).slice(0,10) }
];

/* -----------------------------------------------------------------
   2. STORAGE — persistenza in localStorage
   ----------------------------------------------------------------- */

