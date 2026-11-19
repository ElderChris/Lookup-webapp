// Configurazione della CLI Prisma (Prisma 7): schema, migrazioni, seed e URL
// del database. Il client usato dall'applicazione si collega invece tramite
// il driver adapter in src/lib/prisma.js.
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 non carica piu' .env da solo. Le variabili gia' presenti
// nell'ambiente (CI, Docker, test) hanno la precedenza.
if (existsSync(new URL('./.env', import.meta.url))) {
  process.loadEnvFile(new URL('./.env', import.meta.url));
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.mjs',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
