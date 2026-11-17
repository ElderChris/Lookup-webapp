// =============================================================================
// apps/web/js/api/endpoints/auth.js
// =============================================================================
// Wrapper delle route Better Auth (/api/auth/*). Sostituisce parzialmente
// le API legacy (`API.createUser`, `API.authenticate`, ecc.) — le pagine
// auth ora chiamano queste funzioni per parlare direttamente col backend.
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
  const { method = 'POST', body } = opts;
  let response;
  try {
    response = await fetch(AUTH_BASE + path, {
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
 * Registra un nuovo utente con email/password. Setta cookie session
 * (`autoSignIn: true` in config Better Auth) e invia email verify a MailHog.
 *
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password - min 8 char
 * @param {string} params.name - display name (mapped to display_name)
 * @param {string} params.username - min 1 char, unique
 * @param {string} [params.bio]
 * @param {string} [params.city]
 * @param {number} [params.lat]
 * @param {number} [params.lng]
 * @param {'person'|'organization'} [params.accountType='person']
 * @returns {Promise<{ user: object, token: string }>}
 * @throws {AuthError} EMAIL_TAKEN, USERNAME_TAKEN, INVALID_PASSWORD, ...
 */
export function signUp(params) {
  return authFetch('/sign-up/email', { body: params });
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
export async function getSession() {
  try {
    const result = await authFetch('/get-session', { method: 'GET' });
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
  return authFetch('/forget-password', { body: params });
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
 * quando l'utente clicca il link nell'email.
 *
 * Nota: Better Auth di default espone questo endpoint come GET con
 * query param, ma il POST con body funziona uguale.
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
