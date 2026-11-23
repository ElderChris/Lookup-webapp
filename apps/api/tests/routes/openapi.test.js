// =============================================================================
// tests/routes/openapi.test.js
// =============================================================================
// Verifica che gli endpoint di documentazione (OpenAPI spec + Swagger UI)
// siano registrati correttamente da @fastify/swagger e @fastify/swagger-ui.
// =============================================================================

import { readFileSync } from 'node:fs';
import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp, closeTestApp } from '../helpers.mjs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

describe('OpenAPI documentation', () => {
  afterAll(closeTestApp);

  it('GET /api/docs/json restituisce spec OpenAPI 3.1 valida', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });

    expect(res.statusCode).toBe(200);
    const spec = res.json();

    expect(spec.openapi).toMatch(/^3\.[01]/); // 3.0.x o 3.1.x
    expect(spec.info.title).toBe('Lookup API');
    expect(spec.info.version).toBe(pkg.version); // allineata a apps/api/package.json
    expect(spec.tags).toBeInstanceOf(Array);
    expect(spec.tags.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'Health',
        'Books',
        'Users',
        'Loans',
        'Posts',
        'Notifications',
        'Stats',
      ])
    );
  });

  it('La spec include i 44 endpoint REST attesi', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = res.json();

    // Conta gli operationId (un per path × method)
    let totalOps = 0;
    for (const path of Object.values(spec.paths || {})) {
      for (const op of ['get', 'post', 'put', 'patch', 'delete']) {
        if (path[op]) totalOps += 1;
      }
    }
    // 44 endpoint REST + qualche Swagger UI ausiliario
    expect(totalOps).toBeGreaterThanOrEqual(44);
  });

  it('Ogni endpoint /api/* ha almeno un tag', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = res.json();

    for (const [path, methods] of Object.entries(spec.paths || {})) {
      if (!path.startsWith('/api/')) continue;
      // Skip endpoint documentari (/api/docs/*)
      if (path.startsWith('/api/docs')) continue;
      for (const [method, op] of Object.entries(methods)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        expect(op.tags, `${method.toUpperCase()} ${path} senza tag`).toBeDefined();
        expect(op.tags.length).toBeGreaterThan(0);
      }
    }
  });

  it('GET /api/docs serve Swagger UI HTML (seguendo eventuali redirect)', async () => {
    const app = await buildTestApp();

    // @fastify/swagger-ui v5 puo' servire l'HTML a path diversi a seconda
    // della versione e potrebbe fare 1-2 redirect intermedi. Seguiamo i
    // redirect manualmente (app.inject() non li segue di default), fino a
    // un massimo di 3 hop per evitare loop infiniti.
    let res = await app.inject({ method: 'GET', url: '/api/docs/' });
    let hops = 0;
    while ((res.statusCode === 301 || res.statusCode === 302) && hops < 3) {
      const location = res.headers.location;
      expect(location, `redirect senza Location dopo ${hops} hop`).toBeDefined();
      // Se il Location e' assoluto (http://...), estraiamo solo il pathname
      const url = location.startsWith('http')
        ? new URL(location).pathname + new URL(location).search
        : location;
      res = await app.inject({ method: 'GET', url });
      hops += 1;
    }

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    // Il body deve contenere riferimenti a Swagger (case-insensitive)
    expect(res.body.toLowerCase()).toContain('swagger');
  });

  it('La spec descrive la sessione come cookie di Better Auth', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = res.json();

    const scheme = spec.components?.securitySchemes?.sessionCookie;
    expect(scheme).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'better-auth.session_token',
    });
    expect(JSON.stringify(spec)).not.toMatch(/X-Lookup-User-Id|lucia/i);
  });
});
