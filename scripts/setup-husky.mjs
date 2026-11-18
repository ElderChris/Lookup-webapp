// =============================================================================
// scripts/setup-husky.mjs
// =============================================================================
// Eseguito da `npm install` via lo script `prepare` in package.json.
//
// STATO ATTUALE: HUSKY DISATTIVATO.
// Motivazione: i pre-commit hook di Husky usano shebang `#!/usr/bin/env sh`
// che richiede bash/WSL su Windows. Sull'ambiente dev attuale (Windows 11
// senza WSL configurato) causa errore al commit. La CI su GitHub Actions
// fa comunque tutti i check (lint, format, test) su ogni push/PR, quindi
// l'assenza dei pre-commit hook locali non comporta rischi qualitativi.
//
// PER RIATTIVARE in futuro (quando il dev ambiente avrà bash/WSL):
//   1. Rimuovi le 3 righe di "early return" qui sotto
//   2. Esegui `npm install` (lo script tornerà a inizializzare husky)
//   3. Eventualmente rigenera i hook: `npx husky init`
// =============================================================================

// === EARLY RETURN: Husky disattivato ===
console.log('[setup-husky] Husky disattivato per ora (vedi commento nel file).');
process.exit(0);
// === /EARLY RETURN ===

// Codice di setup, raggiunto solo quando l'early return e' rimosso
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync('.git')) {
  console.log('[setup-husky] Nessuna cartella .git trovata, husky non inizializzato.');
  process.exit(0);
}

try {
  execSync('npx husky', { stdio: 'inherit' });
  console.log('[setup-husky] Husky inizializzato. Pre-commit hook attivo.');
} catch (err) {
  console.warn('[setup-husky] Husky non installato:', err.message);
  process.exit(0);
}
