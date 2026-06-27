// =============================================================================
// scripts/setup-husky.mjs
// =============================================================================
// Eseguito da `npm install` via lo script `prepare` in package.json.
// Cross-platform (funziona su Windows, macOS, Linux) perche' usa solo Node.js
// built-in, niente shell builtins (`[`, `test`, `true`, etc.).
//
// Comportamento:
//   - Se la cartella .git esiste -> inizializza husky (pre-commit hook attivo)
//   - Se .git NON esiste (es. progetto scaricato come ZIP) -> esce senza errore
//   - Se husky fallisce per qualunque motivo -> log warning, esce 0 (non rompe install)
// =============================================================================

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync('.git')) {
  console.log('[setup-husky] Nessuna cartella .git trovata, husky non inizializzato.');
  console.log('[setup-husky] Per attivare i pre-commit hook: git init && npm run prepare');
  process.exit(0);
}

try {
  execSync('npx husky', { stdio: 'inherit' });
  console.log('[setup-husky] Husky inizializzato. Pre-commit hook attivo.');
} catch (err) {
  // Husky puo' fallire in modi diversi (versione, permessi, etc.).
  // Per non rompere `npm install`, logghiamo il problema ma usciamo 0.
  console.warn('[setup-husky] Husky non installato:', err.message);
  console.warn('[setup-husky] (npm install continua comunque)');
  process.exit(0);
}
