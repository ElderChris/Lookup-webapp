// =============================================================================
// tests/routes/bookSearch.test.js
// =============================================================================
// Ricerca di Esplora (lib/bookSearch.js): ISBN, accenti, errori di battitura,
// testo + comune.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { buildTestApp } from '../helpers.mjs';
import { foldText, isbnCandidates, splitTextPlace } from '../../src/lib/bookSearch.js';

async function search(app, query) {
  const res = await app.inject({ method: 'GET', url: `/api/books?${new URLSearchParams(query)}` });
  expect(res.statusCode).toBe(200);
  return res.json();
}
const titles = (body) => body.data.map((b) => b.title);

describe('funzioni della ricerca', () => {
  it('toglie accenti e maiuscole', () => {
    expect(foldText('Città')).toBe('citta');
    expect(foldText('I Viceré')).toBe('i vicere');
  });

  it("riconosce un ISBN in ogni forma e ne calcola l'equivalente", () => {
    expect(isbnCandidates('9788807900037')).toEqual(['9788807900037', '8807900033']);
    expect(isbnCandidates('978-88-07-90003-7')).toEqual(['9788807900037', '8807900033']);
    expect(isbnCandidates('88 07 90003 3')).toEqual(['8807900033', '9788807900037']);
    expect(isbnCandidates('1984')).toEqual([]);
    expect(isbnCandidates('Gattopardo')).toEqual([]);
  });

  it('divide testo e luogo, togliendo le parole di collegamento', () => {
    expect(splitTextPlace('Saviano Pozzuoli')).toEqual([{ text: 'Saviano', place: 'Pozzuoli' }]);
    expect(splitTextPlace('Calvino, Napoli')).toEqual([{ text: 'Calvino', place: 'Napoli' }]);
    expect(splitTextPlace('Camilleri a Napoli')).toContainEqual({
      text: 'Camilleri',
      place: 'Napoli',
    });
    expect(splitTextPlace('Gomorra vicino a Pozzuoli (NA)')).toContainEqual({
      text: 'Gomorra',
      place: 'Pozzuoli (NA)',
    });
    expect(splitTextPlace('Napoli')).toEqual([]);
  });
});

describe('GET /api/books: cosa trova la ricerca', () => {
  it('ISBN con e senza trattini, anche nella forma a 10 cifre', async () => {
    const app = await buildTestApp();
    for (const q of ['9788807900037', '978-88-07-90003-7', '8807900033']) {
      expect(titles(await search(app, { q }))).toEqual(['Il Gattopardo']);
    }
  });

  it('senza distinguere gli accenti, anche nel luogo del proprietario', async () => {
    const app = await buildTestApp();
    expect(titles(await search(app, { q: 'citta invisibili' }))).toContain('Le città invisibili');
    // "Sanita": le librerie del Rione Sanità, non solo il titolo
    const sanita = await search(app, { q: 'Sanita' });
    expect(sanita.data.map((b) => b.owner.city)).toContain('Napoli, Rione Sanità');
    expect(titles(sanita)).toContain("L'arte della gioia");
  });

  it('errori di battitura sui nomi lunghi senza scambiare autori simili', async () => {
    const app = await buildTestApp();
    expect(titles(await search(app, { q: 'Camillieri' }))).toContain('Il commissario Montalbano');
    // "Montalbano" non e' "Montale"
    expect(titles(await search(app, { q: 'Montalbano' }))).not.toContain('Ossi di seppia');
  });

  it("CAP e indirizzo degli enti, quartiere della citta' pubblica", async () => {
    const app = await buildTestApp();
    expect(titles(await search(app, { q: '80136' }))).toContain("L'arte della gioia");
    expect(titles(await search(app, { q: 'Via Sanità' }))).toContain("L'arte della gioia");
    expect(titles(await search(app, { q: 'Chiaia' }))).toContain('Il Gattopardo');
  });
});

describe('GET /api/books: testo e comune insieme', () => {
  it('"Saviano Pozzuoli": i volumi di Saviano per distanza da Pozzuoli', async () => {
    const app = await buildTestApp();
    const body = await search(app, { q: 'Saviano Pozzuoli' });
    expect(body.place).toMatchObject({ name: 'Pozzuoli', text: 'Saviano' });
    expect(titles(body)).toEqual(['Gomorra']);
    expect(body.data[0].distanceMeters).toBeGreaterThan(0);
  });

  it('"Camilleri a Napoli" e "Calvino, Napoli"', async () => {
    const app = await buildTestApp();
    const cam = await search(app, { q: 'Camilleri a Napoli' });
    expect(cam.place).toMatchObject({ name: 'Napoli', text: 'Camilleri' });
    expect(cam.data.every((b) => b.author === 'Andrea Camilleri')).toBe(true);
    const cal = await search(app, { q: 'Calvino, Napoli' });
    expect(titles(cal)).toEqual(['Le città invisibili']);
  });

  it('un titolo che contiene un comune resta un titolo', async () => {
    const app = await buildTestApp();
    const body = await search(app, { q: 'Storia di Napoli' });
    expect(body.place).toBeNull();
    expect(titles(body)).toEqual(['Storia di Napoli']);
  });

  it('con il raggio, solo i volumi entro la distanza dal comune', async () => {
    const app = await buildTestApp();
    const near = await search(app, { q: 'Saviano Napoli', radius: 3000 });
    expect(titles(near)).toEqual(['Gomorra']);
    const far = await search(app, { q: 'Saviano Pozzuoli', radius: 3000 });
    expect(far.data).toEqual([]);
  });

  it('place=false: nessun comune, solo testo', async () => {
    const app = await buildTestApp();
    const body = await search(app, { q: 'Saviano Pozzuoli', place: 'false' });
    expect(body.place).toBeNull();
    expect(body.data).toEqual([]);
  });
});
