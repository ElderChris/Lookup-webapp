// =============================================================================
// packages/shared/src/schemas/users.js
// =============================================================================
// Schemi Zod per gli endpoint /api/users/* + /api/users/me + reviews + follows.
// =============================================================================

import { z } from 'zod';
import {
  IntId, UserId, IsoDateTime, NullableUrl, PaginationQuery, PaginatedResponse,
  AccountType, UserStatus, UserSummaryDto,
} from './common.js';

// -----------------------------------------------------------------------------
// Organization sub-profile
// -----------------------------------------------------------------------------

/**
 * Categorie organizzazione (per organization_profile.org_category).
 * Il legacy usava una lista fissa; qui la duplichiamo per validation Zod.
 */
export const OrgCategory = z.enum([
  'biblioteca_pubblica',
  'biblioteca_comunita',
  'libreria_indipendente',
  'associazione_culturale',
  'centro_studi',
  'scuola',
  'altro',
]);

/** DTO letto dal backend (allineato al modello Prisma OrganizationProfile) */
export const OrganizationProfileDto = z.object({
  userId: UserId,
  legalName: z.string(),
  orgCategory: OrgCategory,
  contactPerson: z.string().nullable(),
  website: z.string().nullable(),
  publicEmail: z.string().nullable(),
  publicPhone: z.string().nullable(),
  publicAddress: z.string().nullable(),
  openingHours: z.string().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

/** Body per patchare il proprio org profile (solo owner) */
export const UpdateOrgProfileBody = z.object({
  legalName: z.string().min(1).max(200).optional(),
  orgCategory: OrgCategory.optional(),
  contactPerson: z.string().max(120).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  publicEmail: z.email().max(255).nullable().optional(),
  publicPhone: z.string().max(30).nullable().optional(),
  publicAddress: z.string().max(200).nullable().optional(),
  openingHours: z.string().max(2000).nullable().optional(),
}).strict();

// -----------------------------------------------------------------------------
// User preferences (Beta 2)
// -----------------------------------------------------------------------------

/** DTO letto dal backend (allineato al modello Prisma UserPreference) */
export const UserPreferencesDto = z.object({
  userId: UserId,
  viewMode: z.enum(['grid', 'list']).default('grid'),
  theme: z.enum(['classic', 'bordeaux', 'verde', 'notturno']).default('classic'),
  avatarStyle: z.enum(['initials', 'symbol', 'photo']).default('initials'),
  avatarSymbol: z.string().max(8).nullable(),
  motto: z.string().max(120).nullable(),
  sortBy: z.enum(['recent', 'title', 'author', 'year']).default('recent'),
  coverDesign: z.string().max(40).nullable(),
  showEmail: z.boolean().default(false),
  updatedAt: IsoDateTime,
});

/** Body per patchare le proprie preferenze */
export const UpdatePrefsBody = z.object({
  viewMode: z.enum(['grid', 'list']).optional(),
  theme: z.enum(['classic', 'bordeaux', 'verde', 'notturno']).optional(),
  avatarStyle: z.enum(['initials', 'symbol', 'photo']).optional(),
  avatarSymbol: z.string().max(8).nullable().optional(),
  motto: z.string().max(120).nullable().optional(),
  sortBy: z.enum(['recent', 'title', 'author', 'year']).optional(),
  coverDesign: z.string().max(40).nullable().optional(),
  showEmail: z.boolean().optional(),
}).strict();

// -----------------------------------------------------------------------------
// DTO: User
// -----------------------------------------------------------------------------

/** Profilo pubblico — chiunque puo' vedere */
export const UserPublicDto = z.object({
  id: UserId,
  username: z.string(),
  displayName: z.string(),
  accountType: AccountType,
  bio: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  avatarUrl: NullableUrl,
  status: UserStatus,
  createdAt: IsoDateTime,
  organizationProfile: OrganizationProfileDto.nullable(),
  counts: z.object({
    books: z.number().int().min(0),
    followers: z.number().int().min(0),
    following: z.number().int().min(0),
    reviewsReceived: z.number().int().min(0),
    avgRating: z.number().nullable(),
  }),
  isFollowing: z.boolean().optional(), // presente solo se autenticato
});

/** Profilo privato — solo il proprietario lo vede */
export const UserMeDto = UserPublicDto.extend({
  email: z.email(),
  preferences: UserPreferencesDto.nullable(),
});

// -----------------------------------------------------------------------------
// Request bodies
// -----------------------------------------------------------------------------

export const UpdateMeBody = z.object({
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(60).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  avatarUrl: z.url().optional(),
  preferences: UserPreferencesDto.partial().optional(),
  organization: OrganizationProfileDto.partial().optional(), // solo per account organization
});

// -----------------------------------------------------------------------------
// Reviews
// -----------------------------------------------------------------------------

export const ReviewDto = z.object({
  id: UserId,
  rating: z.number().int().min(1).max(5),
  text: z.string().nullable(),
  createdAt: IsoDateTime,
  reviewer: UserSummaryDto,
});

export const CreateReviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(2000).optional(),
});

export const ListReviewsResponse = PaginatedResponse(ReviewDto);

// -----------------------------------------------------------------------------
// Follow lists
// -----------------------------------------------------------------------------

export const FollowListResponse = PaginatedResponse(UserSummaryDto);

// -----------------------------------------------------------------------------
// Beta 2: LibraryData aggregato per profile page
// -----------------------------------------------------------------------------

/**
 * Aggregato pesante per profile.html: profilo + libri + prestiti recenti +
 * reviews sintesi. Riduce il numero di request iniziali della pagina.
 */
export const LibraryDataDto = z.object({
  user: UserPublicDto,
  orgProfile: OrganizationProfileDto.nullable(),
  prefs: UserPreferencesDto.nullable(),
  stats: z.object({
    booksCount: z.number().int().nonnegative(),
    booksAvailable: z.number().int().nonnegative(),
    completedLoansCount: z.number().int().nonnegative(),
    activeLoansCount: z.number().int().nonnegative(),
    followersCount: z.number().int().nonnegative(),
    followingCount: z.number().int().nonnegative(),
    reviewsReceivedCount: z.number().int().nonnegative(),
    avgRatingReceived: z.number().min(0).max(5).nullable(),
  }),
  isFollowing: z.boolean().nullable(),  // null se guest, altrimenti se il current user segue questo utente
});

// -----------------------------------------------------------------------------
// Beta 2: Export GDPR — dump JSON del proprio account
// -----------------------------------------------------------------------------

/**
 * Dump completo dei dati personali (GDPR art. 20 — data portability).
 * Il backend genera on-demand, il client lo scarica come file .json.
 */
export const UserExportDto = z.object({
  exportedAt: IsoDateTime,
  format: z.literal('json'),
  version: z.literal('1'),
  user: UserPublicDto,
  email: z.string(),
  orgProfile: OrganizationProfileDto.nullable(),
  prefs: UserPreferencesDto.nullable(),
  books: z.array(z.any()),           // libri posseduti (full record)
  loansAsRequester: z.array(z.any()),
  loansAsLender: z.array(z.any()),
  posts: z.array(z.any()),
  reviewsWritten: z.array(z.any()),
  reviewsReceived: z.array(z.any()),
  follows: z.object({
    following: z.array(UserSummaryDto),
    followers: z.array(UserSummaryDto),
  }),
  likes: z.array(z.number().int()),  // book ids liked
});
