/* =============================================================================
 * apps/web/sw.js — Service Worker Lookup (Beta 9)
 * =============================================================================
 * Strategie di caching differenziate per tipo di risorsa:
 *
 *   1. PRECACHE (install): asset core statici — le HTML principali + CSS + JS
 *      chiave. Al primo caricamento vengono salvati in cache. Il costo
 *      iniziale e' ripagato dalle visite successive quasi istantanee.
 *
 *   2. CACHE-FIRST per asset statici (immagini, font, CSS, JS immutabili):
 *      cerca prima in cache; se assente, fetcha dalla rete e cacha.
 *      Ottimizzato per "asset che non cambiano mai" — se cambia, cambia il
 *      cache name (CACHE_VERSION) e si scarica di nuovo.
 *
 *   3. NETWORK-FIRST per API JSON e HTML dinamiche: prova la rete;
 *      se fallisce (offline), serve la versione cachata (se esiste).
 *      Preferisce dati freschi ma degrada gracefully offline.
 *
 *   4. STALE-WHILE-REVALIDATE per liste che possono essere leggermente stale
 *      (feed, categorie): serve subito la cache + fetcha rete in background
 *      per aggiornare la cache per la prossima volta.
 *
 *   5. BYPASS per SSE (/api/me/events) e auth (/api/auth/*): passano sempre
 *      alla rete senza toccare la cache. Streaming e cookie non si cacheranno mai.
 * =============================================================================
 */

const CACHE_VERSION = 'lookup-v2'; // v2: CSS del pulsante Registrati/Accedi
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Asset da precacheare al primo install. Include solo quello essenziale:
// la home + CSS core + JS bootstrap + manifest + icone.
// Il resto (altre HTML, API) sara' cachato on-demand alla prima visita.
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/library.html',
  '/profile-setup.html',
  '/login.html',
  '/register.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/ui.js',
  '/js/ui-helpers.js',
  '/js/api-bootstrap.js',
  '/js/eventStream.js',
  '/js/data.js',
  '/manifest.json',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/icon-180.png',
];

// -----------------------------------------------------------------------------
// INSTALL — precache degli asset core
// -----------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  console.log('[sw] install', CACHE_VERSION);
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        // addAll fallisce atomicamente se anche uno solo dei URL fallisce.
        // Usiamo add() singoli per resilience: se un asset e' rimosso o rinominato,
        // gli altri comunque si cachano.
        return Promise.all(
          PRECACHE_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[sw] precache failed: ${url}`, err.message);
            })
          )
        );
      })
      .then(() => {
        // Attivazione immediata: sostituisce il vecchio SW appena l'install e' completo,
        // senza aspettare la chiusura di tutte le tab (comportamento standard).
        // Utile in dev, in prod potresti volere skipWaiting condizionale.
        return self.skipWaiting();
      })
  );
});

// -----------------------------------------------------------------------------
// ACTIVATE — cleanup delle cache di versioni precedenti
// -----------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  console.log('[sw] activate', CACHE_VERSION);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => {
              console.log(`[sw] deleting old cache: ${key}`);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        // Prendi controllo di tutte le pagine aperte immediatamente,
        // senza aspettare che l'utente chiuda e riapra
        return self.clients.claim();
      })
  );
});

// -----------------------------------------------------------------------------
// FETCH — routing tra le strategie
// -----------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo same-origin (no CDN esterni)
  if (url.origin !== self.location.origin) return;
  // Solo GET (POST/PATCH/DELETE devono sempre andare in rete)
  if (request.method !== 'GET') return;

  // BYPASS per SSE stream — deve sempre stare in rete, mai cache
  if (url.pathname === '/api/me/events') return;

  // BYPASS per auth endpoints (cookie session, no cache mai)
  if (url.pathname.startsWith('/api/auth/')) return;

  // Route by resource type
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
  } else if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirstStrategy(request));
  } else {
    // Default: network-first
    event.respondWith(networkFirstStrategy(request));
  }
});

// -----------------------------------------------------------------------------
// STRATEGIE
// -----------------------------------------------------------------------------

/**
 * Cache-first: serve dalla cache; se assente, fetcha + cacha.
 * Ideale per asset immutabili che cambiano solo con un deploy.
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline + no cache → errore. Meglio che silent fail.
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

/**
 * Network-first: prova la rete; se fallisce, serve dalla cache.
 * Ideale per HTML e API che devono essere fresh ma degradare offline.
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(request.url.includes('/api/') ? API_CACHE : RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Rete giu' — fallback cache
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback finale: se stavamo navigando a una HTML, torna index.html
    // (utente vedra' l'app anche se la specifica pagina non era in cache)
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response(
      JSON.stringify({ error: { code: 'OFFLINE', message: 'Nessuna connessione' } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function isStaticAsset(pathname) {
  return /\.(css|js|mjs|png|jpg|jpeg|svg|webp|woff2?|ttf|otf|ico)$/.test(pathname);
}

// -----------------------------------------------------------------------------
// MESSAGE — comunicazione con la pagina (per skipWaiting on demand)
// -----------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
