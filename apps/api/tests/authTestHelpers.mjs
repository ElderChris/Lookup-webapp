// =============================================================================
// apps/api/tests/authTestHelpers.mjs
// =============================================================================
// Accesso vero con Better Auth per i test Vitest (utenti del seed, gia'
// con email confermata).
//
// Uso tipico:
//   import { signInAs } from './authTestHelpers.mjs';
//
//   test('crea libro con vero login', async () => {
//     const authHeaders = await signInAs(app, 'USER_MARCO');
//     const res = await app.inject({
//       method: 'POST',
//       url: '/api/books',
//       headers: authHeaders,
//       payload: { title: 'Test', author: 'Test', category: 'FIC000000' },
//     });
//     expect(res.statusCode).toBe(201);
//   });
// =============================================================================

import { SEED } from './seedIds.mjs';

/** Password comune per tutti i seed users (vedi seed.mjs). */
const DEFAULT_SEED_PASSWORD = 'Lookup2026!';

/** Mapping id → email (per lookup rapido). Deve rimanere sincronizzato col seed. */
const SEED_EMAILS = {
  [SEED.USER_CHIARA]: 'c.morandi@mail.it',
  [SEED.USER_MARCO]: 'm.devito@mail.it',
  [SEED.USER_ANNA]: 'a.russo@mail.it',
  [SEED.USER_LUCA]: 'l.esposito@mail.it',
  [SEED.USER_GIULIA]: 'g.ferrari@mail.it',
  [SEED.USER_ROBERTO]: 'r.mazzone@mail.it',
  [SEED.USER_BIBLIOTECA_SANITA]: 'info@bibliosanita.org',
  [SEED.USER_LETTORI_ERRANTI]: 'contatti@lettorierranti.it',
  [SEED.USER_LIBRERIA_SPACCANAPOLI]: 'ciao@libreriaspaccanapoli.it',
  [SEED.USER_CENTRO_MEZZOGIORNO]: 'info@centromezzogiorno.it',
  [SEED.USER_ADMIN]: 'admin@lookup.local',
};

/**
 * Fa vero login via Better Auth e ritorna gli headers da usare in fetch
 * successivi (contengono il cookie session firmato).
 *
 * @param {import('fastify').FastifyInstance} app - Fastify app under test
 * @param {string} userIdOrKey - SEED.USER_MARCO (id) o 'USER_MARCO' (key)
 * @param {string} [password=DEFAULT_SEED_PASSWORD]
 * @returns {Promise<{Cookie: string}>}
 * @throws se il login fallisce
 */
export async function signInAs(app, userIdOrKey, password = DEFAULT_SEED_PASSWORD) {
  // Accetta sia l'id (`usr_marco`) che la key (`USER_MARCO`)
  const userId = userIdOrKey.startsWith('usr_') ? userIdOrKey : SEED[userIdOrKey];
  if (!userId) {
    throw new Error(`signInAs: unknown user "${userIdOrKey}"`);
  }
  const email = SEED_EMAILS[userId];
  if (!email) {
    throw new Error(`signInAs: no email registered for "${userId}"`);
  }

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email, password },
  });

  if (res.statusCode !== 200) {
    throw new Error(`signInAs("${userId}") failed: ${res.statusCode} — ${res.body || '(no body)'}`);
  }

  // Estrae il cookie session dalla response
  const setCookie = res.headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie)
    ? setCookie.map((c) => c.split(';')[0]).join('; ')
    : (setCookie || '').split(';')[0];

  if (!cookieHeader) {
    throw new Error(`signInAs("${userId}") — no session cookie in response`);
  }

  return { Cookie: cookieHeader };
}

// -----------------------------------------------------------------------------
// Cache dei cookie session per file di test
// -----------------------------------------------------------------------------
// Ogni chiamata a signInAs() esegue scrypt hash verify (~100-200ms). Con 89
// test moltiplicato per gli 11 seed users, la suite prende 10-15 secondi
// extra. Cachando i cookie a livello di file test, facciamo login una volta
// per user per file → performance drasticamente migliori.
//
// La cache e' un WeakMap<FastifyInstance, Map<userId, headers>>: si resetta
// automaticamente se cambia l'app (buildTestApp() ritorna la stessa
// istanza in tutti i file grazie al singleton in helpers.mjs, quindi la
// cache e' shared cross-file).
//
// IMPORTANTE: se un test chiama esplicitamente signOut() o modifica il ruolo
// dell'utente durante la sua esecuzione, il cookie cache diventa stale.
// Usa clearAuthCache(app) per invalidarla in quei casi.

const _authCache = new WeakMap(); // app → Map<userIdKey, headers>

/**
 * Come signInAs, ma cacha il cookie per user per app.
 * Da preferire nei test che NON fanno signOut.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {string} userIdOrKey
 * @returns {Promise<{Cookie: string}>}
 */
export async function signInAsCached(app, userIdOrKey) {
  let appCache = _authCache.get(app);
  if (!appCache) {
    appCache = new Map();
    _authCache.set(app, appCache);
  }
  const cacheKey = userIdOrKey;
  const cached = appCache.get(cacheKey);
  if (cached) return cached;
  const headers = await signInAs(app, userIdOrKey);
  appCache.set(cacheKey, headers);
  return headers;
}

/**
 * Invalida la cache per una app (o per un utente specifico se passato).
 * Da usare in test che fanno signOut esplicito, o beforeEach se serve
 * ripartire da zero per isolamento.
 */
export function clearAuthCache(app, userIdOrKey = null) {
  const appCache = _authCache.get(app);
  if (!appCache) return;
  if (userIdOrKey) {
    appCache.delete(userIdOrKey);
  } else {
    appCache.clear();
  }
}

/**
 * Fa logout invalidando il cookie session.
 * Da usare in `afterEach` se si vuole assicurare cleanup tra test.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {{Cookie: string}} authHeaders - da signInAs
 */
export async function signOut(app, authHeaders) {
  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-out',
    headers: authHeaders,
    payload: {},
  });
}
