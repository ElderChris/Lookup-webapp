// =============================================================================
// apps/web/js/ui-helpers.js — UX helpers estratti dal legacy (Beta 3)
// =============================================================================
// Piccoli helper puramente presentazionali che restano frontend-only:
// welcome message rotation, library cover graphics, org category labels,
// helper booleani sul tipo di account. Il backend non li serve — sono
// solo interpretazione di dati esistenti per la UI.
//
// L'obiettivo di estrarli qui e' rimuovere la dipendenza da `API.<funzione>`
// legacy nelle pagine principali. In una fase futura il modulo `legacy/api.js`
// verra' ridotto ancora, e queste funzioni troveranno casa in modo pulito.
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
  const first = (user.display_name || user.displayName || user.username || '').split(' ')[0];
  const idx = (user.welcome_index || user.welcomeIndex || 0) % WELCOME_MESSAGES.length;
  return WELCOME_MESSAGES[idx].replace('{name}', first);
}

// -----------------------------------------------------------------------------
// Library cover graphics
// -----------------------------------------------------------------------------

/**
 * Mapping design keys → SVG configuration. Le chiavi sono referenziate
 * da UserPreference.coverDesign.
 * Se serve estendere: aggiungere qui + rendering in ui.js.
 */
export const LIBRARY_COVER_DESIGN_MAP = {
  'g-section': { name: 'Sezione Aurea', pattern: 'grid', accent: 'gold' },
  'i-shelf': { name: 'Scaffale', pattern: 'shelves', accent: 'wood' },
  monogram: { name: 'Monogramma', pattern: 'monogram', accent: 'bordeaux' },
  stripes: { name: 'Righe', pattern: 'stripes', accent: 'ink' },
  dots: { name: 'Punti', pattern: 'dots', accent: 'sepia' },
  plain: { name: 'Semplice', pattern: 'none', accent: 'neutral' },
};

/**
 * Restituisce i dati grafici della cover libreria: theme class, glyph,
 * design object, letter iniziale.
 * @param {object} user - l'utente proprietario
 * @param {object} prefs - preferenze (theme, avatar_style, cover_design, ...)
 */
export function libraryCoverData(user, prefs) {
  prefs = prefs || {};
  const themeClass = `cover--${prefs.theme || 'classic'}`;
  const glyph =
    prefs.avatar_style === 'symbol'
      ? prefs.avatar_symbol || '§'
      : (user.display_name || user.username || '?').trim()[0].toUpperCase();

  const defaultKey = isOrganization(user) ? 'i-shelf' : 'g-section';
  const designKey = prefs.cover_design || defaultKey;
  const design = LIBRARY_COVER_DESIGN_MAP[designKey] || LIBRARY_COVER_DESIGN_MAP[defaultKey];
  const letter = (user.display_name || user.username || '?').trim()[0].toUpperCase();

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

/** True se l'utente ha account_type='organization'. */
export function isOrganization(user) {
  return !!user && (user.account_type === 'organization' || user.accountType === 'organization');
}

/** True se il ruolo libreria dell'utente e' 'borrower' (lettore erratico). */
export function isBorrower(user) {
  return !!user && (user.library_role === 'borrower' || user.libraryRole === 'borrower');
}

// -----------------------------------------------------------------------------
// Beta 6 sess 2: currentUser() — legge da LB_AUTH_USER
// -----------------------------------------------------------------------------

/**
 * Adatta l'oggetto Better Auth session (`window.LB_AUTH_USER`) alla shape
 * "legacy" che le pagine si aspettano da `API.getCurrentUser()`.
 *
 * Backend camelCase → frontend snake_case, con derivate come `is_admin`
 * dal ruolo. Utile per pagine con inline scripts che leggono i campi
 * senza dover fare un adapter inline ogni volta.
 *
 * @param {object|null} beUser - oggetto session (o null se guest)
 * @returns {object|null}
 */
export function backendUserToLegacy(beUser) {
  if (!beUser) return null;
  return {
    id: beUser.id,
    username: beUser.username,
    display_name: beUser.name || beUser.displayName || beUser.username,
    email: beUser.email,
    city: beUser.city ?? null,
    bio: beUser.bio ?? null,
    lat: beUser.lat ?? null,
    lng: beUser.lng ?? null,
    avatar_url: beUser.image || beUser.avatarUrl || null,
    account_type: beUser.accountType || 'person',
    library_role: beUser.libraryRole || null,
    is_admin: beUser.role === 'admin',
    welcome_index: beUser.welcomeIndex || 0,
    created_at: beUser.createdAt || new Date().toISOString(),
  };
}

/**
 * Ritorna l'utente corrente in shape legacy, letto da `window.LB_AUTH_USER`
 * (popolato da api-bootstrap.js dopo il lookup Better Auth session).
 *
 * Rispetta il flag legacy `auth_state`: se localStorage.auth_state !== 'user'
 * ritorna null anche se c'e' una sessione backend. Serve per il "soft logout
 * locale" (utente clicca "Esci" ma il cookie e' ancora valido finche' non
 * arriva l'HTTP call).
 *
 * @returns {object|null}
 */
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
    window.location.href = redirectTo;
    return null;
  }
  return me;
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
  if (!me.is_admin) {
    window.location.href = redirectIfForbidden;
    return null;
  }
  return me;
}

/**
 * Rilegge la sessione dal server (senza cache) dopo una modifica del
 * profilo, aggiorna window.LB_AUTH_USER e ritorna l'utente in shape legacy.
 */
export async function refreshCurrentUser() {
  const session = await window.LB_API.authClient.getSession({ fresh: true });
  if (session && session.user) window.LB_AUTH_USER = session.user;
  return currentUser();
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

export function currentUser() {
  // Rispetta soft logout locale (auth_state='guest')
  try {
    const raw = localStorage.getItem('auth_state');
    if (raw && JSON.parse(raw) !== 'user') return null;
  } catch (_) {
    /* ignora incognito o quota exceeded */
  }
  return backendUserToLegacy(window.LB_AUTH_USER);
}
