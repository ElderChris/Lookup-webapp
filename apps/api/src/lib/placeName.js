// =============================================================================
// src/lib/placeName.js
// =============================================================================
// Normalizzazione dei nomi di luogo, condivisa fra lo script che genera
// l'elenco dei comuni (scripts/build-places-migration.mjs) e la ricerca
// (lib/places.js): minuscole, senza accenti, apostrofi e trattini come spazi.
//
//   "Reggio nell'Emilia" -> "reggio nell emilia"
//   "Forlì"              -> "forli"
// =============================================================================

export function normalizePlaceName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’`´.,;:()\-/_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
