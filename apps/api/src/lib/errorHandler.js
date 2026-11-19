// =============================================================================
// src/lib/errorHandler.js
// =============================================================================
// Error handler centralizzato. Mappa errori comuni a HTTP status appropriati:
//
//   - Errori di validazione Fastify (JSON Schema)  → 400 BAD_REQUEST
//   - PrismaClientKnownRequestError P2002 (unique) → 409 CONFLICT
//   - PrismaClientKnownRequestError P2025 (not found) → 404 NOT_FOUND
//   - PrismaClientKnownRequestError P2003 (FK)     → 400 BAD_REQUEST
//   - HTTP errors espliciti (con statusCode su error) → preservati
//   - Tutto il resto                                → 500 INTERNAL_SERVER_ERROR
//
// La risposta segue sempre il formato:
//   { error: { code: 'STRING_CODE', message: 'human readable' } }
// (+ details opzionale per errori di validazione)
//
// In dev include lo stack trace; in prod no.
// =============================================================================

import { Prisma } from './prismaClient.js';
import { config } from '../config.js';

// Con il driver adapter (Prisma 7) i dettagli del vincolo violato non sono
// piu' in `meta.target` / `meta.field_name` ma nell'errore del driver.
function constraintOf(error) {
  const c = error.meta?.driverAdapterError?.cause?.constraint;
  return c?.fields ?? c?.index ?? c?.foreignKey ?? undefined;
}

export function errorHandler(error, request, reply) {
  request.log.error({ err: error }, 'request error');

  // --- 1. Errori di validazione Fastify (JSON Schema) ---
  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Richiesta non valida',
        details: error.validation.map((v) => ({
          path: v.instancePath || v.dataPath,
          message: v.message,
        })),
      },
    });
  }

  // --- 2. Errori Prisma (known) ---
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // unique constraint
        return reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: 'Risorsa già esistente',
            details: { fields: error.meta?.target ?? constraintOf(error) },
          },
        });
      case 'P2025': // record not found
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Risorsa non trovata' },
        });
      case 'P2003': // foreign key constraint
        return reply.status(400).send({
          error: {
            code: 'BAD_REFERENCE',
            message: 'Riferimento a risorsa inesistente',
            details: { field: error.meta?.field_name ?? constraintOf(error) },
          },
        });
      default:
        return reply.status(400).send({
          error: {
            code: 'DATABASE_ERROR',
            message: `Errore database (${error.code})`,
            ...(config.isDev && { details: error.meta }),
          },
        });
    }
  }

  // --- 3. Errori Prisma di validazione (campi sbagliati) ---
  if (error instanceof Prisma.PrismaClientValidationError) {
    return reply.status(400).send({
      error: {
        code: 'INVALID_DATA',
        message: 'Dati non validi per il database',
        ...(config.isDev && { details: error.message }),
      },
    });
  }

  // --- 4. Errori HTTP espliciti (es. fastify.httpErrors o thrown con statusCode) ---
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code || 'CLIENT_ERROR',
        message: error.message,
      },
    });
  }

  // --- 5. Errori generici / 500 ---
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isDev ? error.message : 'Errore interno del server',
      ...(config.isDev && { stack: error.stack }),
    },
  });
}

/**
 * Handler per route non trovate (404).
 */
export function notFoundHandler(request, reply) {
  reply.status(404).send({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${request.method} ${request.url} non trovata`,
    },
  });
}
