// @ts-check
import js from '@eslint/js';
import globals from 'globals';

/**
 * Configurazione ESLint 9 (flat config).
 *
 * Filosofia: niente preset opinionati (no airbnb, no standard). Solo:
 * - `eslint:recommended` per i bug reali
 * - regole stilistiche minime che riflettono lo stile esistente
 * - globals appropriati per browser modules
 *
 * In Fase 1 quando ci sarà TypeScript aggiungeremo typescript-eslint.
 */

export default [
  {
    files: ['apps/web/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // I 4 moduli espongono questi su window per gli inline script HTML
        API: 'readonly',
        UI: 'readonly',
        Storage: 'readonly',
        LIBRARY_COVER_DESIGNS: 'readonly',
        LIBRARY_COVER_DESIGN_MAP: 'readonly',
        LOAN_STATUS: 'readonly',
        LOAN_STATUS_ORDER: 'readonly',
        LOAN_STATUS_LABEL: 'readonly',
        LOAN_STATUS_HINT: 'readonly',
        // Library esterne caricate via CDN nelle pagine (lazy)
        L: 'readonly',           // Leaflet
        Chart: 'readonly'        // Chart.js
      }
    },
    rules: {
      ...js.configs.recommended.rules,

      // Regole specifiche al progetto
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        // Le costanti esportate da data.js non sempre sono usate in tutti i moduli
        // ma export-ate per coerenza tassonomica
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': 'off',         // console.* è ok in dev/prototipo
      'no-undef': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'no-inner-declarations': 'off',
      // Non bloccare per useless escape: pattern di regex italiana
      'no-useless-escape': 'warn'
    }
  },
  {
    files: ['tests-e2e/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        API: 'readonly',
        UI: 'readonly',
        Storage: 'readonly'
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-empty-pattern': 'off'
    }
  },
  {
    // playwright.config.js, eslint.config.js, ecc.
    files: ['*.config.js', '*.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      ...js.configs.recommended.rules
    }
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'test-results/**',
      'playwright-report/**',
      '.husky/**'
    ]
  }
];
