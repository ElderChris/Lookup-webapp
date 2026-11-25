// =============================================================================
// scripts/build-places-migration.mjs
// =============================================================================
// Genera la migrazione con l'elenco dei comuni italiani usato dalla ricerca
// per luogo (es. "Napoli" -> volumi ordinati per distanza dal centro).
//
// Fonte: confini comunali ISTAT, redistribuiti in GeoJSON da Openpolis
// (https://github.com/guglielmo/geojson-italy), licenza CC BY 4.0.
// Attribuzione: "Confini amministrativi © ISTAT, CC BY 4.0".
//
// Per ogni comune si calcola il centro geometrico del territorio (centroide
// del poligono; se cade fuori dal confine, un punto interno) e la superficie,
// usata per scegliere fra comuni omonimi.
//
// Uso (dalla cartella apps/api):
//   node scripts/build-places-migration.mjs <limits_IT_municipalities.geojson> <cartella migrazione>
//
// Per aggiornare l'elenco a un nuovo anno ISTAT si genera una nuova
// migrazione: la tabella viene svuotata e ricaricata.
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePlaceName } from '../src/lib/placeName.js';

const [, , inputPath, outDir] = process.argv;
if (!inputPath || !outDir) {
  console.error('Uso: node scripts/build-places-migration.mjs <geojson> <cartella migrazione>');
  process.exit(1);
}

// Nomi d'uso comune diversi da quello ufficiale
const EXTRA_ALIASES = {
  'Reggio di Calabria': ['Reggio Calabria'],
  "Reggio nell'Emilia": ['Reggio Emilia'],
};

const KM_PER_DEG = 111.32;

/** Area (km²) e centroide di un anello, in coordinate proiettate localmente */
function ringStats(ring, cosLat) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = [ring[j][0] * cosLat, ring[j][1]];
    const [x1, y1] = [ring[i][0] * cosLat, ring[i][1]];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a /= 2;
  if (a === 0) return { area: 0, x: ring[0][0] * cosLat, y: ring[0][1] };
  return { area: a, x: cx / (6 * a), y: cy / (6 * a) };
}

/** Punto dentro un anello (ray casting), coordinate geografiche */
function inRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(pt, polygon) {
  if (!inRing(pt, polygon[0])) return false;
  return !polygon.slice(1).some((hole) => inRing(pt, hole));
}

/** Punto interno: centro del tratto piu' lungo della riga orizzontale y */
function interiorPoint(polygon, y) {
  const xs = [];
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
  }
  xs.sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (!best || xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
  }
  return best ? [(best[0] + best[1]) / 2, y] : null;
}

function placeGeometry(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const lat0 = polygons[0][0][0][1];
  const cosLat = Math.cos((lat0 * Math.PI) / 180);

  let area = 0;
  let sx = 0;
  let sy = 0;
  let largest = null;
  for (const polygon of polygons) {
    let pa = 0;
    let px = 0;
    let py = 0;
    polygon.forEach((ring, k) => {
      const s = ringStats(ring, cosLat);
      // Il verso degli anelli non e' garantito: esterno positivo, buchi negativi
      const sign = k === 0 ? 1 : -1;
      const a = sign * Math.abs(s.area);
      pa += a;
      px += s.x * a;
      py += s.y * a;
    });
    area += pa;
    sx += px;
    sy += py;
    if (!largest || pa > largest.area) largest = { polygon, area: pa, x: px / pa, y: py / pa };
  }

  let point = [sx / area / cosLat, sy / area];
  if (!polygons.some((p) => inPolygon(point, p))) {
    const c = [largest.x / cosLat, largest.y];
    point = inPolygon(c, largest.polygon) ? c : interiorPoint(largest.polygon, largest.y) || c;
  }
  return {
    lng: point[0],
    lat: point[1],
    areaKm2: area * KM_PER_DEG * KM_PER_DEG,
  };
}

const sql = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v, d) => Number(v.toFixed(d));

const data = JSON.parse(readFileSync(inputPath, 'utf8'));
const places = [];
const names = [];
for (const f of data.features) {
  const p = f.properties;
  const g = placeGeometry(f.geometry);
  places.push(
    `(${sql(p.com_istat_code)}, ${sql(p.name)}, ${sql(p.prov_acr)}, ${sql(p.prov_name)}, ` +
      `${sql(p.reg_name)}, ${num(g.lat, 5)}, ${num(g.lng, 5)}, ${num(g.areaKm2, 2)})`
  );
  // Ogni nome con cui il comune si puo' cercare: ufficiale, versioni
  // bilingui ("Bolzano/Bozen") e nomi d'uso comune
  const aliases = new Set([p.name, ...p.name.split('/'), ...(EXTRA_ALIASES[p.name] || [])]);
  const norms = new Set([...aliases].map(normalizePlaceName).filter(Boolean));
  for (const n of norms) names.push(`(${sql(p.com_istat_code)}, ${sql(n)})`);
}

const chunks = (rows, size = 500) => {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
};

const out = [
  '-- Comuni italiani per la ricerca per luogo (es. "Napoli": volumi ordinati',
  '-- per distanza dal centro del comune).',
  '-- Fonte: confini comunali ISTAT al 1 gennaio 2026, via Openpolis',
  '-- (github.com/guglielmo/geojson-italy). Confini amministrativi © ISTAT, CC BY 4.0.',
  '-- Generata con scripts/build-places-migration.mjs: non modificare a mano.',
  '',
  'CREATE EXTENSION IF NOT EXISTS pg_trgm;',
  '',
  '-- CreateTable',
  'CREATE TABLE IF NOT EXISTS "places" (',
  '    "code" VARCHAR(6) NOT NULL,',
  '    "name" TEXT NOT NULL,',
  '    "province_code" VARCHAR(2) NOT NULL,',
  '    "province_name" TEXT NOT NULL,',
  '    "region_name" TEXT NOT NULL,',
  '    "lat" DOUBLE PRECISION NOT NULL,',
  '    "lng" DOUBLE PRECISION NOT NULL,',
  '    "area_km2" DOUBLE PRECISION NOT NULL,',
  '',
  '    CONSTRAINT "places_pkey" PRIMARY KEY ("code")',
  ');',
  '',
  '-- CreateTable',
  'CREATE TABLE IF NOT EXISTS "place_names" (',
  '    "place_code" VARCHAR(6) NOT NULL,',
  '    "name_norm" TEXT NOT NULL,',
  '',
  '    CONSTRAINT "place_names_pkey" PRIMARY KEY ("place_code","name_norm")',
  ');',
  '',
  '-- CreateIndex',
  'CREATE INDEX IF NOT EXISTS "place_names_name_norm_idx" ON "place_names"("name_norm");',
  '',
  '-- CreateIndex',
  'CREATE INDEX IF NOT EXISTS "place_names_name_norm_trgm" ON "place_names" USING GIN ("name_norm" gin_trgm_ops);',
  '',
  '-- AddForeignKey',
  'ALTER TABLE "place_names" DROP CONSTRAINT IF EXISTS "place_names_place_code_fkey";',
  'ALTER TABLE "place_names" ADD CONSTRAINT "place_names_place_code_fkey" FOREIGN KEY ("place_code") REFERENCES "places"("code") ON DELETE CASCADE ON UPDATE CASCADE;',
  '',
  '-- Dati',
  'TRUNCATE "places" CASCADE;',
  '',
  ...chunks(places).map(
    (c) =>
      `INSERT INTO "places" ("code", "name", "province_code", "province_name", "region_name", "lat", "lng", "area_km2") VALUES\n${c.join(',\n')};\n`
  ),
  ...chunks(names, 1000).map(
    (c) => `INSERT INTO "place_names" ("place_code", "name_norm") VALUES\n${c.join(',\n')};\n`
  ),
].join('\n');

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'migration.sql'), out);
console.log(`${places.length} comuni, ${names.length} nomi -> ${join(outDir, 'migration.sql')}`);
