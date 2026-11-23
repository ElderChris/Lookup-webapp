// =============================================================================
// tests/seedIds.mjs
// =============================================================================
// ID convenzionali dei dati di seed, in un modulo senza dipendenze.
// helpers.mjs e authTestHelpers.mjs si importano a vicenda: tenere SEED qui
// evita che uno dei due lo legga prima che sia inizializzato.
// =============================================================================

// IDs convenzionali dei dati seed (vedi prisma/seed.mjs)
// gli USER IDs sono stringhe (CUID-like) per compat Better Auth.
// Book/Category IDs restano Int (autoincrement).
export const SEED = {
  USER_CHIARA: 'usr_chiara', // owner di libri 1, 2, 3
  USER_MARCO: 'usr_marco', // owner di libri 4, 5, 6
  USER_ANNA: 'usr_anna', // owner di libri 7, 8
  USER_LUCA: 'usr_luca',
  USER_GIULIA: 'usr_giulia',
  USER_ROBERTO: 'usr_roberto',
  USER_BIBLIOTECA_SANITA: 'usr_biblio_sanita', // org
  USER_LETTORI_ERRANTI: 'usr_lettori_erranti', // org
  USER_LIBRERIA_SPACCANAPOLI: 'usr_libreria_spacca', // org
  USER_CENTRO_MEZZOGIORNO: 'usr_centro_mezzo', // org
  USER_ADMIN: 'usr_admin',

  BOOK_GATTOPARDO: 1,
  BOOK_GADDA: 2,
  BOOK_VITTORINI: 3,
  BOOK_LARSSON: 4, // gialli
  BOOK_PROMESSI_SPOSI: 7,
  BOOK_GOMORRA: 18,

  CAT_NARRATIVA: 1,
  CAT_SAGGISTICA: 2,
  CAT_GIALLI: 5,
};
