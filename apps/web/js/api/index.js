// =============================================================================
// apps/web/js/api/index.js
// =============================================================================
// Punto d'ingresso unico per il layer API frontend.
//
// Tutti i 6 domini coperti dal backend Alpha sono ora esposti come moduli
// tipati:
//   - books          (8 funzioni)  Fase 2a
//   - users          (10 funzioni) Fase 2b
//   - loans          (10 funzioni + state machine helpers) Fase 2b
//   - posts          (8 funzioni)  Fase 2b
//   - notifications  (4 funzioni)  Fase 2b
//   - stats          (4 funzioni)  Fase 2b
//
// Uso:
//   import { apiClient, books, users, loans, posts, notifications, stats,
//            ApiError, withApiFallback } from './api/index.js';
//
//   apiClient.configure({ currentUserId: 1 });
//
//   const profile = await users.getMe();
//   const sent = await loans.listSent({ status: 'requested' });
//   await loans.accept(loanId);
//   const feed = await posts.feed({ limit: 20 });
// =============================================================================

// Core client + errori
export { apiClient, ApiError } from './apiClient.js';

// Endpoint per dominio
export { books } from './endpoints/books.js';
export { categories } from './endpoints/categories.js';
export { users } from './endpoints/users.js';
export { loans, LOAN_STATUS, LOAN_TERMINAL_STATUS } from './endpoints/loans.js';
export { posts, REPORT_REASON } from './endpoints/posts.js';
export { notifications, NOTIFICATION_TYPE } from './endpoints/notifications.js';
export { stats } from './endpoints/stats.js';

// Beta 2: nuovi endpoint per copertura funzionalita' legacy
export * as prefs from './endpoints/prefs.js';
export * as orgProfile from './endpoints/orgProfile.js';
export * as library from './endpoints/library.js';

// Beta 4: admin moderation + user management
export * as admin from './endpoints/admin.js';

// Helper di resilienza (fallback graceful a Storage quando backend giu')
export { withApiFallback, withApiFallbackWrapped } from './fallback.js';

// Fase 2c.1: shape transformer + cache layer
export {
  bookToLegacy,
  bookToApi,
  userToLegacy,
  userPatchToApi,
  loanToLegacy,
  postToLegacy,
  notificationToLegacy,
  transform,
} from './transformer.js';
export { cache, CACHE_TTL } from './cache.js';

// Fase 2c.5: QueryClient (TanStack Query-compatible API)
export { QueryClient, queryClient } from './queryClient.js';

// Fase 3.2: Better Auth client wrapper (endpoint /api/auth/*)
export * as authClient from './endpoints/auth.js';
export { AuthError } from './endpoints/auth.js';
