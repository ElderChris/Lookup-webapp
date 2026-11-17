// =============================================================================
// apps/api/prisma/seed.mjs
// =============================================================================
// Esegue: npm run db:seed (da apps/api/) oppure cd apps/api && npx prisma db seed
//
// Popola il database con dati di test che riproducono i SAMPLE_* del frontend
// (apps/web/js/data.js). In Fase 1b si seedano:
//   - 11 utenti (6 persone + 5 organizzazioni/librerie)
//   - Tassonomia BISAC essenziale (~15 categorie)
//   - 20 libri di esempio (subset di SAMPLE_BOOKS)
//   - Preferenze utente (UserPreference) per chi le ha settate
//   - Profili organizzazione (OrganizationProfile) per i 5 enti
//
// In Fase 1b.2 (next session) espanderemo a:
//   - Tutti i 50+ libri di SAMPLE_BOOKS
//   - LoanRequest, LoanMessage, Review
//   - Follow, Like, Notification
//   - Post, PostReaction, PostReport
//
// Idempotenza: lo script usa upsert dove possibile, e disconnette pulito alla fine.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

// =============================================================================
// FASE 3.3: password comune per tutti i seed users
// =============================================================================
// Tutti gli utenti seed hanno la stessa password: `Lookup2026!`. Questo
// permette di fare login vero via Better Auth durante lo sviluppo e i test
// end-to-end (curl, browser reali).
//
// L'algoritmo di hashing replica esattamente quello di Better Auth v1.x:
//   salt = 16 bytes random hex
//   key  = scrypt(password.normalize('NFKC'), salt, 64 bytes) hex
//   storage format: `${salt}:${key}` (colon-separated hex)
//
// Il record Account creato ha:
//   providerId = 'credential'      (il provider email/password di Better Auth)
//   accountId  = email dell'utente (Better Auth usa email come accountId qui)
//   password   = hash calcolato sopra
//
// In produzione: OGNI utente ha la sua password + emailVerified via link email.
// =============================================================================

const DEFAULT_SEED_PASSWORD = 'Lookup2026!';

function hashPasswordForBetterAuth(password) {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password.normalize('NFKC'), salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

// =============================================================================
// 1. UTENTI (11)
// =============================================================================
// Tradotti da SAMPLE_USERS in apps/web/js/data.js.
// id 1-6: persone, id 7-10: organizzazioni, id 11: admin
const USERS = [
  {
    id: 'usr_chiara',
    username: 'chiara.morandi',
    displayName: 'Chiara Morandi',
    email: 'c.morandi@mail.it',
    accountType: 'person',
    city: 'Napoli, Chiaia',
    lat: 40.8358,
    lng: 14.2351,
    bio: 'Appassionata di letteratura italiana del Novecento e di saggistica filosofica.',
    createdAt: new Date('2024-03-12'),
  },
  {
    id: 'usr_marco',
    username: 'marco.devito',
    displayName: 'Marco De Vito',
    email: 'm.devito@mail.it',
    accountType: 'person',
    city: 'Napoli, Vomero',
    lat: 40.8488,
    lng: 14.2295,
    bio: 'Collezionista di gialli e noir, con particolare attenzione agli autori scandinavi.',
    createdAt: new Date('2024-01-22'),
  },
  {
    id: 'usr_anna',
    username: 'anna.russo',
    displayName: 'Anna Russo',
    email: 'a.russo@mail.it',
    accountType: 'person',
    city: 'Napoli, Posillipo',
    lat: 40.8145,
    lng: 14.2055,
    bio: 'Biblioteca di famiglia con edizioni ottocentesche di classici.',
    createdAt: new Date('2023-11-05'),
  },
  {
    id: 'usr_luca',
    username: 'luca.esposito',
    displayName: 'Luca Esposito',
    email: 'l.esposito@mail.it',
    accountType: 'person',
    city: 'Napoli, Centro Storico',
    lat: 40.8518,
    lng: 14.2681,
    bio: 'Saggi di storia locale e tradizioni campane.',
    createdAt: new Date('2024-05-08'),
  },
  {
    id: 'usr_giulia',
    username: 'giulia.ferrari',
    displayName: 'Giulia Ferrari',
    email: 'g.ferrari@mail.it',
    accountType: 'person',
    city: 'Portici',
    lat: 40.8147,
    lng: 14.3417,
    bio: 'Poesia contemporanea italiana e traduzioni dal tedesco.',
    createdAt: new Date('2024-02-18'),
  },
  {
    id: 'usr_roberto',
    username: 'roberto.mazzone',
    displayName: 'Roberto Mazzone',
    email: 'r.mazzone@mail.it',
    accountType: 'person',
    city: 'Pozzuoli',
    lat: 40.824,
    lng: 14.1204,
    bio: 'Fantascienza classica e distopie.',
    createdAt: new Date('2024-04-01'),
  },

  // Organizzazioni (librerie-ente)
  {
    id: 'usr_biblio_sanita',
    username: 'biblioteca.sanita',
    displayName: 'Biblioteca di Comunità Rione Sanità',
    email: 'info@bibliosanita.org',
    accountType: 'organization',
    city: 'Napoli, Rione Sanità',
    lat: 40.8585,
    lng: 14.2515,
    bio: 'Biblioteca di comunità nata dal basso: un presidio culturale aperto nel cuore del Rione Sanità.',
    createdAt: new Date('2023-09-20'),
  },
  {
    id: 'usr_lettori_erranti',
    username: 'lettori.erranti',
    displayName: 'Associazione I Lettori Erranti',
    email: 'contatti@lettorierranti.it',
    accountType: 'organization',
    city: 'Napoli, Fuorigrotta',
    lat: 40.827,
    lng: 14.192,
    bio: 'Associazione culturale che promuove la lettura condivisa.',
    createdAt: new Date('2024-01-10'),
  },
  {
    id: 'usr_libreria_spacca',
    username: 'libreria.spaccanapoli',
    displayName: 'Libreria Indipendente Spaccanapoli',
    email: 'ciao@libreriaspaccanapoli.it',
    accountType: 'organization',
    city: 'Napoli, Spaccanapoli',
    lat: 40.8497,
    lng: 14.257,
    bio: 'Libreria indipendente del centro storico, specializzata in editoria meridionale.',
    createdAt: new Date('2023-06-14'),
  },
  {
    id: 'usr_centro_mezzo',
    username: 'centro.mezzogiorno',
    displayName: 'Centro Culturale Mezzogiorno',
    email: 'info@centromezzogiorno.it',
    accountType: 'organization',
    city: 'Napoli, Sanità',
    lat: 40.858,
    lng: 14.2535,
    bio: 'Centro culturale che cura un fondo bibliografico dedicato al Mezzogiorno italiano.',
    createdAt: new Date('2024-03-01'),
  },

  // Admin
  {
    id: 'usr_admin',
    username: 'admin',
    displayName: 'Amministratore Lookup',
    email: 'admin@lookup.local',
    accountType: 'person',
    city: 'Napoli',
    lat: 40.8358,
    lng: 14.2488,
    bio: 'Account amministrativo (seed).',
    role: 'admin',
    createdAt: new Date('2023-01-01'),
  },
];

// =============================================================================
// 2. CATEGORIE BISAC (essenziali)
// =============================================================================
// Subset rappresentativo: 4 macro-aree + alcune sotto-categorie.
// La gerarchia completa sarà popolata da uno script BISAC dedicato in 1b.2.
const CATEGORIES = [
  // Macro-aree (parent NULL)
  { id: 1, name: 'Narrativa', slug: 'narrativa', bisacCode: 'FIC000000', parentId: null },
  { id: 2, name: 'Saggistica', slug: 'saggistica', bisacCode: 'NON000000', parentId: null },
  { id: 3, name: 'Poesia', slug: 'poesia', bisacCode: 'POE000000', parentId: null },
  { id: 4, name: 'Ragazzi', slug: 'ragazzi', bisacCode: 'JUV000000', parentId: null },

  // Sotto-categorie di Narrativa
  { id: 5, name: 'Gialli e noir', slug: 'gialli-noir', bisacCode: 'FIC022000', parentId: 1 },
  { id: 6, name: 'Fantascienza', slug: 'fantascienza', bisacCode: 'FIC028000', parentId: 1 },
  {
    id: 7,
    name: 'Letteratura italiana',
    slug: 'letteratura-italiana',
    bisacCode: 'FIC019000',
    parentId: 1,
  },
  {
    id: 8,
    name: 'Letteratura straniera',
    slug: 'letteratura-straniera',
    bisacCode: 'FIC019100',
    parentId: 1,
  },
  { id: 9, name: 'Classici', slug: 'classici', bisacCode: 'FIC004000', parentId: 1 },

  // Sotto-categorie di Saggistica
  { id: 10, name: 'Storia', slug: 'storia', bisacCode: 'HIS000000', parentId: 2 },
  { id: 11, name: 'Filosofia', slug: 'filosofia', bisacCode: 'PHI000000', parentId: 2 },
  { id: 12, name: 'Storia locale', slug: 'storia-locale', bisacCode: 'HIS037000', parentId: 2 },
  {
    id: 13,
    name: 'Politica e società',
    slug: 'politica-societa',
    bisacCode: 'POL000000',
    parentId: 2,
  },

  // Sotto-categorie di Poesia
  { id: 14, name: 'Poesia italiana', slug: 'poesia-italiana', bisacCode: 'POE005000', parentId: 3 },
  {
    id: 15,
    name: 'Poesia straniera',
    slug: 'poesia-straniera',
    bisacCode: 'POE008000',
    parentId: 3,
  },
];

// =============================================================================
// 3. PROFILI ORGANIZZAZIONE (5)
// =============================================================================
const ORG_PROFILES = [
  {
    userId: 'usr_biblio_sanita',
    legalName: 'Biblioteca di Comunità Rione Sanità APS',
    orgCategory: 'biblioteca',
    contactPerson: 'Mariarosaria Carfora',
    publicEmail: 'info@bibliosanita.org',
    publicPhone: '081 1234567',
    publicAddress: 'Via Sanità 130, 80136 Napoli',
    openingHours: 'Lun–Ven 16:00–20:00 / Sab 10:00–13:00',
  },
  {
    userId: 'usr_lettori_erranti',
    legalName: 'Associazione I Lettori Erranti',
    orgCategory: 'associazione',
    contactPerson: 'Francesco Borrelli',
    publicEmail: 'contatti@lettorierranti.it',
    website: 'https://lettorierranti.it',
    publicAddress: 'Piazzale Tecchio 80, 80125 Napoli',
    openingHours: 'Mer–Ven 17:00–19:30',
  },
  {
    userId: 'usr_libreria_spacca',
    legalName: 'Libreria Spaccanapoli SAS',
    orgCategory: 'libreria_indipendente',
    contactPerson: 'Antonio Cammarano',
    publicEmail: 'ciao@libreriaspaccanapoli.it',
    website: 'https://libreriaspaccanapoli.it',
    publicAddress: 'Spaccanapoli 22, 80138 Napoli',
    openingHours: 'Mar–Sab 10:00–20:00 / Dom 11:00–14:00',
  },
  {
    userId: 'usr_centro_mezzo',
    legalName: 'Centro Culturale Mezzogiorno APS',
    orgCategory: 'centro_culturale',
    contactPerson: 'Elena Bruno',
    publicEmail: 'info@centromezzogiorno.it',
    publicAddress: 'Via dei Vergini 14, 80137 Napoli',
    openingHours: 'Lun–Ven 15:00–19:00',
  },
];

// =============================================================================
// 4. LIBRI (20 di esempio, subset di SAMPLE_BOOKS)
// =============================================================================
// Selezionati per coprire le macro-aree principali. Espansione in 1b.2.
const BOOKS = [
  // Narrativa italiana — Chiara Morandi (1)
  {
    id: 1,
    ownerId: 'usr_chiara',
    title: 'Il Gattopardo',
    author: 'Giuseppe Tomasi di Lampedusa',
    year: 1958,
    publisher: 'Feltrinelli',
    pages: 320,
    isbn: '9788807900037',
    description: "Romanzo storico ambientato in Sicilia durante l'Unità d'Italia.",
    categories: [9, 7],
    primaryCategoryId: 7,
    viewCount: 14,
    requestCount: 2,
  },
  {
    id: 2,
    ownerId: 'usr_chiara',
    title: 'La cognizione del dolore',
    author: 'Carlo Emilio Gadda',
    year: 1963,
    publisher: 'Einaudi',
    pages: 280,
    categories: [7],
    primaryCategoryId: 7,
    viewCount: 9,
  },
  {
    id: 3,
    ownerId: 'usr_chiara',
    title: 'Conversazione in Sicilia',
    author: 'Elio Vittorini',
    year: 1941,
    publisher: 'Bompiani',
    pages: 220,
    categories: [7],
    primaryCategoryId: 7,
    viewCount: 6,
  },

  // Gialli — Marco De Vito (2)
  {
    id: 4,
    ownerId: 'usr_marco',
    title: 'Uomini che odiano le donne',
    author: 'Stieg Larsson',
    year: 2005,
    publisher: 'Marsilio',
    pages: 680,
    language: 'Italiano (tradotto)',
    categories: [5, 8],
    primaryCategoryId: 5,
    viewCount: 28,
    requestCount: 4,
  },
  {
    id: 5,
    ownerId: 'usr_marco',
    title: 'Il commissario Montalbano',
    author: 'Andrea Camilleri',
    year: 1994,
    publisher: 'Sellerio',
    pages: 230,
    categories: [5, 7],
    primaryCategoryId: 5,
    viewCount: 22,
  },
  {
    id: 6,
    ownerId: 'usr_marco',
    title: 'La signora del lago',
    author: 'Andrea Camilleri',
    year: 2017,
    publisher: 'Sellerio',
    pages: 280,
    categories: [5, 7],
    primaryCategoryId: 5,
    viewCount: 11,
  },

  // Classici - Anna Russo (3)
  {
    id: 7,
    ownerId: 'usr_anna',
    title: 'I Promessi Sposi',
    author: 'Alessandro Manzoni',
    year: 1840,
    publisher: 'Einaudi',
    pages: 720,
    description: 'Edizione ottocentesca rilegata.',
    categories: [9, 7],
    primaryCategoryId: 9,
    viewCount: 17,
    requestCount: 1,
  },
  {
    id: 8,
    ownerId: 'usr_anna',
    title: 'Le Avventure di Pinocchio',
    author: 'Carlo Collodi',
    year: 1883,
    publisher: 'Treves',
    pages: 200,
    categories: [9, 4],
    primaryCategoryId: 9,
    viewCount: 12,
  },

  // Storia locale - Luca Esposito (4)
  {
    id: 9,
    ownerId: 'usr_luca',
    title: 'Storia di Napoli',
    author: 'Benedetto Croce',
    year: 1923,
    publisher: 'Laterza',
    pages: 540,
    categories: [10, 12],
    primaryCategoryId: 12,
    viewCount: 8,
  },
  {
    id: 10,
    ownerId: 'usr_luca',
    title: 'Il ventre di Napoli',
    author: 'Matilde Serao',
    year: 1884,
    publisher: 'Adelphi',
    pages: 160,
    categories: [10, 12, 7],
    primaryCategoryId: 12,
    viewCount: 14,
  },

  // Poesia - Giulia Ferrari (5)
  {
    id: 11,
    ownerId: 'usr_giulia',
    title: 'Ossi di seppia',
    author: 'Eugenio Montale',
    year: 1925,
    publisher: 'Mondadori',
    pages: 120,
    categories: [3, 14],
    primaryCategoryId: 14,
    viewCount: 19,
  },
  {
    id: 12,
    ownerId: 'usr_giulia',
    title: 'Le Duineser Elegien',
    author: 'Rainer Maria Rilke',
    year: 1923,
    publisher: 'Einaudi',
    pages: 180,
    language: 'Italiano (tradotto)',
    categories: [3, 15],
    primaryCategoryId: 15,
    viewCount: 7,
  },

  // Fantascienza - Roberto Mazzone (6)
  {
    id: 13,
    ownerId: 'usr_roberto',
    title: 'Fondazione',
    author: 'Isaac Asimov',
    year: 1951,
    publisher: 'Mondadori',
    pages: 270,
    language: 'Italiano (tradotto)',
    categories: [6, 8],
    primaryCategoryId: 6,
    viewCount: 25,
    requestCount: 3,
  },
  {
    id: 14,
    ownerId: 'usr_roberto',
    title: '1984',
    author: 'George Orwell',
    year: 1949,
    publisher: 'Mondadori',
    pages: 350,
    language: 'Italiano (tradotto)',
    categories: [6, 8, 9],
    primaryCategoryId: 6,
    viewCount: 31,
    requestCount: 2,
  },

  // Biblioteca Sanità (7) - storia locale, novecento
  {
    id: 15,
    ownerId: 'usr_biblio_sanita',
    title: 'Storia del Rione Sanità',
    author: 'AA.VV.',
    year: 2018,
    publisher: 'Marotta&Cafiero',
    pages: 240,
    categories: [10, 12],
    primaryCategoryId: 12,
    viewCount: 33,
    requestCount: 6,
  },
  {
    id: 16,
    ownerId: 'usr_biblio_sanita',
    title: "L'arte della gioia",
    author: 'Goliarda Sapienza',
    year: 1998,
    publisher: 'Einaudi',
    pages: 510,
    categories: [7],
    primaryCategoryId: 7,
    viewCount: 18,
  },

  // Lettori Erranti (8) - contemporanea
  {
    id: 17,
    ownerId: 'usr_lettori_erranti',
    title: 'Le otto montagne',
    author: 'Paolo Cognetti',
    year: 2016,
    publisher: 'Einaudi',
    pages: 200,
    categories: [7],
    primaryCategoryId: 7,
    viewCount: 24,
    requestCount: 4,
  },

  // Libreria Spaccanapoli (9) - editoria meridionale, poesia, piccoli editori
  {
    id: 18,
    ownerId: 'usr_libreria_spacca',
    title: 'Gomorra',
    author: 'Roberto Saviano',
    year: 2006,
    publisher: 'Mondadori',
    pages: 330,
    categories: [7, 13],
    primaryCategoryId: 7,
    viewCount: 42,
    requestCount: 7,
  },
  {
    id: 19,
    ownerId: 'usr_libreria_spacca',
    title: 'Le città invisibili',
    author: 'Italo Calvino',
    year: 1972,
    publisher: 'Einaudi',
    pages: 170,
    categories: [7, 9],
    primaryCategoryId: 7,
    viewCount: 38,
    requestCount: 5,
  },

  // Centro Mezzogiorno (10)
  {
    id: 20,
    ownerId: 'usr_centro_mezzo',
    title: 'I Viceré',
    author: 'Federico De Roberto',
    year: 1894,
    publisher: 'Garzanti',
    pages: 590,
    categories: [9, 7],
    primaryCategoryId: 7,
    viewCount: 11,
  },
];

// =============================================================================
// EXECUTION
// =============================================================================

async function main() {
  console.log('🌱 Seed Lookup — Fase 1b');
  console.log('═══════════════════════════════════════════════');

  // 1. Pulizia (in ordine inverso di FK)
  console.log('🗑  Pulizia tabelle...');
  // Fase 3.3: tabelle Better Auth (session/account/verification) prima delle
  // altre perche' hanno FK verso users.
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.bookCategory.deleteMany();
  await prisma.book.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.organizationProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  // 2. Reset sequences (per riavere ID che partono da 1)
  //    Fase 3.0: users NON ha piu' sequence (id String CUID).
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE books_id_seq RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE categories_id_seq RESTART WITH 1`);

  // 3. Categorie (prima, perché i libri le referenziano)
  console.log(`📚 Inserimento ${CATEGORIES.length} categorie BISAC...`);
  for (const c of CATEGORIES) {
    await prisma.category.create({ data: c });
  }

  // 4. Utenti
  console.log(`👤 Inserimento ${USERS.length} utenti...`);
  for (const u of USERS) {
    // Fase 3.3: setto emailVerified: true di default per i seed users
    // (in produzione arriva via link email dopo signup)
    await prisma.user.create({ data: { ...u, emailVerified: true } });
  }

  // 4b. Fase 3.3: Account credential per Better Auth (login vero possibile)
  // -----------------------------------------------------------------------
  // Per ogni seed user, creo un record Account con providerId='credential'
  // e password hash pre-computato. Cosi' 'usr_chiara', 'usr_marco', ecc.
  // possono fare login con la loro email + password `Lookup2026!`.
  //
  // Esempio login:
  //   POST /api/auth/sign-in/email
  //   { "email": "c.morandi@mail.it", "password": "Lookup2026!" }
  console.log(
    `🔐 Inserimento ${USERS.length} account credential (password: ${DEFAULT_SEED_PASSWORD})...`
  );
  const now = new Date();
  for (const u of USERS) {
    await prisma.account.create({
      data: {
        id: `acc_${u.id}`, // deterministic per seed
        userId: u.id,
        accountId: u.email, // Better Auth per 'credential' usa email
        providerId: 'credential',
        password: hashPasswordForBetterAuth(DEFAULT_SEED_PASSWORD),
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  // 5. Profili organizzazione
  console.log(`🏛️  Inserimento ${ORG_PROFILES.length} profili organizzazione...`);
  for (const o of ORG_PROFILES) {
    await prisma.organizationProfile.create({ data: o });
  }

  // 6. Preferenze utente (defaults per tutti, customizzazioni per alcuni)
  console.log(`⚙️  Inserimento preferenze utente...`);
  for (const u of USERS) {
    await prisma.userPreference.create({
      data: {
        userId: u.id,
        // Defaults; in 1b.2 leggeremo SAMPLE_PROFILE_PREFS per le customizzazioni
        theme: u.accountType === 'organization' ? 'bordeaux' : 'classic',
      },
    });
  }

  // 7. Libri
  console.log(`📖 Inserimento ${BOOKS.length} libri...`);
  for (const b of BOOKS) {
    const { categories, primaryCategoryId, ...bookData } = b;
    await prisma.book.create({
      data: {
        ...bookData,
        categories: {
          create: categories.map((catId) => ({
            categoryId: catId,
            isPrimary: catId === primaryCategoryId,
          })),
        },
      },
    });
  }

  // 8. CRITICO: avanza le sequences Postgres a max(id)
  // -----------------------------------------------------------------------
  // Gli INSERT sopra usano ID hardcoded (books/categories 1, 2, ...).
  // Postgres NON aggiorna automaticamente le sequences in questo caso.
  // setval() le allinea a MAX(id) così la prossima nextval() ritorna MAX+1.
  //
  // Fase 3.0: users NON ha piu' sequence (users.id e' String CUID ora),
  // quindi nessun setval necessario per quella tabella.
  console.log('🔢 Allineamento sequences Postgres a max(id)...');
  await prisma.$executeRawUnsafe(
    `SELECT setval('books_id_seq', (SELECT COALESCE(MAX(id), 1) FROM books))`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories))`
  );

  // 9. PostGIS: function + trigger + indice GIST + backfill (Fase 1f)
  // -----------------------------------------------------------------------
  // La colonna users.location e' di tipo geography(Point, 4326), aggiunta dallo
  // schema Prisma (Unsupported). Qui creiamo:
  //   - una funzione plpgsql che calcola location da lat/lng
  //   - un trigger BEFORE INSERT OR UPDATE che la chiama
  //   - un indice GIST per query ST_DWithin/ST_Distance veloci
  //   - un backfill per gli utenti gia' inseriti
  // Tutto idempotente: rieseguibile in sicurezza.
  console.log('🌍 Setup PostGIS (function + trigger + indice GIST + backfill)...');

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION sync_user_location_from_latlng()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
      ELSE
        NEW.location := NULL;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS sync_user_location_trigger ON users`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER sync_user_location_trigger
    BEFORE INSERT OR UPDATE OF lat, lng ON users
    FOR EACH ROW EXECUTE FUNCTION sync_user_location_from_latlng()
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS users_location_gist ON users USING GIST (location)
  `);

  // Backfill: il trigger non e' stato attivato per gli INSERT del seed
  // (quei record erano gia' presenti o sono stati inseriti prima della creazione
  // del trigger). Calcoliamo location direttamente per tutti gli utenti che
  // hanno lat/lng.
  const backfilled = await prisma.$executeRawUnsafe(`
    UPDATE users
    SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND (location IS NULL OR ST_X(location::geometry) <> lng OR ST_Y(location::geometry) <> lat)
  `);
  console.log(`  Backfill: ${backfilled} utenti aggiornati con location PostGIS.`);

  console.log('═══════════════════════════════════════════════');
  console.log('✅ Seed completato.');
  console.log('');
  console.log('Verifica:');
  console.log('  npm run db:shell    (da root)');
  console.log('  Poi nel prompt psql:');
  console.log('    \\dt                       lista tabelle');
  console.log('    SELECT COUNT(*) FROM users;       → 11');
  console.log('    SELECT COUNT(*) FROM books;       → 20');
  console.log('    SELECT COUNT(*) FROM categories;  → 15');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed fallito:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
