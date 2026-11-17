// =============================================================================
// tests/routes/stats.test.js
// =============================================================================

import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp, createTestPrisma } from '../helpers.mjs';

const prisma = createTestPrisma();
afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/stats/featured', () => {
  it('ritorna lista libri con score e windowDays', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/stats/featured' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('windowDays');
    expect(body.windowDays).toBe(7); // default
    expect(body.data).toBeInstanceOf(Array);
    for (const item of body.data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('metrics');
      expect(item.metrics).toHaveProperty('score');
      expect(item.metrics).toHaveProperty('loanCount');
      expect(item.metrics).toHaveProperty('likeCount');
      expect(item.metrics).toHaveProperty('viewCount');
    }
  });

  it('rispetta limit', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/stats/featured?limit=3',
    });
    expect(res.json().data.length).toBeLessThanOrEqual(3);
  });

  it('windowDays customizzato', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/stats/featured?days=30',
    });
    expect(res.json().windowDays).toBe(30);
  });
});

describe('GET /api/stats/ridgeline', () => {
  it('ritorna struttura {weekLabels, data}', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/stats/ridgeline' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.weekLabels).toBeInstanceOf(Array);
    expect(body.weekLabels.length).toBe(8); // default
    expect(body.data).toBeInstanceOf(Array);
  });

  it('weekLabels formato ISO YYYY-Www', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/stats/ridgeline?weeks=4' });
    const body = res.json();
    expect(body.weekLabels.length).toBe(4);
    for (const w of body.weekLabels) {
      expect(w).toMatch(/^\d{4}-W\d{2}$/);
    }
  });
});

describe('GET /api/stats/top-users', () => {
  it('ritorna lista con metrics composite', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/stats/top-users' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    for (const u of body.data) {
      expect(u).toHaveProperty('id');
      expect(u.metrics).toMatchObject({
        loanCount: expect.any(Number),
        reviewCount: expect.any(Number),
        postCount: expect.any(Number),
        avgRating: expect.any(Number),
        score: expect.any(Number),
      });
    }
  });

  it('ordina per score desc', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/stats/top-users' });
    const scores = res.json().data.map((u) => u.metrics.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});

describe('GET /api/stats/bisac-cooccurrence', () => {
  it('ritorna coppie a/b/count ordinate desc', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/stats/bisac-cooccurrence' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('minCount');
    expect(body.data).toBeInstanceOf(Array);
    for (const pair of body.data) {
      expect(pair.a).toHaveProperty('id');
      expect(pair.a).toHaveProperty('name');
      expect(pair.b).toHaveProperty('id');
      expect(pair.count).toBeGreaterThanOrEqual(body.minCount);
    }
  });
});

describe('GET /api/books/nearby (PostGIS)', () => {
  it('ritorna libri con distanceMeters ordinati ASC', async () => {
    const app = await buildTestApp();
    // Centro Napoli
    const res = await app.inject({
      method: 'GET',
      url: '/api/books/nearby?lat=40.8358&lng=14.2351&radius=2000',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.center).toEqual({ lat: 40.8358, lng: 14.2351 });
    expect(body.radius).toBe(2000);
    expect(body.data.length).toBeGreaterThan(0);
    for (const b of body.data) {
      expect(b.distanceMeters).toBeGreaterThanOrEqual(0);
      expect(b.distanceMeters).toBeLessThanOrEqual(2000);
    }
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i].distanceMeters).toBeGreaterThanOrEqual(body.data[i - 1].distanceMeters);
    }
  });

  it('raggio piccolissimo: 0 risultati', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/books/nearby?lat=0&lng=0&radius=100',
    });
    expect(res.json().data.length).toBe(0);
  });
});
