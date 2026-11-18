// =============================================================================
// tests/routes/health.test.js
// =============================================================================

import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp, closeTestApp } from '../helpers.mjs';

describe('GET /api/health', () => {
  afterAll(closeTestApp);

  it('ritorna 200 con stato ok', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(body.redis).toBe('ok');
    expect(body.version).toBeTypeOf('string');
    expect(body.uptime).toBeTypeOf('number');
  });
});

describe('GET /api/ping', () => {
  it('ritorna {pong: true}', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pong: true });
  });
});
