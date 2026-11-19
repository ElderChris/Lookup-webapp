// =============================================================================
// src/lib/authFastify.js — Fastify plugin per Better Auth
// =============================================================================
// Better Auth espone un unico handler `auth.handler(request: Request)`
// che gestisce tutte le route /api/auth/* (sign-up, sign-in, sign-out,
// request-password-reset, reset-password, verify-email, get-session, ecc.).
//
// Il handler accetta e ritorna oggetti Web API standard (Request/Response).
// Questo plugin fa il bridge Fastify ↔ Web API:
//   - Fastify request → costruisce Request Web API
//   - auth.handler(request) → Response Web API
//   - Response → Fastify reply (status, headers, body)
//
// Route registrate: ALL /api/auth/* (metodo GET/POST/DELETE/OPTIONS).
// =============================================================================

import fp from 'fastify-plugin';
import { auth } from './auth.js';

async function authPlugin(fastify) {
  // Handler unico per tutti i metodi + wildcard path
  fastify.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    url: '/api/auth/*',
    // Skip schema validation: Better Auth gestisce internamente il body
    schema: { hide: true },
    async handler(request, reply) {
      try {
        // 1. Costruisci Web API Request da Fastify request
        const protocol = request.headers['x-forwarded-proto'] || request.protocol || 'http';
        const host = request.headers.host || 'localhost:3000';
        const url = new URL(request.url, `${protocol}://${host}`);

        // Copia headers preservando cookie/authorization
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else if (typeof value === 'string') {
            headers.set(key, value);
          }
        }

        // Body: per GET/HEAD niente, altrimenti serializza
        let body;
        if (!['GET', 'HEAD'].includes(request.method)) {
          if (request.body && typeof request.body === 'object') {
            body = JSON.stringify(request.body);
            headers.set('content-type', 'application/json');
          } else if (typeof request.body === 'string') {
            body = request.body;
          }
        }

        const webRequest = new Request(url, {
          method: request.method,
          headers,
          body,
        });

        // 2. Delega a Better Auth
        const webResponse = await auth.handler(webRequest);

        // 3. Trascrivi Response → Fastify reply
        reply.status(webResponse.status);
        webResponse.headers.forEach((value, key) => {
          // Cookie: usa setCookie per gestire i multipli set-cookie correttamente
          if (key.toLowerCase() === 'set-cookie') {
            reply.header('set-cookie', value);
          } else {
            reply.header(key, value);
          }
        });

        const responseBody = webResponse.body ? await webResponse.text() : null;
        return reply.send(responseBody);
      } catch (err) {
        fastify.log.error({ err }, '[auth] handler error');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Auth handler failed',
          },
        });
      }
    },
  });

  fastify.log.info('[auth] Better Auth handler mounted on /api/auth/*');
}

export default fp(authPlugin, {
  name: 'lookup-auth',
  fastify: '5.x',
});
