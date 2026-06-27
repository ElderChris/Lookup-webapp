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

   Vedi docs/architecture.md e docs/rapporto_tecnico.md §4.30 per le motivazioni.
   ============================================================================= */

import { Storage } from './storage.js';
import { API } from './api.js';
import { UI } from './ui.js';
import {
  LIBRARY_COVER_DESIGNS, LIBRARY_COVER_DESIGN_MAP,
  LOAN_STATUS, LOAN_STATUS_ORDER, LOAN_STATUS_LABEL, LOAN_STATUS_HINT
} from './data.js';

/* -----------------------------------------------------------------
   ESPOSIZIONE GLOBALE
   ----------------------------------------------------------------- */
/* I 15 HTML hanno script inline che usano API/UI/Storage come globali
   (es. <script>API.getBooks()...</script>). Manteniamo questa convenzione
   per non toccare gli HTML: gli inline script restano page-specific wiring
   auto-contenuto. Vedi docs/rapporto_tecnico.md §4.30. */
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
   ----------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  Storage.init();
  API.seedSocialDemo();
  // v1.6: controlla i prestiti in `borrowed` con deadline superata e
  // genera i solleciti (notifica + email simulata). Una sola volta per
  // prestito grazie al flag `reminder_sent_at`.
  API.checkOverdueLoans();
  UI.initMobileNav();
  UI.highlightActiveNav();
  UI.initAuthToggle();
  UI.initNotifications();
  UI.initProfileAvatar();
  UI.initLikeChips();
  UI.initAdminLink();
});
