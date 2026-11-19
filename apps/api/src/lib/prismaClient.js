// =============================================================================
// src/lib/prismaClient.js — fabbrica del Prisma Client (Prisma 7)
// =============================================================================
// Da Prisma 7 il client non contiene piu' un motore di query nativo: parla
// con PostgreSQL attraverso un driver adapter (`@prisma/adapter-pg`, basato
// sul driver `pg`). Il client e' generato in src/generated/prisma (ignorato
// da git, rigenerato da `prisma generate` nel postinstall e nel Dockerfile).
//
// Modulo senza dipendenze dalla configurazione dell'app: lo usano anche seed,
// test e script, che hanno solo DATABASE_URL.
// =============================================================================

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

export { Prisma } from '../generated/prisma/client.ts';

/**
 * Crea un Prisma Client collegato a DATABASE_URL.
 *
 * @param {object} [options] - opzioni del PrismaClient (es. `log`)
 * @param {string} [connectionString] - default process.env.DATABASE_URL
 */
export function createPrismaClient(options = {}, connectionString = process.env.DATABASE_URL) {
  const adapter = new PrismaPg({
    connectionString,
    // Il driver pg non ha timeout di connessione di default; Prisma 5/6
    // usava 5 secondi. Lo manteniamo per non restare appesi se il DB e' giu'.
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ ...options, adapter });
}
