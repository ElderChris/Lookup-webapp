// =============================================================================
// apps/web/js/auth-hint.js — Stato di accesso prima del primo disegno
// =============================================================================
// Caricato in modo sincrono nell'<head> di ogni pagina, prima che il browser
// disegni qualcosa. Legge l'indizio salvato all'ultima verifica della sessione
// ("l'ultima volta eri autenticato") e imposta data-auth-state su <html>: il
// CSS mostra subito le parti per utente o per ospite (.auth-only /
// .guest-only), senza il lampo della versione sbagliata.
//
// L'indizio non contiene dati personali e non da' accesso a nulla: la sessione
// la verifica sempre il server (api-bootstrap.js), che poi conferma o corregge
// lo stato. I dati personali arrivano solo dal server.
// =============================================================================
(function () {
  var state = 'guest';
  try {
    if (localStorage.getItem('lb_auth_hint') === 'user') state = 'user';
  } catch (_) {
    /* navigazione privata o archiviazione non disponibile */
  }
  document.documentElement.setAttribute('data-auth-state', state);
})();
