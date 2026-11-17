// =============================================================================
// packages/shared/src/schemas/posts.js
// =============================================================================
// Schemi Zod per gli endpoint /api/posts/* + reactions + reports.
// =============================================================================

import { z } from 'zod';
import {
  PostId, IntId, UserId, IsoDateTime, PaginationQuery, PaginatedResponse,
  PostStatus, UserSummaryDto,
} from './common.js';

// -----------------------------------------------------------------------------
// Reactions
// -----------------------------------------------------------------------------

/**
 * Emoji per reactions. Max 16 caratteri (VarChar(16) nel DB).
 * Accetta sia emoji unicode singoli (👍 ❤️) sia alias testuali ("like", "thumbs-up").
 */
export const ReactionEmoji = z.string().min(1).max(16);

export const PostReactionRefDto = z.object({
  emoji: ReactionEmoji,
  count: z.number().int().min(0),
});

// -----------------------------------------------------------------------------
// Posts
// -----------------------------------------------------------------------------

export const PostDto = z.object({
  id: PostId,
  content: z.string(),
  status: PostStatus,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  author: UserSummaryDto,
  reactionsCount: z.number().int().min(0),
  reactionsByEmoji: z.record(z.string(), z.number().int().min(0)), // { '👍': 3, 'heart': 1 }
  myReactions: z.array(ReactionEmoji).optional(),                   // presente se auth
});

export const CreatePostBody = z.object({
  content: z.string().min(1).max(500),
});

// -----------------------------------------------------------------------------
// Reports
// -----------------------------------------------------------------------------

export const ReportReason = z.enum(['off-topic', 'spam', 'harassment', 'other']);

export const PostReportDto = z.object({
  id: IntId,
  reason: ReportReason,
  note: z.string().nullable(),
  createdAt: IsoDateTime,
  postId: PostId,
});

export const CreatePostReportBody = z.object({
  reason: ReportReason,
  note: z.string().max(500).optional(),
});

// -----------------------------------------------------------------------------
// Reactions endpoints
// -----------------------------------------------------------------------------

export const CreateReactionBody = z.object({
  emoji: ReactionEmoji,
});

export const ReactionResponse = z.object({
  reactionsCount: z.number().int().min(0),
  reactionsByEmoji: z.record(z.string(), z.number().int().min(0)),
});

// -----------------------------------------------------------------------------
// Lista / Feed
// -----------------------------------------------------------------------------

export const ListPostsQuery = PaginationQuery.extend({
  authorId: UserId.optional(),
});

export const ListPostsResponse = PaginatedResponse(PostDto);
