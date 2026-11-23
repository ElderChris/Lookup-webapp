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
//   4. Espone window.LB_API + window.LB_QUERY + window.LB_AUTH_USER (utente
//      corrente dopo session lookup).
// =============================================================================

import * as api from './api/index.js';
import * as uiHelpers from './ui-helpers.js';
import { eventStream } from './eventStream.js';
import './pwa.js'; // Beta 9: registra service worker + install prompt manager

// Espone window.LB_API per pagine che usano script inline (legacy)
window.LB_API = api;

// Fase 2c.5: espone anche il queryClient globale
window.LB_QUERY = api.queryClient;

// Beta 3: espone UX helpers puri estratti dal legacy
window.LB_UI = uiHelpers;

// Fase 3.2: espone user session (populato dopo get-session)
window.LB_AUTH_USER = null; // null = anonimo o non ancora verificato
window.LB_AUTH_READY = false; // true dopo che get-session e' terminato

// Flag globale: false se il backend non risponde, true altrimenti.
window.LB_API_AVAILABLE = null;

// -----------------------------------------------------------------------------
// 1. Session lookup Better Auth (Fase 3.2)
// -----------------------------------------------------------------------------

/**
 * Bootstrap sessione. Provo prima Better Auth (cookie).
 * Beta 2: rimosso fallback legacy storage. Se il cookie manca l'utente e' guest.
 * Popola window.LB_AUTH_USER se autenticato, configura apiClient.
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

    // Beta 8: avvia connessione SSE per notifiche realtime
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
      padding: 6px 14px;
      border-radius: 0 0 6px 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      cursor: pointer;
      opacity: 0.95;
      transition: opacity 0.2s ease, transform 0.3s ease;
      user-select: none;
    }
    #lb-api-banner:hover { opacity: 1; }
    #lb-api-banner.lb-api-ok      { background: #2d6a4f; color: #fff; }
    #lb-api-banner.lb-api-offline { background: #ad7c1c; color: #fff; }
    #lb-api-banner.lb-api-hidden  { transform: translateX(-50%) translateY(-120%); }
    #lb-api-banner small { opacity: 0.85; margin-left: 6px; font-weight: 400; }
  `;
  document.head.appendChild(style);
}

function showBanner(kind, text, sub) {
  injectBannerStyles();
  let banner = document.getElementById('lb-api-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'lb-api-banner';
    banner.title = 'Clic per nascondere';
    banner.addEventListener('click', () => banner.classList.add('lb-api-hidden'));
    document.body.appendChild(banner);
  }
  banner.className = `lb-api-${kind}`;
  banner.innerHTML = `${text}${sub ? ` <small>${sub}</small>` : ''}`;

  // Auto-nascondi dopo 4 sec se OK (l'utente non ha bisogno di vederlo a lungo)
  if (kind === 'ok') {
    setTimeout(() => banner.classList.add('lb-api-hidden'), 4000);
  }
}

// -----------------------------------------------------------------------------
// Fase 2c.2: Badge "Live" persistente per pagine migrate
// -----------------------------------------------------------------------------
// Diverso dal banner (temporaneo, alto centrato): il badge Live e' un piccolo
// indicatore FISSO in basso a destra che segnala "questa pagina sta leggendo
// dal backend, non dal localStorage". Utile per debugging + per comunicare
// all'utente informato che i dati sono live.
//
// Uso dalle pagine (dopo il primo fetch OK dal backend):
//   window.LB_markLive('book-detail', 'GET /api/books/1 cached 30s');

function injectLiveBadgeStyles() {
  if (document.getElementById('lb-live-badge-styles')) return;
  const style = document.createElement('style');
  style.id = 'lb-live-badge-styles';
  style.textContent = `
    #lb-live-badge {
      position: fixed; bottom: 12px; right: 12px;
      z-index: 9998;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(45, 106, 79, 0.12);
      border: 1px solid rgba(45, 106, 79, 0.4);
      color: #2d6a4f;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      cursor: help;
      opacity: 0.7;
      transition: opacity 0.2s ease;
      user-select: none;
    }
    #lb-live-badge:hover { opacity: 1; }
    #lb-live-badge::before { content: '● '; }
  `;
  document.head.appendChild(style);
}

window.LB_markLive = function markLive(pageName, details) {
  injectLiveBadgeStyles();
  let badge = document.getElementById('lb-live-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'lb-live-badge';
    document.body.appendChild(badge);
  }
  badge.textContent = `LIVE ${pageName}`;
  badge.title = details || `${pageName} legge dati dal backend`;
};

// -----------------------------------------------------------------------------
// 3. Healthcheck non bloccante
// -----------------------------------------------------------------------------

async function pingBackend() {
  try {
    const t0 = performance.now();
    const res = await api.apiClient.get('/api/health');
    const dt = Math.round(performance.now() - t0);
    window.LB_API_AVAILABLE = res?.status === 'ok';
    if (window.LB_API_AVAILABLE) {
      showBanner('ok', '🟢 Backend connesso', `v${res.version || '?'} • ${dt}ms`);
      // Fase 2c.1: preload categorie in cache (TTL 1h).
      // Le pagine che creano/editano libri possono leggerle subito da
      // cache senza un ulteriore roundtrip.
      preloadCategories();
    } else {
      // Risponde ma status != ok (db giu', redis giu', ecc.)
      showBanner('offline', '🟡 Backend degraded', JSON.stringify(res));
    }
  } catch (err) {
    window.LB_API_AVAILABLE = false;
    const code = err?.code || 'UNKNOWN';
    showBanner('offline', '🟡 Demo offline', `(${code}) le pagine useranno dati locali`);
    console.warn('[api-bootstrap] backend non raggiungibile:', err);
  }
}

// -----------------------------------------------------------------------------
// 4. Preload categorie (Fase 2c.1)
// -----------------------------------------------------------------------------

async function preloadCategories() {
  try {
    const res = await api.categories.list();
    // Salva la lista risolta in cache con TTL 1h. Le pagine la leggeranno
    // poi via api.cache.get('categories:list').
    api.cache.set('categories:list', res.data, api.CACHE_TTL.CATEGORIES);
    console.debug(`[api-bootstrap] categorie preload OK (${res.data.length} categorie)`);
  } catch (err) {
    // Non bloccante: se fallisce, le pagine useranno hard-coded default.
    console.debug(`[api-bootstrap] preload categorie skip: ${err.code || err.message}`);
  }
}

// Lancia session lookup + ping backend appena il DOM e' pronto
async function bootstrap() {
  // 1. Session lookup (Better Auth cookie → LB_AUTH_USER)
  await initSession();
  // 2. Ping backend + preload categorie
  await pingBackend();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
