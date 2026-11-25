// =============================================================================
// apps/web/js/ui-helpers.js — Funzioni di supporto delle pagine
// =============================================================================
// Utente corrente e stato di accesso, accesso alle pagine riservate,
// messaggi di benvenuto, copertine delle librerie, etichette delle categorie
// degli enti, punto di riferimento per le distanze. Interpretano per
// l'interfaccia i dati che arrivano dal server.
//
// USO nelle pagine:
//   import { getWelcomeMessage, libraryCoverData } from './js/ui-helpers.js';
// oppure via window.LB_UI (esposto dal bootstrap):
//   window.LB_UI.getWelcomeMessage(user);
// =============================================================================

// -----------------------------------------------------------------------------
// Welcome message rotation
// -----------------------------------------------------------------------------

/** Messaggi di benvenuto, neutri rispetto al genere (niente
    "Bentornato/Bentornata"); rotazione basata su user.welcomeIndex. */
// Disegni delle copertine (con le funzioni render) e le loro chiavi: un'unica
// fonte, usata anche dal selettore delle impostazioni
import { LIBRARY_COVER_DESIGN_MAP } from './coverDesigns.js';

export const WELCOME_MESSAGES = [
  'Ciao {name}, buona lettura.',
  'Eccoti, {name}.',
  'Rieccoti nella tua libreria, {name}.',
  'È bello rivederti, {name}.',
  'Si riapre il libro, {name}.',
  'Pronti a scoprire qualcosa, {name}?',
  'Avanti tutta, {name}.',
  'La pagina ti aspettava, {name}.',
  'Un nuovo capitolo ti attende, {name}.',
  'Quale libro ti chiamerà oggi, {name}?',
  'I tuoi libri ti hanno cercato, {name}.',
  "Tra gli scaffali c'è movimento, {name}.",
  'Lookup ti dà il benvenuto, {name}.',
  'Si torna a sfogliare, {name}.',
  'Buon ritorno fra le pagine, {name}.',
  'Quante storie da scoprire oggi, {name}.',
  'La tua biblioteca ti riaccoglie, {name}.',
];

/**
 * Restituisce il messaggio di benvenuto rotante per l'utente corrente.
 * Se user manca ritorna stringa vuota.
 */
export function getWelcomeMessage(user) {
  if (!user) return '';
  const first = (user.displayName || user.username || '').split(' ')[0];
  const idx = (user.welcomeIndex || 0) % WELCOME_MESSAGES.length;
  return WELCOME_MESSAGES[idx].replace('{name}', first);
}

// -----------------------------------------------------------------------------
// Library cover graphics
// -----------------------------------------------------------------------------

/**
 * Restituisce i dati grafici della cover libreria: theme class, glyph,
 * design object, letter iniziale.
 * @param {object} user - l'utente proprietario ({ displayName, username, accountType })
 * @param {object} prefs - preferenze dal server (theme, avatarStyle, avatarSymbol, coverDesign)
 */
export function libraryCoverData(user, prefs) {
  prefs = prefs || {};
  const themeClass = `cover--${prefs.theme || 'classic'}`;
  const letter = (user.displayName || user.username || '?').trim()[0].toUpperCase();
  const glyph = prefs.avatarStyle === 'symbol' ? prefs.avatarSymbol || '§' : letter;

  const defaultKey = isOrganization(user) ? 'i-shelf' : 'g-section';
  const designKey = prefs.coverDesign || defaultKey;
  const design = LIBRARY_COVER_DESIGN_MAP[designKey] || LIBRARY_COVER_DESIGN_MAP[defaultKey];

  return { themeClass, glyph, design, designKey, letter };
}

// -----------------------------------------------------------------------------
// Organization category labels (i18n)
// -----------------------------------------------------------------------------

/**
 * Etichette italiane per OrgCategory enum (backend + Zod).
 */
export const ORG_CATEGORIES = {
  biblioteca_pubblica: 'Biblioteca pubblica',
  biblioteca_comunita: 'Biblioteca di comunità',
  libreria_indipendente: 'Libreria indipendente',
  associazione_culturale: 'Associazione culturale',
  centro_studi: 'Centro studi',
  scuola: 'Scuola',
  altro: 'Altro',
};

/** Traduce la key enum in etichetta leggibile. */
export function orgCategoryLabel(key) {
  return ORG_CATEGORIES[key] || ORG_CATEGORIES.altro;
}

// -----------------------------------------------------------------------------
// Type check booleani
// -----------------------------------------------------------------------------

/** True se l'utente e' un ente (accountType 'organization'). */
export function isOrganization(user) {
  return !!user && user.accountType === 'organization';
}

/** True se l'utente e' iscritto come lettore (libraryRole 'borrower'). */
export function isBorrower(user) {
  return !!user && user.libraryRole === 'borrower';
}

// -----------------------------------------------------------------------------
// Libri (BookDto del server)
// -----------------------------------------------------------------------------

/** Colori del design system per le copertine generate. */
const COVER_PALETTE = ['#7a1e2b', '#5a141f', '#b08840', '#6e7a5a', '#3d342e', '#1a1512'];

/**
 * Copertina generata di un libro senza immagine: sfumatura ricavata
 * dall'id, quindi sempre la stessa per lo stesso libro.
 * @param {{id: number}} book
 */
export function bookCoverGradient(book) {
  const id = Number(book?.id) || 0;
  const n = COVER_PALETTE.length;
  const a = COVER_PALETTE[(id * 7) % n];
  const b = COVER_PALETTE[(id * 13 + 3) % n];
  const c = a === b ? COVER_PALETTE[(id + 1) % n] : b;
  return `linear-gradient(135deg, ${a} 0%, ${c} 100%)`;
}

/**
 * Genere principale del libro ({ id, name, slug }) o null.
 * @param {{categories?: Array<{isPrimary?: boolean}>}} book
 */
export function bookCategory(book) {
  const list = book?.categories || [];
  return list.find((c) => c.isPrimary) || list[0] || null;
}

// -----------------------------------------------------------------------------
// currentUser() — legge da LB_AUTH_USER
// -----------------------------------------------------------------------------

/**
 * Utente della sessione con gli stessi nomi dei campi delle risposte
 * dell'API (UserDto). Better Auth chiama `name` e `image` quelli che nel
 * resto dell'API sono `displayName` e `avatarUrl`.
 *
 * @param {object|null} sessionUser - `session.user` di Better Auth (null se ospite)
 * @returns {object|null}
 */
function fromSession(sessionUser) {
  if (!sessionUser) return null;
  return {
    id: sessionUser.id,
    username: sessionUser.username,
    displayName: sessionUser.name || sessionUser.username,
    email: sessionUser.email,
    city: sessionUser.city ?? null,
    bio: sessionUser.bio ?? null,
    lat: sessionUser.lat ?? null,
    lng: sessionUser.lng ?? null,
    avatarUrl: sessionUser.image || null,
    accountType: sessionUser.accountType || 'person',
    libraryRole: sessionUser.libraryRole || null,
    role: sessionUser.role || 'user',
    isAdmin: sessionUser.role === 'admin',
    welcomeIndex: sessionUser.welcomeIndex || 0,
    createdAt: sessionUser.createdAt ?? null,
  };
}

/**
 * Attende che api-bootstrap abbia verificato la sessione (evento
 * `lb-auth-ready`). Da usare prima di leggere l'utente negli script delle
 * pagine, che partono al DOMContentLoaded, quando la richiesta di sessione
 * puo' essere ancora in corso.
 */
export function whenAuthReady() {
  if (window.LB_AUTH_READY) return Promise.resolve();
  return new Promise((resolve) =>
    window.addEventListener('lb-auth-ready', () => resolve(), { once: true })
  );
}

/**
 * Pagine riservate: restituisce l'utente autenticato oppure rimanda al login.
 * Sostituisce `API.requireAuth()` del prototipo, che restituiva l'utente
 * fittizio salvato nel browser.
 *
 * @param {string} [redirectTo='login.html']
 * @returns {Promise<object|null>} utente (forma di currentUser) o null
 */
export async function requireUser(redirectTo = 'login.html') {
  await whenAuthReady();
  const me = currentUser();
  if (!me && window.LB_AUTH_ERROR) {
    // Sessione non verificabile (server giu' o troppe richieste): l'utente
    // potrebbe essere autenticato, quindi niente rimando al login
    showSessionUnavailable();
    return null;
  }
  if (!me) {
    // Dopo l'accesso si torna alla pagina richiesta
    window.location.href =
      redirectTo === 'login.html'
        ? `login.html?next=${encodeURIComponent(location.pathname + location.search)}`
        : redirectTo;
    return null;
  }
  return me;
}

/**
 * Pagina interna in cui proseguire (parametro `next` di accesso e conferma
 * email). Accetta solo percorsi di questo sito del tipo /pagina.html?..., per
 * non poter essere usata per rimandare a siti esterni.
 *
 * @param {string|null} value
 * @returns {string|null}
 */
export function safeNextPath(value) {
  if (!value) return null;
  return /^\/[A-Za-z0-9_-]+\.html(\?[^#\s]*)?$/.test(value) ? value : null;
}

/** Avviso in testa al contenuto quando la sessione non e' verificabile. */
function showSessionUnavailable() {
  const main = document.querySelector('main') || document.body;
  if (main.querySelector('.session-unavailable')) return;
  main.insertAdjacentHTML(
    'afterbegin',
    `<div class="alert alert--error session-unavailable" role="alert" style="margin: 1rem;">
      <p><strong>Server non raggiungibile.</strong></p>
      <p>Non è stato possibile verificare l'accesso. Riprova tra poco.</p>
      <button type="button" class="btn btn--ghost btn--small" style="margin-top: .75rem;"
              onclick="location.reload()">Riprova</button>
    </div>`
  );
}

/**
 * Come requireUser, ma solo per gli amministratori (ruolo dal backend).
 *
 * @param {string} [redirectIfMissing='login.html']
 * @param {string} [redirectIfForbidden='index.html']
 */
export async function requireAdmin(
  redirectIfMissing = 'login.html',
  redirectIfForbidden = 'index.html'
) {
  const me = await requireUser(redirectIfMissing);
  if (!me) return null;
  if (!me.isAdmin) {
    window.location.href = redirectIfForbidden;
    return null;
  }
  return me;
}

/**
 * Rilegge la sessione dal server (senza cache) dopo una modifica del
 * profilo, aggiorna window.LB_AUTH_USER e ritorna l'utente aggiornato.
 */
export async function refreshCurrentUser() {
  const session = await window.LB_API.authClient.getSession({ fresh: true });
  if (session && session.user) window.LB_AUTH_USER = session.user;
  return currentUser();
}

// -----------------------------------------------------------------------------
// Punto di riferimento per le distanze (home "Librerie vicino a te", Esplora)
// -----------------------------------------------------------------------------
// Scelte di Chris: la posizione del browser solo quando l'utente la chiede
// (mai in automatico, 22 nov 2026); se l'ha chiesta vale quella, altrimenti la
// posizione del profilo (25 nov 2026: "Usa la mia posizione" anche con una
// posizione nel profilo). Quella del browser resta per la sessione della
// scheda (sessionStorage) e non viene salvata nel profilo.

const REF_KEY = 'lb_ref_position';

/**
 * @returns {{lat: number, lng: number, source: 'profile'|'browser'}|null}
 */
export function referencePosition() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(REF_KEY) || 'null');
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) {
      return { lat: saved.lat, lng: saved.lng, source: 'browser' };
    }
  } catch (_) {
    /* archiviazione non disponibile */
  }
  const me = currentUser();
  if (me && me.lat != null && me.lng != null) {
    return { lat: me.lat, lng: me.lng, source: 'profile' };
  }
  return null;
}

/** Torna alla posizione del profilo (dimentica quella del browser). */
export function clearBrowserPosition() {
  try {
    sessionStorage.removeItem(REF_KEY);
  } catch (_) {
    /* niente da togliere */
  }
}

/** True se l'utente ha una posizione salvata nel profilo. */
export function hasProfilePosition() {
  const me = currentUser();
  return !!me && me.lat != null && me.lng != null;
}

/**
 * Chiede la posizione al browser (con il suo permesso) e la ricorda per la
 * sessione. Rifiuta con un messaggio leggibile se non disponibile.
 * @returns {Promise<{lat: number, lng: number, source: 'browser'}>}
 */
export function requestBrowserPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Il browser non permette di leggere la posizione.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ref = {
          lat: +pos.coords.latitude.toFixed(5),
          lng: +pos.coords.longitude.toFixed(5),
        };
        try {
          sessionStorage.setItem(REF_KEY, JSON.stringify(ref));
        } catch (_) {
          /* resta solo per questa pagina */
        }
        resolve({ ...ref, source: 'browser' });
      },
      (err) =>
        reject(
          new Error(
            {
              1: 'Permesso negato: consenti la posizione a questo sito dal lucchetto nella barra degli indirizzi.',
              2: 'Posizione non disponibile: controlla che la localizzazione del dispositivo sia attiva.',
              3: 'Il browser non ha fornito la posizione in tempo: riprova.',
            }[err?.code] || 'Posizione non disponibile o permesso negato.'
          )
        ),
      // Su Windows la prima lettura puo' superare i 10 secondi
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 }
    );
  });
}

/**
 * Stato di accesso per il CSS (.auth-only / .guest-only) su <html>, e
 * indizio per il caricamento successivo (letto da auth-hint.js prima del
 * primo disegno). Chiamato quando il server ha risposto sulla sessione.
 *
 * @param {'user'|'guest'} state
 */
export function setAuthState(state) {
  if (state !== 'user' && state !== 'guest') return;
  document.documentElement.setAttribute('data-auth-state', state);
  try {
    if (state === 'user') localStorage.setItem('lb_auth_hint', 'user');
    else localStorage.removeItem('lb_auth_hint');
  } catch (_) {
    /* archiviazione non disponibile: resta solo l'attributo */
  }
}

/**
 * Utente corrente, letto da `window.LB_AUTH_USER` che api-bootstrap.js
 * popola dalla sessione del server (campi come in UserDto, vedi fromSession).
 *
 * @returns {object|null}
 */
export function currentUser() {
  return fromSession(window.LB_AUTH_USER);
}

/**
 * Scorrimento animato solo se l'utente non ha chiesto di ridurre le
 * animazioni (prefers-reduced-motion): valore per `behavior` di scrollTo e
 * scrollIntoView.
 */
export function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
