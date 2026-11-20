// =============================================================================
// packages/shared/src/schemas/common.js
// =============================================================================
// Schemi Zod usati trasversalmente da piu' moduli.
// =============================================================================

import { z } from 'zod';

// -----------------------------------------------------------------------------
// IDs e tipi primitivi
// -----------------------------------------------------------------------------

/** ID intero positivo (books, categories, loans, reviews, notifications) */
export const IntId = z.number().int().positive();

/**
 * ID utente stringa (Fase 3.0: CUID per compat Better Auth).
 * Formato: string non vuota, max 40 char. Il seed usa `usr_<name>` per debug;
 * in produzione Better Auth genera CUID veri (~24 char alfanumerici).
 */
export const UserId = z.string().min(1).max(40);

/** ID stringa per posts (formato `p_<base64url>`, max 40 char) */
export const PostId = z.string().min(1).max(40);

/** ISO date-time string */
export const IsoDateTime = z.iso.datetime();

/** URL opzionale (consente null) */
export const NullableUrl = z.url().nullable();

// -----------------------------------------------------------------------------
// Paginazione
// -----------------------------------------------------------------------------

/** Query string standard per endpoint paginati */
export const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Oggetto pagination presente nelle response di lista */
export const PaginationDto = z.object({
  total: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0),
});

/** Wrapper standard per response di lista: { data: [...], pagination: {...} } */
export function PaginatedResponse(itemSchema) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationDto,
  });
}

// -----------------------------------------------------------------------------
// Errori uniformi
// -----------------------------------------------------------------------------

/**
 * Codici di errore stabili usati dal backend.
 * I codici NON sono per consumo finale (il frontend li mappa a messaggi
 * localizzati), ma sono garantiti stabili tra versioni.
 */
export const ErrorCode = z.enum([
  // generici
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL_ERROR',
  // dominio specifico
  'SELF_REVIEW',
  'SELF_FOLLOW',
  'SELF_LOAN',
  'LOAN_ALREADY_ACTIVE',
  'INVALID_TRANSITION',
  'WRONG_ROLE',
  'ALREADY_REPORTED',
]);

export const ErrorResponse = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

// -----------------------------------------------------------------------------
// Tipi enumerativi
// -----------------------------------------------------------------------------

export const AccountType = z.enum(['person', 'organization']);
export const UserStatus = z.enum(['active', 'suspended', 'deleted']);
export const BookStatus = z.enum(['active', 'hidden', 'removed']);
export const PostStatus = z.enum(['active', 'removed']);

// -----------------------------------------------------------------------------
// Sub-DTO ricorrenti (usati come embed in altri schemi)
// -----------------------------------------------------------------------------

/** Riferimento utente "leggero" usato in liste e nested objects */
export const UserSummaryDto = z.object({
  id: UserId,
  username: z.string(),
  displayName: z.string(),
  city: z.string().nullable(),
  accountType: AccountType,
  avatarUrl: NullableUrl,
});

/** Riferimento categoria "leggero" */
export const CategorySummaryDto = z.object({
  id: IntId,
  name: z.string(),
  slug: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

/** Coordinate geografiche (per books nearby, user profile) */
export const Coordinates = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
