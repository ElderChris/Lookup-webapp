// =============================================================================
// apps/web/js/api-bootstrap.js
// =============================================================================
// Script di bootstrap del layer API per il frontend. Va incluso PRIMA degli
// altri script che usano apiClient/books/loans/ecc. In ogni page HTML:
//
//   <script type="module" src="/js/api-bootstrap.js"></script>
//
// Cosa fa, in ordine:
//   1. Chiama /api/auth/get-session per capire chi e' l'utente loggato
//      (cookie httpOnly Better Auth) e lo espone in window.LB_AUTH_USER.
//      E' l'unica identita' valida: le pagine la leggono con
//      LB_UI.currentUser() / LB_UI.requireUser().
//   2. Segnala con l'evento `lb-auth-ready` che la sessione e' nota.
//   3. Avvia un healthcheck non-bloccante.
//   4. Espone window.LB_API, window.LB_UI e window.LB_AUTH_USER (utente
//      corrente dopo session lookup).
// =============================================================================

import * as api from './api/index.js';
import * as uiHelpers from './ui-helpers.js';
import { eventStream } from './eventStream.js';
import './pwa.js'; // registra service worker + install prompt manager

// Client delle API per gli script delle pagine
window.LB_API = api;

// Funzioni di supporto delle pagine (utente corrente, stato di accesso, ...)
window.LB_UI = uiHelpers;

// Utente della sessione (popolato dopo get-session)
window.LB_AUTH_USER = null; // null = anonimo o non ancora verificato
window.LB_AUTH_READY = false; // true dopo che get-session e' terminato

// Flag globale: false se il backend non risponde, true altrimenti.
window.LB_API_AVAILABLE = null;

// -----------------------------------------------------------------------------
// 1. Session lookup Better Auth
// -----------------------------------------------------------------------------

/**
 * Legge la sessione di Better Auth (cookie httpOnly): senza sessione
 * l'utente e' ospite. Popola window.LB_AUTH_USER se autenticato.
 */
async function initSession() {
  // Tenta /api/auth/get-session (cookie httpOnly Better Auth)
  let session = null;
  try {
    session = await api.authClient.getSession();
  } catch (err) {
    // Server non raggiungibile, errore o troppe richieste (429): non vuol
    // dire "non autenticato". Le pagine riservate mostrano un avviso invece
    // di mandare al login (vedi LB_UI.requireUser).
    console.debug(`[api-bootstrap] get-session non riuscita: ${err.code || err.message}`);
    window.LB_AUTH_ERROR = err;
  }

  if (session && session.user) {
    // Autenticato via cookie Better Auth
    const user = session.user;
    window.LB_AUTH_USER = user;
    // Le pagine leggono l'utente da window.LB_AUTH_USER (o da
    // window.LB_UI.currentUser())
    console.debug(
      `[api-bootstrap] auth via cookie: user=${user.id} (${user.username || user.email})`
    );

    // avvia connessione SSE per notifiche realtime
    eventStream.start();
    uiHelpers.setAuthState('user');
  } else if (!window.LB_AUTH_ERROR) {
    // Il server ha risposto: nessuna sessione → utente anonimo
    console.debug('[api-bootstrap] utente anonimo');
    uiHelpers.setAuthState('guest');
  }
  // Con errore (server giu', 429) resta lo stato indicato da auth-hint.js

  window.LB_AUTH_READY = true;
  // Emit evento per componenti reattivi che aspettano l'auth ready
  window.dispatchEvent(
    new CustomEvent('lb-auth-ready', {
      detail: { user: window.LB_AUTH_USER },
    })
  );
}

// -----------------------------------------------------------------------------
// 2. Banner di stato connessione backend
// -----------------------------------------------------------------------------

function injectBannerStyles() {
  if (document.getElementById('lb-api-banner-styles')) return;
  const style = document.createElement('style');
  style.id = 'lb-api-banner-styles';
  style.textContent = `
    #lb-api-banner {
      position: fixed; top: 0; left: 50%; transform: translateX(-50%);
      z-index: 10000;
      max-width: calc(100% - 24px);
      padding: 8px 16px;
      border-radius: 0 0 6px 6px;
      background: #7a1e2b; color: #fff;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      cursor: pointer;
      transition: transform 0.3s ease;
    }
    #lb-api-banner.lb-api-hidden { transform: translateX(-50%) translateY(-120%); }
  `;
  document.head.appendChild(style);
}

/** Avviso in cima alla pagina quando il server non risponde. */
function showServerUnavailable() {
  injectBannerStyles();
  let banner = document.getElementById('lb-api-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'lb-api-banner';
    banner.setAttribute('role', 'alert');
    banner.title = 'Clic per nascondere';
    banner.addEventListener('click', () => banner.classList.add('lb-api-hidden'));
    document.body.appendChild(banner);
  }
  banner.textContent =
    'Server non raggiungibile: alcune funzioni non sono disponibili. Riprova tra poco.';
}

/** Versione dell'applicazione (dal server, cioe' da package.json) nel pie' di pagina. */
function showAppVersion(version) {
  if (!version) return;
  window.LB_APP_VERSION = version;
  document.querySelectorAll('[data-app-version]').forEach((el) => {
    el.textContent = ` · v${version}`;
  });
}

// -----------------------------------------------------------------------------
// 3. Healthcheck non bloccante
// -----------------------------------------------------------------------------

async function pingBackend() {
  try {
    const res = await api.apiClient.get('/api/health');
    window.LB_API_AVAILABLE = res?.status === 'ok';
    showAppVersion(res?.version);
    // Risponde ma un servizio (database, Redis) non e' disponibile
    if (!window.LB_API_AVAILABLE) showServerUnavailable();
  } catch (err) {
    window.LB_API_AVAILABLE = false;
    showServerUnavailable();
    console.warn('[api-bootstrap] server non raggiungibile:', err?.code || err);
  }
}

// Lancia session lookup + ping backend appena il DOM e' pronto
async function bootstrap() {
  // 1. Session lookup (Better Auth cookie → LB_AUTH_USER)
  await initSession();
  // 2. Stato del server e versione
  await pingBackend();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
