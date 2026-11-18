// =============================================================================
// src/config.js
// =============================================================================
// Configurazione centralizzata. Legge process.env (caricato via Node 20+
// --env-file=.env) e valida le variabili critiche al boot. Se una variabile
// obbligatoria manca, il processo esce con errore esplicito invece di
// fallire in modo opaco a runtime.
// =============================================================================

const REQUIRED = ['DATABASE_URL'];
const OPTIONAL = {
  NODE_ENV: 'development',
  API_PORT: '3000',
  API_HOST: '0.0.0.0',
  REDIS_URL: 'redis://localhost:6379',
  LOG_LEVEL: 'info',
  CORS_ORIGINS: 'http://localhost:8080,http://localhost:8765', // CSV
};

// Validazione: variabili obbligatorie devono esistere
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ Avvio fallito: variabili ambiente obbligatorie mancanti:');
  missing.forEach((k) => console.error(`     - ${k}`));
  console.error('');
  console.error('   Controlla apps/api/.env. Se non esiste:');
  console.error('     cd apps/api && cp .env.example .env');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1);
}

// Merge: default + overrides da env
const env = { ...OPTIONAL };
for (const k of Object.keys(OPTIONAL)) {
  if (process.env[k]) env[k] = process.env[k];
}
for (const k of REQUIRED) {
  env[k] = process.env[k];
}

// Parsing tipizzato
export const config = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    host: env.API_HOST,
    port: parseInt(env.API_PORT, 10),
  },

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    url: env.REDIS_URL,
  },

  logger: {
    level: env.LOG_LEVEL,
  },

  cors: {
    origins: env.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
};
