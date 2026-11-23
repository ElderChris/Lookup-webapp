// =============================================================================
// apps/web/js/api/index.js
// =============================================================================
// Punto d'ingresso unico per il layer API frontend.
//
// Un modulo per dominio (libri, generi, utenti, prestiti, post, notifiche,
// statistiche, preferenze, enti, libreria, amministrazione, accesso), esposto
// alle pagine come window.LB_API da api-bootstrap.js.
//
// Uso:
//   const profile = await LB_API.users.getMe();
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

export * as prefs from './endpoints/prefs.js';
export * as orgProfile from './endpoints/orgProfile.js';
export * as library from './endpoints/library.js';

// Amministrazione
export * as admin from './endpoints/admin.js';

// Conversione delle risposte nella forma usata dalle pagine + cache
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

// Better Auth client wrapper (endpoint /api/auth/*)
export * as authClient from './endpoints/auth.js';
export { AuthError } from './endpoints/auth.js';
