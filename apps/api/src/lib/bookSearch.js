// =============================================================================
// src/lib/bookSearch.js
// =============================================================================
// Interpretazione del testo cercato in Esplora (GET /api/books?q=...).
//
// Cosa si cerca, senza distinguere maiuscole e accenti ("citta" = "città"):
//   - titolo e autore, anche in parte e con piccoli errori di battitura
//   - ISBN, con o senza trattini e spazi, a 10 o 13 cifre
//   - citta' pubblica del proprietario (comune e quartiere, es. "Chiaia") e
//     indirizzo pubblico degli enti (via, CAP)
//   - un comune: "Napoli", "Pozzuoli (NA)" -> librerie per distanza dal centro
//   - testo e comune insieme: "Saviano Pozzuoli", "Calvino, Napoli",
//     "Camilleri a Napoli" -> quei volumi per distanza dal comune
//
// Modalita' restituite da analyzeQuery():
//   text        solo testo
//   place       l'intera ricerca e' un comune
//   text+place  testo seguito da un comune; il testo trova titoli o autori
// =============================================================================

import { resolvePlace } from './places.js';

// Lettere accentate -> senza accento (stessa regola in SQL e in JavaScript)
const ACCENTED = 'àáâäãåèéêëìíîïòóôöõùúûüýÿçñ';
const PLAIN = 'aaaaaaeeeeiiiiooooouuuuyycn';

/** Minuscole e senza accenti, come FOLD() in SQL */
export function foldText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const FOLD = (col) => `translate(lower(${col}), '${ACCENTED}', '${PLAIN}')`;

// -----------------------------------------------------------------------------
// ISBN
// -----------------------------------------------------------------------------

function isbn10CheckDigit(nine) {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(nine[i]) * (10 - i);
  const d = (11 - (sum % 11)) % 11;
  return d === 10 ? 'X' : String(d);
}

function isbn13CheckDigit(twelve) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(twelve[i]) * (i % 2 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}

/**
 * Forme dell'ISBN da cercare: quella scritta e quella equivalente a 10/13
 * cifre (978...). [] se il testo non e' un ISBN.
 *   "978-88-07-90003-7" -> ['9788807900037', '8807900034']
 */
export function isbnCandidates(q) {
  const compact = String(q ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  if (/^\d{13}$/.test(compact)) {
    const out = [compact];
    if (compact.startsWith('978')) {
      const nine = compact.slice(3, 12);
      out.push(nine + isbn10CheckDigit(nine));
    }
    return out;
  }
  if (/^\d{9}[\dX]$/.test(compact)) {
    const twelve = `978${compact.slice(0, 9)}`;
    return [compact, twelve + isbn13CheckDigit(twelve)];
  }
  return [];
}

// -----------------------------------------------------------------------------
// Testo: titolo, autore, luogo del proprietario, ISBN
// -----------------------------------------------------------------------------

// Errori di battitura (pg_trgm, word_similarity): la ricerca confrontata con
// la parola piu' simile di titolo e autore. "Calvno" -> Calvino (0,57); dagli
// 8 caratteri la soglia sale a 0,6, cosi' "Montalbano" non trova piu'
// "Montale" (0,55) ma "Camillieri" trova ancora Camilleri (0,62).
const SIMILARITY_MIN_LENGTH = 4;
const similarityMin = (text) => (text.length >= 8 ? 0.6 : 0.5);

const MAX_IDS = 5000;

/**
 * Volumi attivi che corrispondono al testo.
 * @returns {Promise<{all: number[], titleAuthor: number[], exactTitleAuthor: number}>}
 *   all: tutte le corrispondenze; titleAuthor: su titolo, autore o ISBN
 *   (anche per somiglianza); exactTitleAuthor: quante contengono il testo
 *   esatto nel titolo o nell'autore
 */
export async function textMatches(prisma, text, isbns = []) {
  const t = foldText(text).trim();
  if (!t) return { all: [], titleAuthor: [], exactTitleAuthor: 0 };
  const fuzzy = t.length >= SIMILARITY_MIN_LENGTH;
  const min = similarityMin(t);
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT b.id,
           (strpos(${FOLD('b.title')}, $1) > 0 OR strpos(${FOLD('b.author')}, $1) > 0) AS exact,
           (b.isbn = ANY($2::text[])) AS isbn,
           ($3 AND (word_similarity($1, ${FOLD('b.title')}) >= $4
                 OR word_similarity($1, ${FOLD('b.author')}) >= $4)) AS similar
      FROM books b
      JOIN users u ON u.id = b.owner_id
      LEFT JOIN organization_profiles op ON op.user_id = u.id
     WHERE b.status = 'active'
       AND (strpos(${FOLD('b.title')}, $1) > 0
         OR strpos(${FOLD('b.author')}, $1) > 0
         OR strpos(${FOLD("coalesce(u.public_city, '')")}, $1) > 0
         OR strpos(${FOLD("coalesce(op.public_address, '')")}, $1) > 0
         OR b.isbn = ANY($2::text[])
         OR ($3 AND (word_similarity($1, ${FOLD('b.title')}) >= $4
                  OR word_similarity($1, ${FOLD('b.author')}) >= $4)))
     LIMIT ${MAX_IDS}`,
    t,
    isbns,
    fuzzy,
    min
  );
  return {
    all: rows.map((r) => Number(r.id)),
    titleAuthor: rows.filter((r) => r.exact || r.isbn || r.similar).map((r) => Number(r.id)),
    exactTitleAuthor: rows.filter((r) => r.exact || r.isbn).length,
  };
}

// -----------------------------------------------------------------------------
// Testo + comune: "Saviano Pozzuoli", "Calvino, Napoli", "Camilleri a Napoli"
// -----------------------------------------------------------------------------

// Parole di collegamento fra testo e luogo, tolte dalla fine del testo
const CONNECTOR = /[\s,]+(?:a|ad|in|presso|vicino(?:\s+a)?|intorno\s+a|dalle\s+parti\s+di)$/i;

/** Divisioni possibili "testo | luogo", dal luogo piu' lungo al piu' corto */
export function splitTextPlace(q) {
  const text = String(q ?? '').trim();
  const out = [];
  const re = /[\s,]+/g;
  let m;
  while ((m = re.exec(text))) {
    const rest = text
      .slice(0, m.index)
      .replace(CONNECTOR, '')
      .replace(/[\s,]+$/, '');
    const place = text.slice(m.index + m[0].length).trim();
    if (rest && place) out.push({ text: rest, place });
  }
  return out;
}

/**
 * Interpreta la ricerca.
 * @returns {Promise<{mode: 'text'|'place'|'text+place', ids: number[],
 *   firstIds: number[], place: object|null}>}
 *   ids: volumi che corrispondono al testo; firstIds: da mostrare per primi
 *   (titolo/autore/ISBN); place: comune riconosciuto (con `text` se misto)
 */
export async function analyzeQuery(prisma, q, { placeSearch = true } = {}) {
  const isbns = isbnCandidates(q);
  const whole = await textMatches(prisma, q, isbns);
  const result = { mode: 'text', ids: whole.all, firstIds: whole.titleAuthor, place: null };
  if (!placeSearch || isbns.length) return result;

  // 1. L'intera ricerca e' un comune (errori di battitura solo se il testo
  //    non e' gia' contenuto in qualche titolo o autore)
  const place = await resolvePlace(prisma, q, { allowFuzzy: whole.exactTitleAuthor === 0 });
  if (place) return { ...result, mode: 'place', place: { ...place, text: null } };

  // 2. Testo seguito da un comune, solo se l'intera ricerca non e' gia' in
  //    un titolo o in un autore ("Storia di Napoli" resta un titolo)
  if (whole.exactTitleAuthor > 0) return result;
  for (const split of splitTextPlace(q)) {
    const p = await resolvePlace(prisma, split.place, { allowFuzzy: false });
    if (!p) continue;
    const part = await textMatches(prisma, split.text, isbnCandidates(split.text));
    if (!part.titleAuthor.length) continue;
    return {
      mode: 'text+place',
      ids: part.titleAuthor,
      firstIds: [],
      place: { ...p, query: q, text: split.text },
    };
  }
  return result;
}
