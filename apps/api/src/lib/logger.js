// =============================================================================
// src/lib/logger.js
// =============================================================================
// Configurazione Pino. In dev: output human-readable via pino-pretty.
// In prod: JSON strutturato (per ingestion in log aggregator).
//
// Redazione automatica di campi sensibili (password, token, cookie)
// per evitare leak nei log anche in caso di stack trace.
// =============================================================================

import { config } from '../config.js';

export const loggerConfig = {
  level: config.logger.level,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.password_hash',
      'req.body.passwordHash',
      'req.body.currentPassword',
      'req.body.newPassword',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
  ...(config.isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
        colorize: true,
        singleLine: false,
      },
    },
  }),
};
