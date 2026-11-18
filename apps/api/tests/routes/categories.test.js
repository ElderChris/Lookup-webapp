// =============================================================================
// tests/routes/categories.test.js (Fase 1g.2)
// =============================================================================
// Test per il nuovo endpoint GET /api/categories.
// 3 scenari minimi: shape della risposta, ordinamento, idempotenza.
// =============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestApp } from '../helpers.mjs';

describe('GET /api/categories', () => {
  let app;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  it('ritorna 200 con una lista non vuota di categorie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    // Il seed crea 15 categorie BISAC
    expect(body.data.length).toBeGreaterThanOrEqual(10);
  });

  it('ogni categoria ha id, name, slug (description opzionale)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories' });
    const body = res.json();
    for (const cat of body.data) {
      expect(cat).toHaveProperty('id');
      expect(typeof cat.id).toBe('number');
      expect(cat).toHaveProperty('name');
      expect(typeof cat.name).toBe('string');
      expect(cat).toHaveProperty('slug');
      expect(typeof cat.slug).toBe('string');
      // description puo' essere null o stringa
      expect(['string', 'object']).toContain(typeof cat.description);
    }
  });

  it('le categorie sono ordinate per name asc', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories' });
    const names = res.json().data.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'it'));
    expect(names).toEqual(sorted);
  });

  it('endpoint pubblico (no auth richiesto)', async () => {
    // Nessun header X-Lookup-User-Id, deve comunque ritornare 200
    const res = await app.inject({ method: 'GET', url: '/api/categories' });
    expect(res.statusCode).toBe(200);
  });
});
