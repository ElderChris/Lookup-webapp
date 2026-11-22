// =============================================================================
// src/lib/authLinks.js — Link delle email di verifica e reset password
// =============================================================================
// Better Auth costruisce i link sull'indirizzo dell'API
// (BETTER_AUTH_URL/api/auth/verify-email?token=...&callbackURL=...).
// Noi mandiamo invece l'utente direttamente alla pagina del sito indicata
// come callbackURL, con il token in coda: e' la pagina a completare
// l'operazione con una chiamata all'API dalla stessa origine. Cosi' il link
// funziona anche aprendolo da un altro dispositivo e l'API non deve essere
// raggiungibile direttamente dal browser.
//
// La pagina di destinazione viene accettata solo se appartiene a un'origine
// fidata: altrimenti chiunque potrebbe far partire dalle nostre email link
// verso siti esterni.
// =============================================================================

import { config } from '../config.js';

/** Origini del sito web da cui accettiamo pagine di ritorno. */
export const TRUSTED_WEB_ORIGINS = [
  ...new Set([
    ...config.cors.origins,
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8765',
    'http://localhost:5500',
  ]),
];

/** Origine usata quando la pagina di ritorno manca o non e' valida. */
export const DEFAULT_WEB_ORIGIN = config.cors.origins[0] || 'http://localhost:8080';

/**
 * Restituisce l'URL se e' una pagina `pathname` su un'origine fidata,
 * altrimenti null.
 * @param {string | null | undefined} value
 * @param {string} pathname es. '/verify-email.html'
 */
export function trustedPageUrl(value, pathname) {
  if (!value) return null;
  let u;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (!TRUSTED_WEB_ORIGINS.includes(u.origin)) return null;
  if (u.pathname !== pathname) return null;
  u.hash = '';
  return u;
}

/** Parametro callbackURL dell'URL generato da Better Auth. */
function callbackOf(betterAuthUrl) {
  try {
    return new URL(betterAuthUrl).searchParams.get('callbackURL');
  } catch {
    return null;
  }
}

/**
 * Link dell'email di verifica: la pagina verify-email.html indicata come
 * callbackURL (con i suoi parametri, es. `next`) piu' il token.
 * @param {string} betterAuthUrl l'URL generato da Better Auth
 * @param {string} token
 */
export function verifyEmailLink(betterAuthUrl, token) {
  const callback = callbackOf(betterAuthUrl);
  const page =
    trustedPageUrl(callback, '/verify-email.html') ||
    new URL('/verify-email.html', DEFAULT_WEB_ORIGIN);
  page.searchParams.set('token', token);
  return page.toString();
}

/**
 * Link dell'email di reset: la pagina reset-password.html indicata dal
 * client come redirectTo piu' il token.
 * @param {string} betterAuthUrl l'URL generato da Better Auth
 * @param {string} token
 */
export function resetPasswordLink(betterAuthUrl, token) {
  const callback = callbackOf(betterAuthUrl);
  const page =
    trustedPageUrl(callback, '/reset-password.html') ||
    new URL('/reset-password.html', DEFAULT_WEB_ORIGIN);
  page.search = '';
  page.searchParams.set('token', token);
  return page.toString();
}
