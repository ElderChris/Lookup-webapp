// =============================================================================
// tests/helpers.mjs
// =============================================================================
// Utility condivise dai test:
//   - buildTestApp(): istanzia l'app Fastify configurata, senza listen
//   - authHeaders(userId): cookie di sessione di un utente del seed
//   - createTestPrisma(): client Prisma standalone per setup dati in test
//   - resetDynamicTables(): wipe loans/reviews/posts/notifications/etc
//   - randomBookData(): factory per creare body POST /api/books
// =============================================================================

import { buildApp } from '../src/app.js';
import { createPrismaClient } from '../src/lib/prismaClient.js';
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
 * Header di un utente autenticato: fa un vero accesso con Better Auth e
 * ritorna `{ Cookie: 'better-auth.session_token=...' }`, da passare a
 * `app.inject({ headers })`.
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
  return createPrismaClient({ log: ['warn', 'error'] });
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

/**
 * Crea un prestito concluso (stato `returned`) fra due utenti: requisito
 * per poter scrivere una recensione. Ritorna l'id, da cancellare a fine test.
 */
export async function createReturnedLoan(prisma, { requesterId, lenderId, bookId }) {
  const now = new Date();
  const loan = await prisma.loanRequest.create({
    data: {
      bookId,
      requesterId,
      lenderId,
      status: 'returned',
      confirmedAt: now,
      borrowedAt: now,
      returningAt: now,
      returnedAt: now,
    },
  });
  return loan.id;
}

// IDs convenzionali dei dati seed: definiti in seedIds.mjs, riesportati qui
// per compatibilita' con gli import esistenti dei test.
export { SEED } from './seedIds.mjs';
