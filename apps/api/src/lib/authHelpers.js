// =============================================================================
// src/lib/authHelpers.js
// =============================================================================
// Beta 6: SOLO cookie session Better Auth. Rimosso il fallback dev header
// X-Lookup-User-Id (attivo solo in NODE_ENV=test) — i test ora fanno vero
// login via signInAs() e riusano il cookie. Vedi tests/authTestHelpers.mjs.
//
// Il vantaggio: nessuna divergenza test/prod possibile per costruzione.
// Se auth.api.getSession() smette di funzionare, i test se ne accorgono.
//
// getCurrentUserId: ritorna string (CUID) | null (utente anonimo)
// =============================================================================

import { auth } from './auth.js';

/**
 * Estrae l'user id dalla sessione Better Auth (via cookie httpOnly firmato).
 *
 * @param {import('fastify').FastifyRequest} request
 * @returns {Promise<string | null>}
 */
export async function getCurrentUserId(request) {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') headers.set(key, value);
    }
    const session = await auth.api.getSession({ headers });
    if (session?.user?.id) return session.user.id;
  } catch (err) {
    request.log?.debug({ err: err.message }, '[auth] session lookup failed');
  }
  return null;
}

/**
 * Richiede che l'utente sia autenticato. Lancia 401 altrimenti.
 * @param {import('fastify').FastifyRequest} request
 * @returns {Promise<string>}
 */
export async function requireUserId(request) {
  const id = await getCurrentUserId(request);
  if (!id) {
    const err = new Error('Autenticazione richiesta');
    err.statusCode = 401;
    err.code = 'UNAUTHENTICATED';
    throw err;
  }
  return id;
}

/**
 * Verifica che l'utente corrente sia il proprietario della risorsa.
 * @param {import('fastify').FastifyRequest} request
 * @param {string} ownerId
 * @returns {Promise<string>}
 */
export async function requireOwner(request, ownerId) {
  const userId = await requireUserId(request);
  if (userId !== ownerId) {
    const err = new Error('Permesso negato (non sei il proprietario)');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  return userId;
}
