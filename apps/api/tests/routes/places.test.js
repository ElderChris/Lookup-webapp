// =============================================================================
// tests/routes/places.test.js
// =============================================================================
// Ricerca per luogo: il testo cercato e' un comune italiano (tabelle
// places/place_names caricate dalla migrazione 20261125150000_places) e i
// volumi vengono ordinati per distanza dal centro del comune.
// =============================================================================

import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp, createTestPrisma } from '../helpers.mjs';
import { resolvePlace, parsePlaceQuery, levenshtein } from '../../src/lib/places.js';
import { normalizePlaceName } from '../../src/lib/placeName.js';

const prisma = createTestPrisma();
afterAll(async () => {
  await prisma.$disconnect();
});

async function search(app, query) {
  const res = await app.inject({ method: 'GET', url: `/api/books?${new URLSearchParams(query)}` });
  expect(res.statusCode).toBe(200);
  return res.json();
}

/** Distanze non decrescenti (null in fondo) */
function isSortedByDistance(books) {
  const d = books.map((b) => (b.distanceMeters == null ? Infinity : b.distanceMeters));
  return d.every((v, i) => i === 0 || d[i - 1] <= v);
}

describe('nomi di luogo', () => {
  it('normalizza accenti, apostrofi e trattini', () => {
    expect(normalizePlaceName("Reggio nell'Emilia")).toBe('reggio nell emilia');
    expect(normalizePlaceName('  Forlì ')).toBe('forli');
    expect(normalizePlaceName('Bolzano/Bozen')).toBe('bolzano bozen');
    expect(normalizePlaceName('Gressoney-La-Trinité')).toBe('gressoney la trinite');
  });

  it('riconosce provincia e regione dopo il nome', () => {
    expect(parsePlaceQuery('Napoli (NA)')[0]).toEqual({ name: 'napoli', province: 'NA' });
    expect(parsePlaceQuery('Napoli, NA')[0]).toEqual({ name: 'napoli', province: 'NA' });
    expect(parsePlaceQuery('Castro, Bergamo')[0]).toEqual({ name: 'castro', area: 'bergamo' });
    expect(parsePlaceQuery('Napoli')).toEqual([{ name: 'napoli' }]);
  });

  it('distanza di Levenshtein', () => {
    expect(levenshtein('napli', 'napoli')).toBe(1);
    expect(levenshtein('roma', 'roma')).toBe(0);
    expect(levenshtein('pavia', 'pavese')).toBe(3);
  });
});

describe('resolvePlace', () => {
  it("trova i comuni per nome, anche bilingue o d'uso comune", async () => {
    expect((await resolvePlace(prisma, 'Napoli')).provinceCode).toBe('NA');
    expect((await resolvePlace(prisma, 'napoli')).match).toBe('exact');
    expect((await resolvePlace(prisma, 'Bozen')).name).toBe('Bolzano/Bozen');
    expect((await resolvePlace(prisma, 'Reggio Calabria')).provinceCode).toBe('RC');
    expect((await resolvePlace(prisma, 'Forli')).name).toBe('Forlì');
  });

  it('con comuni omonimi usa la provincia indicata', async () => {
    expect((await resolvePlace(prisma, 'Castro (BG)')).provinceCode).toBe('BG');
    expect((await resolvePlace(prisma, 'Castro, Lecce')).provinceCode).toBe('LE');
    expect((await resolvePlace(prisma, 'Castro')).name).toBe('Castro');
  });

  it('tollera piccoli errori di battitura solo se consentito', async () => {
    const fuzzy = await resolvePlace(prisma, 'Napli');
    expect(fuzzy).toMatchObject({ name: 'Napoli', match: 'fuzzy' });
    expect(await resolvePlace(prisma, 'Napli', { allowFuzzy: false })).toBeNull();
    expect((await resolvePlace(prisma, 'Pozzuolli')).name).toBe('Pozzuoli');
  });

  it('non scambia per luoghi parole che non lo sono', async () => {
    expect(await resolvePlace(prisma, 'Calvino')).toBeNull();
    expect(await resolvePlace(prisma, 'Il Gattopardo')).toBeNull();
    expect(await resolvePlace(prisma, 'zzzqqq')).toBeNull();
  });
});

describe('GET /api/books con un luogo', () => {
  it('"Napoli": librerie in ordine di distanza dal centro del comune', async () => {
    const app = await buildTestApp();
    const body = await search(app, { q: 'Napoli', limit: 100 });
    expect(body.place).toMatchObject({ name: 'Napoli', provinceCode: 'NA', match: 'exact' });
    // Anche i comuni vicini (Portici, Pozzuoli), non solo chi ha "Napoli" nel testo
    const cities = body.data.map((b) => b.owner.city);
    expect(cities).toContain('Portici');
    expect(cities).toContain('Pozzuoli');
    // Prima i titoli che contengono il testo, poi le altre librerie per distanza
    const titled = body.data.filter((b) => /napoli/i.test(b.title));
    expect(body.data.slice(0, titled.length)).toEqual(titled);
    expect(isSortedByDistance(body.data.slice(titled.length))).toBe(true);
    expect(body.data.every((b) => typeof b.distanceMeters === 'number')).toBe(true);
  });

  it('"Pozzuoli (NA)": le librerie di Pozzuoli vengono prima', async () => {
    const app = await buildTestApp();
    const body = await search(app, { q: 'Pozzuoli (NA)' });
    expect(body.place.name).toBe('Pozzuoli');
    expect(body.data[0].owner.city).toBe('Pozzuoli');
    expect(isSortedByDistance(body.data)).toBe(true);
  });

  it('con il raggio, le distanze si misurano dal centro del comune', async () => {
    const app = await buildTestApp();
    // lat/lng dell'utente (Bari) ignorati: vale il centro di Napoli
    const body = await search(app, { q: 'Napoli', radius: 3000, lat: 41.12, lng: 16.87 });
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((b) => b.distanceMeters <= 3000)).toBe(true);
    expect(body.data.map((b) => b.owner.city)).not.toContain('Pozzuoli');
  });

  it('place=false cerca solo il testo', async () => {
    const app = await buildTestApp();
    const body = await search(app, { q: 'Napoli', place: 'false' });
    expect(body.place).toBeNull();
    expect(body.data.map((b) => b.owner.city)).not.toContain('Portici');
  });

  it('un titolo o un autore non diventa un luogo', async () => {
    const app = await buildTestApp();
    const body = await search(app, { q: 'Calvino' });
    expect(body.place).toBeNull();
    expect(body.data.map((b) => b.title)).toContain('Le città invisibili');
  });

  it('un ordinamento esplicito vince sulla distanza', async () => {
    const app = await buildTestApp();
    const body = await search(app, { q: 'Napoli', sort: 'title', limit: 100 });
    const titles = body.data.map((b) => b.title);
    // Ordine del database (collation C): come il confronto di stringhe JS
    expect(titles).toEqual([...titles].sort());
    expect(body.data[0]).not.toHaveProperty('distanceMeters');
  });

  it('pagine consecutive senza duplicati', async () => {
    const app = await buildTestApp();
    const p1 = await search(app, { q: 'Napoli', limit: 5, offset: 0 });
    const p2 = await search(app, { q: 'Napoli', limit: 5, offset: 5 });
    const ids = [...p1.data, ...p2.data].map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(p1.pagination.total).toBe(p2.pagination.total);
  });
});
