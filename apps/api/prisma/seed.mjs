// =============================================================================
// apps/api/prisma/seed.mjs
// =============================================================================
// Esegue: npm run db:seed (da apps/api/) oppure cd apps/api && npx prisma db seed
//
// Popola il database con dati di prova derivati da quelli del prototipo
// (archive/prototipo/js/data.js):
//   - 11 utenti (6 persone + 5 organizzazioni/librerie)
//   - Tassonomia BISAC completa (prisma/taxonomy.mjs, 81 generi)
//   - 20 libri di esempio (subset di SAMPLE_BOOKS)
//   - Preferenze utente (UserPreference) per chi le ha settate
//   - Profili organizzazione (OrganizationProfile) per i 5 enti
//
// Idempotenza: lo script usa upsert dove possibile, e disconnette pulito alla fine.
// =============================================================================

import { CATEGORIES } from './taxonomy.mjs';
import { createPrismaClient } from '../src/lib/prismaClient.js';
import { hashPassword } from 'better-auth/crypto';

const prisma = createPrismaClient();

// =============================================================================
// FASE 3.3: password comune per tutti i seed users
// =============================================================================
// Tutti gli utenti seed hanno la stessa password: `Lookup2026!`. Questo
// permette di fare login vero via Better Auth durante lo sviluppo e i test
// end-to-end (curl, browser reali).
//
// L'hash della password e' calcolato con la funzione di Better Auth stessa
// (`hashPassword` da 'better-auth/crypto'), cosi' resta compatibile con la
// versione installata. La versione precedente reimplementava scrypt con i
// parametri di default di Node (r=8), diversi da quelli di Better Auth
// (r=16): gli hash non venivano mai verificati.
//
// Il record Account creato ha:
//   providerId = 'credential'  (il provider email/password di Better Auth)
//   accountId  = id dell'utente (Better Auth >= 1.7 lo richiede: cerca
//                l'account credential con accountId === user.id)
//   password   = hash calcolato da Better Auth
//
// In produzione: OGNI utente ha la sua password + emailVerified via link email.
// =============================================================================

const DEFAULT_SEED_PASSWORD = 'Lookup2026!';

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
// 2. CATEGORIE BISAC: tassonomia completa in prisma/taxonomy.mjs
// =============================================================================

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
  console.log('🌱 Seed Lookup');
  console.log('═══════════════════════════════════════════════');

  // 1. Pulizia (in ordine inverso di FK)
  console.log('🗑  Pulizia tabelle...');
  // tabelle Better Auth (session/account/verification) prima delle
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
  //    users NON ha piu' sequence (id String CUID).
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
    // setto emailVerified: true di default per i seed users
    // (in produzione arriva via link email dopo signup)
    await prisma.user.create({ data: { ...u, emailVerified: true } });
  }

  // 4b. Account credential per Better Auth (accesso con password)
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
        accountId: u.id, // Better Auth: per 'credential' accountId === user.id
        providerId: 'credential',
        password: await hashPassword(DEFAULT_SEED_PASSWORD),
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
  // users NON ha piu' sequence (users.id e' String CUID ora),
  // quindi nessun setval necessario per quella tabella.
  console.log('🔢 Allineamento sequences Postgres a max(id)...');
  await prisma.$executeRawUnsafe(
    `SELECT setval('books_id_seq', (SELECT COALESCE(MAX(id), 1) FROM books))`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories))`
  );

  // 9. PostGIS: backfill di users.location
  // -----------------------------------------------------------------------
  // Funzione, trigger e indice GIST sono nella migrazione
  // 20261120090000_postgis_users_location (fino al 20 nov 2026 li creava
  // questo seed, quindi un database con le sole migrazioni ne era privo).
  // Il trigger calcola location a ogni INSERT, ma il backfill resta come
  // garanzia: e' idempotente e non costa nulla.
  console.log('🌍 PostGIS: backfill location utenti...');

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
  console.log('    SELECT COUNT(*) FROM categories;  → 81');
  console.log('');
}

// Await di primo livello: chi importa il modulo (setup dei test Vitest)
// riprende solo a seed concluso. Senza, i test partivano a seed in corso e
// trovavano il database parzialmente popolato.
try {
  await main();
} catch (e) {
  console.error('❌ Seed fallito:', e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
