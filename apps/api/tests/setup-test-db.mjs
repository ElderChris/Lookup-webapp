// =============================================================================
// tests/setup-test-db.mjs
// =============================================================================
// Script standalone per inizializzare il database `lookup_test`:
//   1. Crea il DB se non esiste (via docker exec)
//   2. Installa le estensioni postgis/pg_trgm/citext
//   3. Applica le migrations Prisma
//   4. Esegue il seed
//
// Uso (da apps/api/):
//   npm run test:setup-db
//
// Eseguibile in qualsiasi momento per "resettare" il DB test a uno stato
// pulito. NON tocca il DB `lookup` di sviluppo.
//
// Idempotente: rieseguibile senza errori.
// =============================================================================

import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, '..');

const POSTGRES_CONTAINER = 'lookup-postgres';
const PG_USER = 'lookup';
const PG_PASS = 'lookup_dev';
const TEST_DB = 'lookup_test';
const TEST_URL = `postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${TEST_DB}?schema=public`;

function log(msg) {
  console.log(`[setup-test-db] ${msg}`);
}
function warn(msg) {
  console.warn(`[setup-test-db] ⚠  ${msg}`);
}

function dockerExec(sql, db = 'postgres') {
  const cmd = `docker exec ${POSTGRES_CONTAINER} psql -U ${PG_USER} -d ${db} -tAc "${sql.replace(/"/g, '\\"')}"`;
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch (err) {
    throw new Error(`Docker exec fallito: ${err.message}\nComando: ${cmd}`, { cause: err });
  }
}

// --- 1. Verifica che container postgres sia attivo ---
log('Verifica container postgres...');
try {
  execSync(`docker ps --filter "name=${POSTGRES_CONTAINER}" --format "{{.Names}}"`, {
    stdio: 'pipe',
  });
} catch (err) {
  console.error(`❌ Docker non disponibile: ${err.message}`);
  console.error(`   Avvia con: .\\dev.ps1 db-up  (da root del progetto)`);
  process.exit(1);
}
const running = execSync(`docker ps --filter "name=${POSTGRES_CONTAINER}" --format "{{.Names}}"`)
  .toString()
  .trim();
if (!running.includes(POSTGRES_CONTAINER)) {
  console.error(`❌ Container ${POSTGRES_CONTAINER} non in esecuzione.`);
  console.error(`   Avvia con: .\\dev.ps1 db-up  (da root del progetto)`);
  process.exit(1);
}
log(`✓ Container ${POSTGRES_CONTAINER} attivo.`);

// --- 2. Crea DB lookup_test se non esiste ---
log(`Verifica esistenza database "${TEST_DB}"...`);
const exists = dockerExec(`SELECT 1 FROM pg_database WHERE datname='${TEST_DB}'`);
if (exists === '1') {
  log(`✓ Database "${TEST_DB}" esiste gia'.`);
} else {
  log(`Creazione database "${TEST_DB}"...`);
  dockerExec(`CREATE DATABASE ${TEST_DB} OWNER ${PG_USER}`);
  log(`✓ Database creato.`);
}

// --- 3. Installa extension (idempotente) ---
log('Installazione estensioni (postgis, pg_trgm, citext)...');
dockerExec(`CREATE EXTENSION IF NOT EXISTS postgis`, TEST_DB);
dockerExec(`CREATE EXTENSION IF NOT EXISTS pg_trgm`, TEST_DB);
dockerExec(`CREATE EXTENSION IF NOT EXISTS citext`, TEST_DB);
log('✓ Estensioni pronte.');

// --- 4. Applica migrations Prisma ---
log('Applicazione migrations Prisma...');
const migrationsPath = path.join(API_ROOT, 'prisma/migrations');
const hasMigrations = existsSync(migrationsPath);
if (!hasMigrations) {
  warn(`Nessuna cartella prisma/migrations/. Skip migrate.`);
  warn(`Crea prima le migrations con: cd apps/api && npx prisma migrate dev --name init`);
  process.exit(1);
}

// Comando come stringa unica: con `shell: true` Node non accetta piu' un array
// di argomenti senza avvisare (DEP0190). La shell serve per npx su Windows.
const migrateRes = spawnSync('npx prisma migrate deploy', {
  cwd: API_ROOT,
  env: { ...process.env, DATABASE_URL: TEST_URL },
  stdio: 'inherit',
  shell: true,
});
if (migrateRes.status !== 0) {
  console.error(`❌ Migration fallita.`);
  process.exit(1);
}

// --- 5. Seed ---
log('Esecuzione seed...');
const seedRes = spawnSync('node prisma/seed.mjs', {
  cwd: API_ROOT,
  env: { ...process.env, DATABASE_URL: TEST_URL },
  stdio: 'inherit',
  shell: true,
});
if (seedRes.status !== 0) {
  console.error(`❌ Seed fallito.`);
  process.exit(1);
}

console.log('');
console.log(`✅ Database "${TEST_DB}" pronto per i test.`);
console.log(`   URL: ${TEST_URL}`);
console.log(`   Lancia i test con: npm test`);
