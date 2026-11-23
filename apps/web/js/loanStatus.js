/* =============================================================================
   loanStatus.js — Stati del prestito (etichette e suggerimenti)
   =============================================================================
   Stessi valori di loan_requests.status sul server; qui solo l'ordine della
   timeline e i testi mostrati nelle pagine.
   ============================================================================= */

/* ============================================================
   PRESTITI E TIMELINE DI STATO
   ============================================================
   Ogni richiesta di prestito attraversa cinque stati:
     1. 'requested'  → richiesta inviata
     2. 'confirmed'  → richiesta confermata dal prestatore
     3. 'borrowed'   → ritirato dal richiedente (in suo possesso)
     4. 'returning'  → restituzione avviata dal richiedente
     5. 'returned'   → restituzione confermata dal prestatore (chiuso)
   Le transizioni sono unidirezionali. Ogni passaggio porta una data
   in modo da poter generare la timeline visuale di stato. */
export const LOAN_STATUS = {
  REQUESTED: 'requested',
  CONFIRMED: 'confirmed',
  BORROWED: 'borrowed',
  RETURNING: 'returning',
  RETURNED: 'returned',
};
export const LOAN_STATUS_ORDER = ['requested', 'confirmed', 'borrowed', 'returning', 'returned'];
export const LOAN_STATUS_LABEL = {
  requested: 'Richiesta inviata',
  confirmed: 'Richiesta confermata',
  borrowed: 'Prestato',
  returning: 'Restituzione in corso',
  returned: 'Restituito',
};
export const LOAN_STATUS_HINT = {
  requested: 'In attesa di conferma dal prestatore',
  confirmed: 'Ora puoi recarti fisicamente a prendere il volume',
  borrowed: 'Il volume è in tuo possesso. Quando hai finito, avvia la restituzione',
  returning: 'In attesa che il prestatore confermi la ricezione del volume',
  returned: 'Restituzione completata. Grazie!',
};
