// =============================================================================
// src/server.js
// =============================================================================
// Entry point del backend Lookup. Costruisce l'app Fastify e mette in
// listen sulla porta configurata. Gestisce signal SIGTERM/SIGINT per
// shutdown pulito (drain connessioni, disconnetti Prisma+Redis).
//
// Avvio:
//   node --env-file=.env src/server.js              (production)
//   node --watch --env-file=.env src/server.js      (development, auto-reload)
//
// In docker-compose, le env vars arrivano dal blocco `environment:` quindi
// `--env-file` non è necessario (basta `node src/server.js`).
// =============================================================================

import { buildApp } from './app.js';
import { config } from './config.js';

const app = await buildApp();

// --- Listen ---
try {
  await app.listen({
    host: config.server.host,
    port: config.server.port,
  });
  app.log.info(
    `Lookup API attivo: http://localhost:${config.server.port}/api/health  (env=${config.env})`
  );
} catch (err) {
  app.log.fatal({ err }, 'avvio fallito');
  process.exit(1);
}

// --- Graceful shutdown su SIGTERM (docker stop) e SIGINT (Ctrl+C) ---
const shutdown = async (signal) => {
  app.log.info({ signal }, 'segnale ricevuto, shutdown in corso');
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'errore durante shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Uncaught errors: log e exit (Node 20 non li sopprime più)
process.on('uncaughtException', (err) => {
  app.log.fatal({ err }, 'uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  app.log.fatal({ reason }, 'unhandled rejection');
  process.exit(1);
});
