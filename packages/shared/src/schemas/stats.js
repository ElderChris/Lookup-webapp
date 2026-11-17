// =============================================================================
// packages/shared/src/schemas/stats.js
// =============================================================================
// Schemi Zod per gli endpoint /api/stats/*.
// =============================================================================

import { z } from 'zod';
import {
  IntId, UserId, NullableUrl, AccountType, UserSummaryDto, CategorySummaryDto,
} from './common.js';

// -----------------------------------------------------------------------------
// Featured
// -----------------------------------------------------------------------------

export const FeaturedBookDto = z.object({
  id: IntId,
  title: z.string(),
  author: z.string(),
  coverUrl: z.string().url().nullable(),
  available: z.boolean(),
  owner: UserSummaryDto,
  primaryCategory: CategorySummaryDto.nullable(),
  metrics: z.object({
    loanCount: z.number().int().min(0),
    likeCount: z.number().int().min(0),
    viewCount: z.number().int().min(0),
    score: z.number(),
  }),
});

export const FeaturedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export const FeaturedResponse = z.object({
  windowDays: z.number().int(),
  data: z.array(FeaturedBookDto),
});

// -----------------------------------------------------------------------------
// Ridgeline (top N utenti x M settimane)
// -----------------------------------------------------------------------------

export const RidgelineWeekPoint = z.object({
  week: z.string().regex(/^\d{4}-W\d{2}$/, "ISO week format YYYY-Www"),
  count: z.number().int().min(0),
});

export const RidgelineUserDto = z.object({
  userId: UserId,
  username: z.string(),
  displayName: z.string(),
  accountType: AccountType,
  avatarUrl: NullableUrl,
  total: z.number().int().min(0),
  weeks: z.array(RidgelineWeekPoint),
});

export const RidgelineQuery = z.object({
  users: z.coerce.number().int().min(1).max(50).default(10),
  weeks: z.coerce.number().int().min(1).max(26).default(8),
});

export const RidgelineResponse = z.object({
  weekLabels: z.array(z.string()),
  windowWeeks: z.number().int(),
  data: z.array(RidgelineUserDto),
});

// -----------------------------------------------------------------------------
// Top users (multi-metrica)
// -----------------------------------------------------------------------------

export const TopUserDto = z.object({
  id: IntId,
  username: z.string(),
  displayName: z.string(),
  city: z.string().nullable(),
  accountType: AccountType,
  avatarUrl: NullableUrl,
  metrics: z.object({
    loanCount: z.number().int().min(0),
    reviewCount: z.number().int().min(0),
    postCount: z.number().int().min(0),
    avgRating: z.number().min(0).max(5),
    score: z.number(),
  }),
});

export const TopUsersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const TopUsersResponse = z.object({
  data: z.array(TopUserDto),
});

// -----------------------------------------------------------------------------
// BISAC co-occurrence
// -----------------------------------------------------------------------------

export const BisacPairDto = z.object({
  a: z.object({ id: IntId, name: z.string() }),
  b: z.object({ id: IntId, name: z.string() }),
  count: z.number().int().positive(),
});

export const BisacQuery = z.object({
  minCount: z.coerce.number().int().min(1).max(100).default(2),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const BisacResponse = z.object({
  minCount: z.number().int(),
  data: z.array(BisacPairDto),
});

// -----------------------------------------------------------------------------
// Beta 2: Global stats (per admin.html + landing kpi)
// -----------------------------------------------------------------------------

/** Aggregato "quanti X ci sono nella piattaforma". Query O(N) leggere. */
export const GlobalStatsDto = z.object({
  totalUsers: z.number().int().nonnegative(),
  usersByType: z.object({
    person: z.number().int().nonnegative(),
    organization: z.number().int().nonnegative(),
  }),
  usersByStatus: z.object({
    active: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    suspended: z.number().int().nonnegative(),
    deleted: z.number().int().nonnegative(),
  }),
  totalBooks: z.number().int().nonnegative(),
  booksAvailable: z.number().int().nonnegative(),
  totalLoans: z.number().int().nonnegative(),
  loansByStatus: z.record(z.string(), z.number().int().nonnegative()),
  totalPosts: z.number().int().nonnegative(),
  totalReviews: z.number().int().nonnegative(),
  totalFollows: z.number().int().nonnegative(),
  totalLikes: z.number().int().nonnegative(),
});

// -----------------------------------------------------------------------------
// Beta 2: Activity timeline (aggregato attivita' recente per admin)
// -----------------------------------------------------------------------------

/** Serie temporale con conteggi giornalieri di eventi tipizzati. */
export const ActivityTimelineDto = z.object({
  days: z.number().int().min(1).max(90),
  from: IsoDateTime,
  to: IsoDateTime,
  series: z.array(z.object({
    date: z.string(),          // 'YYYY-MM-DD'
    signups: z.number().int().nonnegative(),
    books: z.number().int().nonnegative(),
    loans: z.number().int().nonnegative(),
    posts: z.number().int().nonnegative(),
    reviews: z.number().int().nonnegative(),
  })),
});

export const ActivityTimelineQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

// -----------------------------------------------------------------------------
// Beta 2: Book timeline (per grafico attivita' su singolo libro)
// -----------------------------------------------------------------------------

export const BookTimelineDto = z.object({
  bookId: IntId,
  windowDays: z.number().int(),
  series: z.array(z.object({
    date: z.string(),
    views: z.number().int().nonnegative(),
    likes: z.number().int().nonnegative(),
    loanRequests: z.number().int().nonnegative(),
  })),
  totals: z.object({
    views: z.number().int().nonnegative(),
    likes: z.number().int().nonnegative(),
    loanRequests: z.number().int().nonnegative(),
  }),
});

// -----------------------------------------------------------------------------
// Beta 2: Global stats (contatori aggregati per admin dashboard + stats page)
// -----------------------------------------------------------------------------

export const GlobalStatsDto = z.object({
  totalUsers: z.number().int().nonnegative(),
  activeUsers: z.number().int().nonnegative(),        // status='active'
  personUsers: z.number().int().nonnegative(),
  orgUsers: z.number().int().nonnegative(),
  totalBooks: z.number().int().nonnegative(),
  availableBooks: z.number().int().nonnegative(),
  totalLoans: z.number().int().nonnegative(),
  activeLoans: z.number().int().nonnegative(),        // requested + confirmed + borrowed + returning
  completedLoans: z.number().int().nonnegative(),     // returned
  totalPosts: z.number().int().nonnegative(),
  totalReviews: z.number().int().nonnegative(),
  totalCategories: z.number().int().nonnegative(),
  computedAt: IsoDateTime,
});

// -----------------------------------------------------------------------------
// Beta 2: Activity timeline (ultimi N giorni di attività aggregata)
// -----------------------------------------------------------------------------

export const ActivityTimelinePointDto = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  signups: z.number().int().nonnegative(),
  newBooks: z.number().int().nonnegative(),
  loanRequests: z.number().int().nonnegative(),
  reviews: z.number().int().nonnegative(),
  posts: z.number().int().nonnegative(),
});

export const ActivityTimelineQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export const ActivityTimelineResponse = z.object({
  days: z.number().int().positive(),
  timeline: z.array(ActivityTimelinePointDto),
});
