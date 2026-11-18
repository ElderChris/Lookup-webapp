/* =============================================================================
   app.js — Entry point
   =============================================================================
   Questo file è il punto di ingresso del frontend di Lookup.
   Caricato come <script type="module"> dalle 15 pagine HTML, importa tutti
   i moduli, esegue l'inizializzazione globale al DOMContentLoaded, ed
   espone API/UI/Storage come globali window.* per compatibilità con gli
   script inline delle pagine.

   Architettura moduli (v3.0.0-alpha.0+):
     data.js     → seed fixtures + costanti tassonomiche
     storage.js  → wrapper localStorage (sarà refactored in Fase 2)
     api.js      → logica applicativa (sarà endpoint REST in Fase 1)
     ui.js       → rendering DOM e wiring eventi
     app.js      → entry + init + window globals (questo file)
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
   INIZIALIZZAZIONE GLOBALE (al DOMContentLoaded)
   -----------------------------------------------------------------
   Beta 6 sess 2: rimosso `applySessionShim()`. Le pagine leggono ora
   `window.LB_AUTH_USER` (popolato da api-bootstrap) direttamente, oppure
   `window.LB_UI.currentUser()` che ritorna la shape legacy adattata.

   Il legacy `API.getCurrentUser()` esiste ancora ma non e' piu' patchato:
   ritorna null (a meno che il localStorage non contenga un `current_user_id`,
   ma quello non viene piu' scritto). Le chiamate residue nel legacy
   `api.js` sono dead code.

   `Storage.get('users')` non contiene piu' l'utente corrente iniettato.
   Le funzioni legacy che facevano join su quell'array (getBooksByOwner,
   getFollowers, ecc.) non funzionano piu' per l'utente reale — ma sono
   comunque dead code (le pagine usano i wrapper backend). */

function runInits() {
  Storage.init();
  API.seedSocialDemo();
  // Beta 7: rimosso API.checkOverdueLoans() - ora gestito dal job backend
  // BullMQ (src/jobs/overdueLoans.js) schedulato ogni ora.
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
