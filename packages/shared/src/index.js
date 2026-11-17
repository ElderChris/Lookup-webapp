// =============================================================================
// packages/shared/src/index.js
// =============================================================================
// Re-export di tutti gli schemi Zod. Permette import shorthand:
//   import { BookDetailDto, CreateBookBody } from '@lookup/shared';
// invece di:
//   import { BookDetailDto } from '@lookup/shared/schemas/books.js';
// =============================================================================

export * from './schemas/common.js';
export * from './schemas/books.js';
export * from './schemas/categories.js';
export * from './schemas/users.js';
export * from './schemas/loans.js';
export * from './schemas/posts.js';
export * from './schemas/notifications.js';
export * from './schemas/stats.js';
