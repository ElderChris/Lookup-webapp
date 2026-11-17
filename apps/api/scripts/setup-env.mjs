// =============================================================================
// apps/api/scripts/setup-env.mjs
// =============================================================================
// Eseguito dal `postinstall` di apps/api/package.json.
//
// Se manca apps/api/.env, lo crea copiando apps/api/.env.example. Utile
// quando si scarica un nuovo ZIP del progetto in una cartella pulita:
// senza questo, ogni nuova versione richiederebbe `copy .env.example .env`
// a mano prima del primo `npm run dev`.
//
// Idempotente: se .env esiste già, non fa nulla (non sovrascrive).
// Non-blocking: se .env.example non esiste, logga warning ma exit 0.
// =============================================================================

import { existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Risolve i path relativi alla cartella apps/api/ (parent di scripts/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(API_ROOT, '.env');
const ENV_EXAMPLE_PATH = path.join(API_ROOT, '.env.example');

if (existsSync(ENV_PATH)) {
  // .env già presente, nessuna azione
  process.exit(0);
}

if (!existsSync(ENV_EXAMPLE_PATH)) {
  console.warn('[setup-env] .env.example non trovato, salto creazione di .env.');
  console.warn('            Crea apps/api/.env manualmente con almeno DATABASE_URL.');
  process.exit(0);
}

try {
  copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
  console.log('[setup-env] Creato apps/api/.env dal template (.env.example).');
  console.log('            Modifica i valori se necessario prima di avviare il backend.');
} catch (err) {
  console.warn('[setup-env] Errore creazione .env:', err.message);
  process.exit(0); // non-blocking
}
