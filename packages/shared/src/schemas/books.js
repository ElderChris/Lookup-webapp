// =============================================================================
// packages/shared/src/schemas/books.js
// =============================================================================
// Schemi Zod per gli endpoint /api/books/*
// =============================================================================

import { z } from 'zod';
import {
  IntId, IsoDateTime, NullableUrl, PaginationQuery, PaginatedResponse,
  BookStatus, UserSummaryDto, CategorySummaryDto, Coordinates,
} from './common.js';

// -----------------------------------------------------------------------------
// DTO (response shapes)
// -----------------------------------------------------------------------------

/** Versione "lista" del libro (campi essenziali) */
export const BookListItemDto = z.object({
  id: IntId,
  title: z.string(),
  author: z.string(),
  year: z.number().int().nullable(),
  language: z.string().nullable(),
  coverUrl: NullableUrl,
  available: z.boolean(),
  viewCount: z.number().int().min(0),
  requestCount: z.number().int().min(0),
  likesCount: z.number().int().min(0).optional(),
  createdAt: IsoDateTime,
  owner: UserSummaryDto,
  categories: z.array(CategorySummaryDto),
});

/** Versione "dettaglio" del libro */
export const BookDetailDto = BookListItemDto.extend({
  publisher: z.string().nullable(),
  pages: z.number().int().positive().nullable(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  isbn: z.string().nullable(),
  status: BookStatus,
  isLikedByMe: z.boolean().optional(),
});

/** Variante nearby con distanceMeters aggiuntivo */
export const BookNearbyDto = BookListItemDto.extend({
  distanceMeters: z.number().int().min(0),
});

// -----------------------------------------------------------------------------
// Request bodies
// -----------------------------------------------------------------------------

export const CreateBookBody = z.object({
  title: z.string().min(1).max(300),
  author: z.string().min(1).max(200),
  year: z.number().int().min(1000).max(2100).optional(),
  publisher: z.string().max(200).optional(),
  pages: z.number().int().positive().optional(),
  language: z.string().max(20).optional(),
  isbn: z.string().max(20).optional(),
  description: z.string().max(2000).optional(),
  coverUrl: z.string().url().optional(),
  categoryIds: z.array(IntId).min(1).max(5),
  tags: z.array(z.string().max(40)).max(10).optional(),
});

export const UpdateBookBody = z.object({
  title: z.string().min(1).max(300).optional(),
  author: z.string().min(1).max(200).optional(),
  year: z.number().int().min(1000).max(2100).optional(),
  publisher: z.string().max(200).optional(),
  pages: z.number().int().positive().optional(),
  language: z.string().max(20).optional(),
  description: z.string().max(2000).optional(),
  coverUrl: z.string().url().optional(),
  status: BookStatus.optional(),
  available: z.boolean().optional(),
  categoryIds: z.array(IntId).min(1).max(5).optional(),
  tags: z.array(z.string().max(40)).max(10).optional(),
});

// -----------------------------------------------------------------------------
// Query strings
// -----------------------------------------------------------------------------

export const ListBooksQuery = PaginationQuery.extend({
  q: z.string().max(100).optional(),
  category: z.coerce.number().int().positive().optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  available: z.coerce.boolean().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(100).max(100000).optional(),
});

export const NearbyBooksQuery = PaginationQuery.extend({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(100000),
});

// -----------------------------------------------------------------------------
// Response wrappers
// -----------------------------------------------------------------------------

export const ListBooksResponse = PaginatedResponse(BookListItemDto);

export const NearbyBooksResponse = z.object({
  center: Coordinates,
  radius: z.number(),
  data: z.array(BookNearbyDto),
  pagination: z.object({
    total: z.number().int().min(0),
    limit: z.number().int().positive(),
    offset: z.number().int().min(0),
  }),
});

export const LikeBookResponse = z.object({
  liked: z.boolean(),
  likesCount: z.number().int().min(0),
});

export const ViewIncrementResponse = z.object({
  incremented: z.literal(true),
  bookId: IntId,
  viewCount: z.number().int().min(0),
});
