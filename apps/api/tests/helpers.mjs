// =============================================================================
// tests/helpers.mjs
// =============================================================================
// Utility condivise dai test:
//   - buildTestApp(): istanzia l'app Fastify configurata, senza listen
//   - authHeaders(userId): header X-Lookup-User-Id per route auth-required
//   - createTestPrisma(): client Prisma standalone per setup dati in test
//   - resetDynamicTables(): wipe loans/reviews/posts/notifications/etc
//   - randomBookData(): factory per creare body POST /api/books
// =============================================================================

import { buildApp } from '../src/app.js';
import { PrismaClient } from '@prisma/client';
import { signInAsCached } from './authTestHelpers.mjs';

let _app = null;

/**
 * Restituisce un'istanza Fastify riusabile per i test (singleton).
 * NON la chiude tra un test e l'altro: app.close() solo in afterAll a
 * livello globale (vedi setup-globals).
 */
export async function buildTestApp() {
  if (_app) return _app;
  _app = await buildApp();
  // Aspetta che sia "ready" (registrazione plugin completata)
  await _app.ready();
  return _app;
}

/**
 * Chiude l'istanza globale dell'app (chiamare in afterAll del file root).
 */
export async function closeTestApp() {
  if (_app) {
    await _app.close();
    _app = null;
  }
}

/**
 * Headers per simulare autenticazione di un utente.
 *
 * Beta 6: cambiata implementazione. Prima ritornava
 * `{ 'X-Lookup-User-Id': userId }` (dev fallback). Ora fa vero login via
 * Better Auth e ritorna `{ Cookie: 'better-auth.session_token=...' }`.
 *
 * L'API pubblica resta la stessa: chiama `authHeaders(SEED.USER_MARCO)` in
 * un test e ottieni gli header pronti per `app.inject({headers})`. La
 * differenza: ora deve essere `await`.
 *
 * Nota: usa la variante cached (`signInAsCached`) per performance. Se un
 * test fa signOut esplicito, importa e usa `clearAuthCache` da authTestHelpers.
 *
 * @param {string} userId - SEED.USER_MARCO, SEED.USER_CHIARA, ecc.
 * @returns {Promise<{Cookie: string}>}
 */
export async function authHeaders(userId) {
  const app = await buildTestApp();
  return signInAsCached(app, userId);
}

/**
 * Client Prisma standalone per assertion/setup nei test.
 */
export function createTestPrisma() {
  return new PrismaClient({ log: ['warn', 'error'] });
}

/**
 * Truncate solo le tabelle "dinamiche" (loans, reviews, posts, ecc.).
 * NON tocca users, categories, books — sono dati base seed.
 *
 * Usare in beforeEach quando un file di test ha bisogno di stato pulito
 * tra un test e l'altro.
 */
export async function resetDynamicTables(prisma) {
  await prisma.notification.deleteMany();
  await prisma.postReport.deleteMany();
  await prisma.postReaction.deleteMany();
  await prisma.post.deleteMany();
  await prisma.like.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.review.deleteMany();
  await prisma.loanMessage.deleteMany();
  await prisma.loanRequest.deleteMany();
  // Non tocchiamo book_categories: sono parte del seed dei libri
}

// -----------------------------------------------------------------------------
// Factory: dati realistici per POST/PATCH bodies
// -----------------------------------------------------------------------------

let _counter = 0;
function nextSuffix() {
  _counter += 1;
  return `${Date.now().toString(36)}-${_counter}`;
}

export function randomBookData(overrides = {}) {
  const sfx = nextSuffix();
  return {
    title: `Test Book ${sfx}`,
    author: `Test Author`,
    year: 2024,
    publisher: 'Test Editore',
    pages: 200,
    description: 'Descrizione di test',
    categoryIds: [1], // Narrativa
    tags: ['test'],
    ...overrides,
  };
}

export function randomPostContent(overrides = {}) {
  return {
    content: `Post di test ${nextSuffix()}`,
    ...overrides,
  };
}

// IDs convenzionali dei dati seed (vedi prisma/seed.mjs)
// Fase 3.0: gli USER IDs sono stringhe (CUID-like) per compat Better Auth.
// Book/Category IDs restano Int (autoincrement).
export const SEED = {
  USER_CHIARA: 'usr_chiara', // owner di libri 1, 2, 3
  USER_MARCO: 'usr_marco', // owner di libri 4, 5, 6
  USER_ANNA: 'usr_anna', // owner di libri 7, 8
  USER_LUCA: 'usr_luca',
  USER_GIULIA: 'usr_giulia',
  USER_ROBERTO: 'usr_roberto',
  USER_BIBLIOTECA_SANITA: 'usr_biblio_sanita', // org
  USER_LETTORI_ERRANTI: 'usr_lettori_erranti', // org
  USER_LIBRERIA_SPACCANAPOLI: 'usr_libreria_spacca', // org
  USER_CENTRO_MEZZOGIORNO: 'usr_centro_mezzo', // org
  USER_ADMIN: 'usr_admin',

  BOOK_GATTOPARDO: 1,
  BOOK_GADDA: 2,
  BOOK_VITTORINI: 3,
  BOOK_LARSSON: 4, // gialli
  BOOK_PROMESSI_SPOSI: 7,
  BOOK_GOMORRA: 18,

  CAT_NARRATIVA: 1,
  CAT_SAGGISTICA: 2,
  CAT_GIALLI: 5,
};
