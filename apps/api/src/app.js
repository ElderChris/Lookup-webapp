// =============================================================================
// src/app.js
// =============================================================================
// Factory che costruisce e configura l'istanza Fastify. Separata da
// server.js per essere facilmente testabile (in 1h: build app senza listen,
// fai inject di richieste con supertest, asserisci response).
//
// Responsabilità:
//   1. Crea Fastify con logger
//   2. Aggancia Prisma e Redis come decorator
//   3. Registra plugin di sicurezza (helmet, cors)
//   4. Registra error handler + 404 handler
//   5. Registra tutte le route via routes/index.js
//   6. Hook onClose per disconnessione pulita
// =============================================================================

import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { config } from './config.js';
import { loggerConfig } from './lib/logger.js';
import { prisma, attachPrismaLogging } from './lib/prisma.js';
import { redis, attachRedisLogging } from './lib/redis.js';
import { errorHandler, notFoundHandler } from './lib/errorHandler.js';
import routes from './routes/index.js';
import authPlugin from './lib/authFastify.js';

export async function buildApp(opts = {}) {
  const fastify = Fastify({
    logger: loggerConfig,
    trustProxy: true, // utile dietro reverse-proxy (nginx, traefik)
    bodyLimit: 1024 * 1024 * 5, // 5MB max (per upload immagini base64 in v1)
    ...opts,
  });

  // --- Decorator: prisma + redis disponibili come fastify.prisma / .redis ---
  fastify.decorate('prisma', prisma);
  fastify.decorate('redis', redis);

  attachPrismaLogging(prisma, fastify.log);
  attachRedisLogging(redis, fastify.log);

  // --- Sicurezza ---
  await fastify.register(helmet, {
    // Permettiamo inline styles per ora (il frontend usa qualche style inline);
    // in produzione vincolare con CSP più stretto.
    contentSecurityPolicy: false,
  });

  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow no-origin (curl, server-to-server) e localhost
      if (!origin) return callback(null, true);
      if (config.cors.origins.includes(origin)) return callback(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} non permessa`), false);
    },
    credentials: true, // per session cookie (Fase 3)
    // Da @fastify/cors 11 il default e' solo GET,HEAD,POST: senza questa
    // riga le preflight di PUT/PATCH/DELETE da un'origine diversa
    // (frontend di sviluppo su :8765) verrebbero rifiutate.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // --- Rate limit globale (Beta 5) ---
  // Limita le richieste per IP per proteggere il backend da abusi e
  // scraping. In produzione si consiglia Redis come store per distribuire
  // il conteggio tra piu' istanze (workerId nel bucket).
  //
  // Better Auth ha il suo rate limit interno per /api/auth/* (vedi auth.js);
  // qui applichiamo un limite piu' generoso al resto delle route business.
  //
  // Skip nei test per evitare flaky su suite parallele.
  if (process.env.NODE_ENV !== 'test') {
    await fastify.register(rateLimit, {
      global: true,
      max: 300, // 300 richieste ogni finestra
      timeWindow: '1 minute', // per IP
      // Escludi endpoint di health per non falsare monitoring
      skipOnError: true, // se Redis giu', non bloccare (fail open)
      allowList: (req) => {
        const path = req.url || '';
        return (
          path.startsWith('/api/health') || path === '/api/ping' || path.startsWith('/api/docs')
        );
      },
      errorResponseBuilder: (req, context) => ({
        error: {
          code: 'RATE_LIMITED',
          message: `Troppi tentativi. Riprova tra ${Math.ceil(context.ttl / 1000)}s.`,
        },
        statusCode: 429,
      }),
    });
  }

  // --- Content-Type parser tollerante per body vuoti ---
  // Molti endpoint POST/PATCH/DELETE non richiedono body (es. /like, /follow,
  // /views, /read-all). Sostituiamo il parser JSON default con uno che
  // accetta body vuoti (senza Content-Type esplicito da parte del client).
  // Risolve l'errore FST_ERR_CTP_INVALID_MEDIA_TYPE per richieste vuote.
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (!body || body.trim() === '') {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });
  // Accetta anche richieste senza Content-Type (es. PowerShell Invoke-RestMethod
  // su POST senza -Body): trattate come body vuoto.
  fastify.addContentTypeParser('*', (req, payload, done) => {
    done(null, undefined);
  });

  // --- Error handlers ---
  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler(notFoundHandler);

  // --- OpenAPI doc (Fase 1g) ---
  // @fastify/swagger legge automaticamente i JSON Schema attaccati ad ogni route
  // (params/querystring/body/response) e genera una spec OpenAPI 3.1.
  // Ogni endpoint puo' arricchirla con schema.tags + schema.summary +
  // schema.description (vedi src/routes/*.js).
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Lookup API',
        description:
          'API REST per Lookup, piattaforma peer-to-peer di condivisione libri ' +
          'ambientata a Napoli. 44 endpoint su 7 domini: books, users, loans, ' +
          'posts, notifications, stats, geo (PostGIS).',
        version: '3.0.0-beta.10',
        license: { name: 'GPL-3.0', url: 'https://www.gnu.org/licenses/gpl-3.0.html' },
      },
      servers: [{ url: 'http://localhost:3000', description: 'Sviluppo locale' }],
      tags: [
        { name: 'Health', description: 'Health check e ping' },
        {
          name: 'Auth',
          description:
            'Autenticazione (Better Auth): sign-up, sign-in, sign-out, verify-email, reset-password, get-session',
        },
        { name: 'Books', description: 'Catalogo libri (CRUD + filtri + like + views + nearby)' },
        { name: 'Categories', description: 'Categorie BISAC (lista flat per dropdown UI)' },
        { name: 'Users', description: 'Profili utenti + reviews + follows' },
        { name: 'Loans', description: 'Richieste di prestito + state machine + messaggi' },
        { name: 'Posts', description: 'Micro-blog + reactions + reports' },
        { name: 'Notifications', description: 'Notifiche personali (cross-cutting emission)' },
        {
          name: 'Stats',
          description: 'Aggregazioni statistiche (featured, ridgeline, top, BISAC)',
        },
      ],
      components: {
        securitySchemes: {
          // In alpha: header X-Lookup-User-Id (dev stub). In Fase 3 sara' session cookie via lucia-auth.
          devAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Lookup-User-Id',
            description:
              "Auth dev stub: passa l'ID intero dell'utente (es. \"1\") nell'header per simulare login. " +
              "In produzione (Fase 3) sara' sostituito da session cookie lucia-auth.",
          },
        },
      },
    },
  });

  // Swagger UI: interfaccia interattiva a /api/docs (utile per esplorare gli endpoint)
  await fastify.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list', // 'none' | 'list' | 'full'
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
  });

  // --- Beta 10: HTTP metrics hook ---
  // Registra latency e count di ogni request. Il routerPath e' il template
  // ("/api/books/:id"), non l'URL istanziato ("/api/books/42"), cosi' evitiamo
  // esplosione di cardinality nelle metriche Prometheus.
  //
  // Skip su /metrics stesso per non avvelenare il rate (self-scraping infinito).
  const metricsEnabled = process.env.METRICS_ENABLED !== 'false';
  if (metricsEnabled) {
    const { httpDuration, httpRequests } = await import('./lib/metrics.js');
    fastify.addHook('onResponse', (request, reply, done) => {
      const url = request.raw.url || '';
      if (url.startsWith('/metrics')) {
        done();
        return;
      }
      const route = request.routeOptions?.url || request.routerPath || 'unknown';
      const method = request.method || 'UNKNOWN';
      const status = String(reply.statusCode);
      const seconds = reply.elapsedTime / 1000; // ms → s (getResponseTime non esiste in Fastify 5)
      httpDuration.labels(method, route, status).observe(seconds);
      httpRequests.labels(method, route, status).inc();
      done();
    });
  }

  // --- Auto-tagging OpenAPI ---
  // Invece di modificare 44 route handler aggiungendo manualmente schema.tags,
  // un hook onRoute classifica automaticamente ogni endpoint in base al path URL.
  // Permette anche di settare un summary di default (method + url) se mancante.
  fastify.addHook('onRoute', (routeOpts) => {
    if (!routeOpts.schema) routeOpts.schema = {};
    if (!routeOpts.schema.tags || routeOpts.schema.tags.length === 0) {
      const url = routeOpts.url || '';
      if (url.startsWith('/api/health') || url === '/api/ping') {
        routeOpts.schema.tags = ['Health'];
      } else if (url.startsWith('/api/books')) {
        routeOpts.schema.tags = ['Books'];
      } else if (url.startsWith('/api/categories')) {
        routeOpts.schema.tags = ['Categories'];
      } else if (url.startsWith('/api/me/notifications')) {
        routeOpts.schema.tags = ['Notifications'];
      } else if (url.startsWith('/api/me/loans') || url.startsWith('/api/loans')) {
        routeOpts.schema.tags = ['Loans'];
      } else if (url.startsWith('/api/me') || url.startsWith('/api/users')) {
        routeOpts.schema.tags = ['Users'];
      } else if (url.startsWith('/api/posts')) {
        routeOpts.schema.tags = ['Posts'];
      } else if (url.startsWith('/api/stats')) {
        routeOpts.schema.tags = ['Stats'];
      }
    }
    if (!routeOpts.schema.summary) {
      routeOpts.schema.summary = `${routeOpts.method} ${routeOpts.url}`;
    }
  });

  // --- Better Auth handler mount on /api/auth/* (Fase 3.1) ---
  await fastify.register(authPlugin);

  // --- Routes ---
  await fastify.register(routes);

  // --- Email: controllo della configurazione SMTP all'avvio ---
  // In background, per non rallentare l'avvio: registra host, modalita' TLS,
  // utente e avvisi (es. verifica del certificato disattivata).
  if (process.env.NODE_ENV !== 'test') {
    const { checkSmtp } = await import('./lib/mailer.js');
    void checkSmtp(fastify.log);
  }

  // --- Background jobs (Beta 7) ---
  // Startup dei worker BullMQ + registrazione dei repeat job (overdue-loans,
  // retention). Disabilitato in NODE_ENV=test (i test non hanno bisogno di
  // job async, e ci sarebbero flaky per il worker che gira in background
  // durante l'esecuzione della suite).
  //
  // Se vuoi disabilitare i job anche in dev (es. per debug isolato), setta
  // JOBS_ENABLED=false in .env. Utile per testare gli endpoint senza worker
  // in background.
  const jobsEnabled = process.env.NODE_ENV !== 'test' && process.env.JOBS_ENABLED !== 'false';
  if (jobsEnabled) {
    const { startWorkers, closeWorkers } = await import('./jobs/worker.js');
    const {
      registerRecurringJobs,
      attachQueueEvents,
      closeQueues,
      startQueueSizePolling,
      stopQueueSizePolling,
    } = await import('./jobs/queue.js');
    startWorkers(fastify.log);
    attachQueueEvents(fastify.log);
    await registerRecurringJobs(fastify.log);
    // Beta 10: polling gauge queue size ogni 30s per Prometheus
    if (metricsEnabled) await startQueueSizePolling();
    fastify.decorate('closeJobs', async () => {
      stopQueueSizePolling();
      await closeWorkers();
      await closeQueues();
    });
  }

  // --- Graceful shutdown ---
  fastify.addHook('onClose', async (instance) => {
    instance.log.info('shutting down: disconnecting prisma + redis');
    if (instance.closeJobs) {
      await instance.closeJobs();
    }
    // Beta 8: chiude subscriber SSE + libera canali pub/sub
    const { closeEventBus } = await import('./lib/eventBus.js');
    await closeEventBus();
    await prisma.$disconnect();
    if (redis.status === 'ready' || redis.status === 'connecting') {
      redis.disconnect();
    }
  });

  return fastify;
}
