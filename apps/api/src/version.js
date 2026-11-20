// =============================================================================
// src/version.js — versione dell'API letta da package.json
// =============================================================================
// Unica fonte per /api/health e per la specifica OpenAPI: prima la versione
// era scritta a mano in piu' punti e restava indietro a ogni rilascio.
// =============================================================================

import { readFileSync } from 'node:fs';

export const API_VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version;
