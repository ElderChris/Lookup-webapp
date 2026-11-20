/* =============================================================================
   app.js — Entry point
   =============================================================================
   Punto di ingresso comune delle pagine (<script type="module">):
   inizializza header, navigazione, notifiche e avatar quando la sessione
   e' nota (evento `lb-auth-ready` di api-bootstrap.js).

   Espone ancora `window.API` e `window.Storage` del prototipo
   (js/legacy/) per le parti delle pagine non ancora collegate al backend:
   vanno eliminati quando nessuna pagina li usa piu'.
   ============================================================================= */

import { Storage } from './legacy/storage.js';
import { API } from './legacy/api.js';
import { UI } from './ui.js';
import {
  LIBRARY_COVER_DESIGNS,
  LIBRARY_COVER_DESIGN_MAP,
  LOAN_STATUS,
  LOAN_STATUS_ORDER,
  LOAN_STATUS_LABEL,
  LOAN_STATUS_HINT,
} from './data.js';

/* -----------------------------------------------------------------
   ESPOSIZIONE GLOBALE
   ----------------------------------------------------------------- */
/* I 15 HTML hanno script inline che usano API/UI/Storage come globali
   (es. <script>API.getBooks()...</script>). Manteniamo questa convenzione
   per non toccare gli HTML: gli inline script restano page-specific wiring
   auto-contenuto. */
window.API = API;
window.UI = UI;
window.Storage = Storage;
window.LIBRARY_COVER_DESIGNS = LIBRARY_COVER_DESIGNS;
window.LIBRARY_COVER_DESIGN_MAP = LIBRARY_COVER_DESIGN_MAP;
window.LOAN_STATUS = LOAN_STATUS;
window.LOAN_STATUS_ORDER = LOAN_STATUS_ORDER;
window.LOAN_STATUS_LABEL = LOAN_STATUS_LABEL;
window.LOAN_STATUS_HINT = LOAN_STATUS_HINT;

/* -----------------------------------------------------------------
   INIZIALIZZAZIONE GLOBALE (al DOMContentLoaded, dopo la sessione)
   ----------------------------------------------------------------- */

/* -----------------------------------------------------------------
   DATI DEL PROTOTIPO NEL BROWSER
   -----------------------------------------------------------------
   Le versioni precedenti scrivevano a ogni pagina un intero insieme di dati
   di esempio nel localStorage (utenti, libri, prestiti, notifiche finti),
   che alcune pagine mostravano al posto dei dati reali. Non vengono piu'
   creati; quelli gia' presenti si cancellano una volta, riconoscendoli
   dalla chiave `data_version`. Resta solo `auth_state` (uscita locale). */
const KEEP_KEYS = new Set(['auth_state']);

function purgePrototypeData() {
  try {
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
  UI.initOfflineBadge(); // Beta 9: badge PWA offline
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
