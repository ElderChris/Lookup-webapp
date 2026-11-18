// =============================================================================
// tests/setup-globals.mjs
// =============================================================================
// Vitest globalSetup: eseguito UNA volta prima di tutti i test (non per file).
//
// Cosa fa:
//   1. Verifica che DATABASE_URL punti a lookup_test (safety check)
//   2. Truncate tutte le tabelle dynamiche (loans, reviews, posts, ecc.)
//   3. Riapplica seed minimo (users, categories, books, PostGIS setup)
//
// NON crea il DB ne' applica migrations: si presume che `npm run test:setup-db`
// sia stato eseguito almeno una volta. Se non lo e', i test falliranno con
// errore esplicito.
//
// Ritorna funzione di teardown opzionale (no-op qui).
// =============================================================================

import { PrismaClient } from '@prisma/client';

export default async function setup() {
  // --- Safety check: DATABASE_URL deve contenere "lookup_test" ---
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('lookup_test')) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ DATABASE_URL non punta a lookup_test:');
    console.error(`   ${url}`);
    console.error('');
    console.error('   Lancia i test con: npm test (carica .env.test automaticamente)');
    console.error('   Non eseguire vitest direttamente senza --env-file=.env.test.');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    throw new Error('Refusing to run tests on non-test DB');
  }

  const prisma = new PrismaClient({ log: ['warn', 'error'] });

  try {
    // Test connessione
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Impossibile connettersi al DB di test.');
    console.error(`   Errore: ${err.message}`);
    console.error('');
    console.error('   Verifica che postgres sia attivo (.\\dev.ps1 db-up) e che');
    console.error('   il DB lookup_test esista. Crealo con:');
    console.error('     cd apps/api && npm run test:setup-db');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await prisma.$disconnect();
    throw err;
  }

  // --- Verifica che le tabelle esistano ---
  try {
    await prisma.user.count();
  } catch (err) {
    console.error('❌ Tabelle non trovate nel DB di test.');
    console.error('   Esegui: cd apps/api && npm run test:setup-db');
    await prisma.$disconnect();
    throw err;
  }

  // --- Cleanup dinamico: cancella tutto e ricreazione minima ---
  // Ordine inverso a foreign keys
  console.log('[setup-globals] Cleanup tabelle dinamiche...');
  await prisma.notification.deleteMany();
  await prisma.postReport.deleteMany();
  await prisma.postReaction.deleteMany();
  await prisma.post.deleteMany();
  await prisma.like.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.review.deleteMany();
  await prisma.loanMessage.deleteMany();
  await prisma.loanRequest.deleteMany();
  await prisma.bookCategory.deleteMany();
  await prisma.book.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.organizationProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  console.log('[setup-globals] Esecuzione seed completo...');
  // Importa ed esegui il seed (lo stesso usato in dev)
  await import('../prisma/seed.mjs');

  await prisma.$disconnect();
  console.log('[setup-globals] ✓ DB di test pronto.');

  // teardown
  return async () => {
    // niente: il DB rimane per ispezione manuale post-test
  };
}
