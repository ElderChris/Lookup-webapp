// =============================================================================
// src/lib/places.js
// =============================================================================
// Riconoscimento di un luogo nel testo di ricerca, sull'elenco dei comuni
// italiani (tabelle places/place_names, dati ISTAT). Nessun servizio esterno.
//
// Si riconosce un luogo solo quando l'intera ricerca e' il nome di un comune,
// eventualmente seguito dalla provincia o dalla regione:
//
//   "Napoli", "napoli", "Napoli (NA)", "Napoli NA", "Castro, Bergamo",
//   "Bolzano" / "Bozen", "Reggio Calabria"
//
// Con nomi uguali in piu' province vince il comune piu' esteso, se non si
// indica la provincia. Gli errori di battitura ("Napli", "Pozzuolli") sono
// ammessi solo se la ricerca non trova gia' titoli o autori (lo decide
// chi chiama, con l'opzione `allowFuzzy`).
// =============================================================================

import { normalizePlaceName } from './placeName.js';

const FUZZY_MIN_LENGTH = 4;

/** Distanza di Levenshtein (stringhe brevi: nomi di comuni) */
export function levenshtein(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Errori di battitura tollerati: 1 fino a 7 caratteri, poi 2 */
const maxTypos = (len) => (len <= 7 ? 1 : 2);

/**
 * Separa nome e qualificatore finale: "Napoli (NA)", "Napoli, NA",
 * "Napoli NA", "Castro, Bergamo". Restituisce le varianti da provare,
 * dalla piu' specifica.
 */
export function parsePlaceQuery(raw) {
  const text = String(raw ?? '').trim();
  const variants = [];

  // Sigla di provincia fra parentesi o dopo uno spazio/virgola
  const sigla = text.match(/^(.*\S)(?:\s*,\s*|\s+|\s*(?=\())\(?([A-Za-z]{2})\)?$/);
  if (sigla) {
    variants.push({ name: normalizePlaceName(sigla[1]), province: sigla[2].toUpperCase() });
  }
  // Provincia o regione per esteso dopo la virgola
  const comma = text.lastIndexOf(',');
  if (comma > 0) {
    variants.push({
      name: normalizePlaceName(text.slice(0, comma)),
      area: normalizePlaceName(text.slice(comma + 1)),
    });
  }
  variants.push({ name: normalizePlaceName(text) });
  return variants.filter((v) => v.name);
}

function matchesQualifier(row, v) {
  if (v.province) return row.provinceCode === v.province;
  if (v.area) {
    // Parole intere: "Bergamo", "Campania", "Bolzano" (di "Bolzano/Bozen")
    const has = (value) => ` ${normalizePlaceName(value)} `.includes(` ${v.area} `);
    return has(row.provinceName) || has(row.regionName);
  }
  return true;
}

const PLACE_COLUMNS = `
  p.code, p.name, p.province_code AS "provinceCode", p.province_name AS "provinceName",
  p.region_name AS "regionName", p.lat, p.lng, p.area_km2 AS "areaKm2", n.name_norm AS "nameNorm"`;

/** Fra i candidati: prima il qualificatore, poi il comune piu' esteso */
function pick(rows, v) {
  const ok = rows.filter((r) => matchesQualifier(r, v));
  ok.sort((a, b) => b.areaKm2 - a.areaKm2);
  return ok[0] || null;
}

function toPlace(row, match, query) {
  return {
    code: row.code,
    name: row.name,
    provinceCode: row.provinceCode,
    provinceName: row.provinceName,
    regionName: row.regionName,
    lat: row.lat,
    lng: row.lng,
    match, // 'exact' | 'fuzzy'
    query,
  };
}

/**
 * Cerca un comune che corrisponda all'intera ricerca.
 * @returns {Promise<null | {code,name,provinceCode,provinceName,regionName,lat,lng,match,query}>}
 */
export async function resolvePlace(prisma, q, { allowFuzzy = true } = {}) {
  const variants = parsePlaceQuery(q);
  if (!variants.length) return null;

  // 1. Nome esatto (senza accenti e maiuscole)
  const names = [...new Set(variants.map((v) => v.name))];
  const exact = await prisma.$queryRawUnsafe(
    `SELECT ${PLACE_COLUMNS}
       FROM place_names n JOIN places p ON p.code = n.place_code
      WHERE n.name_norm = ANY($1::text[])`,
    names
  );
  for (const v of variants) {
    const found = pick(
      exact.filter((r) => r.nameNorm === v.name),
      v
    );
    if (found) return toPlace(found, 'exact', q);
  }

  // 2. Piccoli errori di battitura: candidati per trigrammi, poi Levenshtein
  if (!allowFuzzy) return null;
  for (const v of variants) {
    if (v.name.length < FUZZY_MIN_LENGTH) continue;
    const candidates = await prisma.$queryRawUnsafe(
      `SELECT ${PLACE_COLUMNS}
         FROM place_names n JOIN places p ON p.code = n.place_code
        WHERE n.name_norm % $1
        ORDER BY similarity(n.name_norm, $1) DESC
        LIMIT 20`,
      v.name
    );
    const limit = maxTypos(v.name.length);
    let best = null;
    for (const row of candidates) {
      if (!matchesQualifier(row, v)) continue;
      const d = levenshtein(v.name, row.nameNorm);
      if (d > limit) continue;
      if (!best || d < best.d || (d === best.d && row.areaKm2 > best.row.areaKm2)) {
        best = { row, d };
      }
    }
    if (best) return toPlace(best.row, 'fuzzy', q);
  }
  return null;
}
