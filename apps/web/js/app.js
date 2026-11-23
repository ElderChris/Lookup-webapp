/* =============================================================================
   app.js — Entry point
   =============================================================================
   Punto di ingresso comune delle pagine (<script type="module">):
   inizializza header, navigazione, notifiche e avatar quando la sessione
   e' nota (evento `lb-auth-ready` di api-bootstrap.js). Tutti i dati
   arrivano dal server (window.LB_API, vedi api-bootstrap.js).
   ============================================================================= */

import { UI } from './ui.js';
import { LIBRARY_COVER_DESIGNS } from './coverDesigns.js';

/* -----------------------------------------------------------------
   GLOBALI USATI DAGLI SCRIPT DELLE PAGINE
   ----------------------------------------------------------------- */
window.UI = UI;
// Selettore della copertina in profile-setup.html
window.LIBRARY_COVER_DESIGNS = LIBRARY_COVER_DESIGNS;

/* -----------------------------------------------------------------
   DATI DEL PROTOTIPO NEL BROWSER
   -----------------------------------------------------------------
   Le versioni precedenti scrivevano a ogni pagina un intero insieme di dati
   di esempio nel localStorage (utenti, libri, prestiti, notifiche finti),
   che alcune pagine mostravano al posto dei dati reali. Non vengono piu'
   creati; quelli gia' presenti si cancellano una volta, riconoscendoli
   dalla chiave `data_version`. Resta solo l'indizio di accesso letto da
   auth-hint.js. `auth_state` era lo stato di accesso del prototipo: lo
   stato vero e' la sessione del server. */
const KEEP_KEYS = new Set(['lb_auth_hint']);

function purgePrototypeData() {
  try {
    localStorage.removeItem('auth_state');
    if (localStorage.getItem('data_version') === null) return;
    Object.keys(localStorage)
      .filter((key) => !KEEP_KEYS.has(key))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage non disponibile (navigazione privata, quota): niente da fare */
  }
}

purgePrototypeData();

function runInits() {
  UI.initMobileNav();
  UI.highlightActiveNav();
  UI.initAuthToggle();
  UI.initNotifications();
  UI.initProfileAvatar();
  UI.initLikeChips();
  UI.initAdminLink();
  UI.initOfflineBadge(); // badge PWA offline
}

document.addEventListener('DOMContentLoaded', () => {
  // Aspetta il session lookup di api-bootstrap prima di init UI (window.LB_AUTH_USER
  // popolato). Se gia' pronto, procedi subito; altrimenti attendi l'evento.
  if (window.LB_AUTH_READY) {
    runInits();
  } else {
    window.addEventListener('lb-auth-ready', runInits, { once: true });
  }
});
