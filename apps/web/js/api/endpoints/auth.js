// =============================================================================
// apps/web/js/api/endpoints/auth.js
// =============================================================================
// Wrapper delle route Better Auth (/api/auth/*) e dell'iscrizione
// (/api/register): accesso, uscita, sessione, conferma email, password.
//
// Tutte le funzioni usano `credentials: 'include'` per inviare/ricevere
// il cookie httpOnly `better-auth.session_token` firmato dal backend.
//
// Design:
// - Non passa per apiClient.js perche' Better Auth ha shape response custom
//   (non il nostro { data, pagination }) e endpoint /api/auth/* con schemi
//   propri. Le fetch sono dirette per semplicita'.
// - Errori normalizzati come `AuthError` con .code, .message, .status
//   per uniformita' col resto del layer API frontend.
// =============================================================================

const AUTH_BASE = '/api/auth';

/** Errore normalizzato per operazioni auth */
export class AuthError extends Error {
  constructor(code, message, status = 400, cause) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

/**
 * Fetch wrapper con credentials + body JSON + parsing error uniforme.
 * @param {string} path
 * @param {{ method?: string, body?: object }} [opts]
 * @returns {Promise<any>}
 */
async function authFetch(path, opts = {}) {
  const { method = 'POST', body, base = AUTH_BASE } = opts;
  let response;
  try {
    response = await fetch(base + path, {
      method,
      credentials: 'include', // cookie httpOnly firmato
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Network error o CORS blocked
    throw new AuthError(
      'NETWORK_ERROR',
      'Impossibile contattare il server. Riprova tra poco.',
      0,
      err
    );
  }

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_) {
    payload = { message: text };
  }

  if (!response.ok) {
    // Better Auth ritorna { message, code? } o simili
    const code =
      payload?.code ||
      payload?.error?.code ||
      (response.status === 429 ? 'RATE_LIMITED' : `HTTP_${response.status}`);
    const message =
      payload?.message || payload?.error?.message || 'Errore auth (status ' + response.status + ')';
    throw new AuthError(code, message, response.status);
  }
  return payload;
}

// -----------------------------------------------------------------------------
// Registrazione
// -----------------------------------------------------------------------------

/**
 * Iscrizione in un'unica richiesta: account, profilo, preferenze, dati
 * dell'ente e primi volumi. Non apre una sessione: si entra aprendo il
 * link di conferma inviato per email (anche da un altro dispositivo).
 * Con un'email gia' registrata la risposta e' la stessa.
 *
 * @param {object} body vedi POST /api/register nella documentazione API
 * @returns {Promise<{ status: 'verification_sent', email: string }>}
 * @throws {AuthError} USERNAME_TAKEN, VALIDATION_ERROR, INVALID_CATEGORY, RATE_LIMITED, ...
 */
export function register(body) {
  return authFetch('/register', { body, base: '/api' });
}

/**
 * Indica se un nome utente e' libero.
 * @param {string} username
 * @returns {Promise<{ username: string, valid: boolean, available: boolean }>}
 */
export function checkUsername(username) {
  const q = new URLSearchParams({ username });
  return authFetch('/users/check-username?' + q.toString(), { method: 'GET', base: '/api' });
}

/**
 * Cancella definitivamente il proprio account e i dati collegati.
 * Poi va chiamato signOut() per togliere i cookie di sessione.
 * @param {{ password: string }} params
 * @throws {AuthError} INVALID_PASSWORD, UNAUTHENTICATED, RATE_LIMITED
 */
export function deleteAccount(params) {
  return authFetch('/users/me', { method: 'DELETE', body: params, base: '/api' });
}

/**
 * Pagina di conferma dell'email su questo sito; `next` e' la pagina in cui
 * proseguire dopo la conferma (percorso relativo, es. '/profile.html').
 * @param {string} [next]
 */
export function verifyPageUrl(next) {
  const u = new URL('/verify-email.html', location.origin);
  if (next) u.searchParams.set('next', next);
  return u.toString();
}

/**
 * Invia di nuovo l'email di conferma.
 * @param {{ email: string, callbackURL?: string }} params
 * @returns {Promise<{ status: boolean }>}
 */
export function sendVerificationEmail(params) {
  return authFetch('/send-verification-email', { body: params });
}

// -----------------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------------

/**
 * Login con email + password. Setta cookie session (7 giorni, sliding window).
 *
 * @param {{ email: string, password: string, rememberMe?: boolean }} params
 * @returns {Promise<{ user: object, token: string }>}
 * @throws {AuthError} INVALID_CREDENTIALS, USER_NOT_FOUND, RATE_LIMITED, ...
 */
export function signIn(params) {
  return authFetch('/sign-in/email', { body: params });
}

// -----------------------------------------------------------------------------
// Logout
// -----------------------------------------------------------------------------

/**
 * Distrugge la sessione corrente (server-side + cookie).
 * @returns {Promise<{ success: boolean }>}
 */
export function signOut() {
  return authFetch('/sign-out', { body: {} });
}

// -----------------------------------------------------------------------------
// Session lookup
// -----------------------------------------------------------------------------

/**
 * Ritorna la sessione corrente (o null se anonimo).
 * Usato all'avvio di ogni pagina per capire chi e' l'utente.
 *
 * @returns {Promise<{ user: object, session: object } | null>}
 */
export async function getSession({ fresh = false } = {}) {
  try {
    // fresh: salta la cache della sessione nel cookie (5 minuti), per
    // leggere subito un profilo appena modificato (nome, foto, ruolo)
    const path = fresh ? '/get-session?disableCookieCache=true' : '/get-session';
    const result = await authFetch(path, { method: 'GET' });
    // Better Auth ritorna null (o {}) per utente anonimo
    if (!result || !result.user) return null;
    return result;
  } catch (err) {
    if (err.status === 401 || err.status === 403) return null;
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Reset password
// -----------------------------------------------------------------------------

/**
 * Invia email con link/token per il reset. L'utente cliccera' il link
 * e verra' portato a reset-password.html?token=... per il completamento.
 *
 * @param {{ email: string, redirectTo?: string }} params
 * @returns {Promise<{ status: boolean }>}
 */
export function forgetPassword(params) {
  return authFetch('/request-password-reset', { body: params }); // Better Auth >= 1.4
}

/**
 * Consuma il token di reset + setta nuova password.
 *
 * @param {{ token: string, newPassword: string }} params
 * @returns {Promise<{ status: boolean }>}
 * @throws {AuthError} INVALID_TOKEN, EXPIRED_TOKEN, INVALID_PASSWORD
 */
export function resetPassword(params) {
  return authFetch('/reset-password', { body: params });
}

// -----------------------------------------------------------------------------
// Verify email
// -----------------------------------------------------------------------------

/**
 * Consuma il token di verifica email. Chiamato da verify-email.html
 * quando l'utente apre il link dell'email: conferma l'indirizzo, attiva
 * l'account e apre la sessione.
 *
 * @param {{ token: string }} params
 * @returns {Promise<{ status: boolean, user?: object }>}
 */
export function verifyEmail(params) {
  const q = new URLSearchParams({ token: params.token });
  return authFetch('/verify-email?' + q.toString(), { method: 'GET' });
}

// -----------------------------------------------------------------------------
// Change password (utente gia' loggato)
// -----------------------------------------------------------------------------

/**
 * Cambia password (richiede sessione attiva).
 * @param {{ currentPassword: string, newPassword: string, revokeOtherSessions?: boolean }} params
 * @returns {Promise<any>}
 */
export function changePassword(params) {
  return authFetch('/change-password', { body: params });
}

// -----------------------------------------------------------------------------
// Session management
// -----------------------------------------------------------------------------

/** Lista sessioni attive dell'utente corrente (per settings > sicurezza) */
export function listSessions() {
  return authFetch('/list-sessions', { method: 'GET' });
}

/** Revoca UNA sessione specifica */
export function revokeSession(params) {
  return authFetch('/revoke-session', { body: params });
}

/** Revoca TUTTE le sessioni dell'utente (logout global) */
export function revokeSessions() {
  return authFetch('/revoke-sessions', { body: {} });
}
