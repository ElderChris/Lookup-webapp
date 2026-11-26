// =============================================================================
// src/lib/authHelpers.js
// =============================================================================
// Identita' dell'utente dalla sessione Better Auth (cookie httpOnly). I test
// fanno un vero accesso e riusano il cookie (tests/authTestHelpers.mjs),
// quindi provano lo stesso percorso della produzione.
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
    // Senza la copia della sessione nel cookie: una sessione chiusa (uscita,
    // account sospeso o eliminato) smette di valere subito
    const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
    if (session?.user?.id && session.user.status === 'active') return session.user.id;
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
