// =============================================================================
// vitest.config.js
// =============================================================================
// Configurazione Vitest per i test backend.
//
// Scelte:
//  - Esecuzione SEQUENZIALE: ogni file usa lo stesso DB lookup_test, eseguire
//    in parallelo causerebbe race condition. fileParallelism: false e
//    pool: 'forks' con singleFork garantiscono ordine deterministico.
//  - globalSetup: applica migrations + seed UNA volta prima di tutti i test
//    (non ad ogni file). I test che vogliono stato fresh fanno truncate
//    locale.
//  - testTimeout esteso a 15s: alcuni test creano stati complessi (state
//    machine prestiti) che richiedono piu' di 5s.
//  - coverage v8: report HTML in coverage/ + text summary in console.
// =============================================================================

import { defineConfig } from 'vitest/config';

// Variabili d'ambiente dei test (database lookup_test, Redis db 1, ...).
// Caricate qui invece che con `node --env-file` nello script npm: cosi' il
// comando non dipende da dove npm installa vitest (root del monorepo).
// Le variabili gia' presenti nell'ambiente non vengono sovrascritte.
process.loadEnvFile(new URL('./.env.test', import.meta.url));

export default defineConfig({
  test: {
    globals: false, // import esplicito di describe/it/expect — piu' verboso ma piu' chiaro
    environment: 'node',
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true }, // 1 solo worker: condivide il DB lookup_test
    },
    testTimeout: 15000,
    hookTimeout: 30000, // setup/teardown puo' richiedere migrate+seed
    globalSetup: ['./tests/setup-globals.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: [
        'src/server.js', // entry point, hard to test in isolation
        'src/lib/logger.js', // config-only
        'src/config.js', // config-only
      ],
      thresholds: {
        // Soglie minime per CI; alziamole in 1h.2 quando aggiungiamo test
        lines: 50,
        branches: 50,
        functions: 50,
        statements: 50,
      },
    },
    include: ['tests/**/*.test.js'],
    reporters: ['default'],
  },
});
