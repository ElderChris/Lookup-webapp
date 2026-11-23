// =============================================================================
// apps/web/js/api/transformer.js
// =============================================================================
// Convertitore di shape tra backend (camelCase, struttura "moderna") e
// frontend legacy (snake_case, struttura piatta come SAMPLE_*).
//
// Filosofia:
//   - Niente magia (no Proxy, no recursive auto-snake_case).
//   - Mapping ESPLICITO per dominio: ogni campo che cambia nome o struttura
//     e' dichiarato. Vantaggio: leggibilita', debug facile, manutenzione chiara.
//   - Direzionale: `toLegacy(obj)` per consumare risposte dell'API nelle
//     pagine vecchie; `toApi(obj)` per inviare al backend dal codice legacy.
//
// Edge case noti:
//   - Backend espone `timestamps: {requested, confirmed, ...}` per loans;
//     il legacy li ha sparsi come `requested_at, confirmed_at, ...`. La
//     funzione `loanToLegacy` flatta l'oggetto.
//   - Backend ritorna `category` come oggetto `{id, name, slug}`; il legacy
//     usa solo lo slug come stringa. Mapping esplicito.
//   - Campo `available` ha lo stesso nome in entrambi (no transform).
//   - `id` resta `id` in entrambi.
// =============================================================================

// -----------------------------------------------------------------------------
// BOOKS
// -----------------------------------------------------------------------------

/**
 * Palette del design system (paper #f4efe6, ink #1a1512, burgundy #7a1e2b,
 * gold #b08840, sage #6e7a5a). Usata per generare gradient deterministici
 * per i libri fetched dal backend (che non espone `cover_gradient`).
 */
const COVER_PALETTE = ['#7a1e2b', '#5a141f', '#b08840', '#6e7a5a', '#3d342e', '#1a1512'];

/**
 * Genera un gradient deterministico basato sull'id. Stessi libri = stesso
 * gradient tra reload, senza dover persistere niente. Mimica visuale
 * dell'output di `API.randomGradient()` legacy.
 */
function deterministicGradient(id) {
  const n = COVER_PALETTE.length;
  // Semplice hash su id per due indici distinti
  const a = COVER_PALETTE[(id * 7) % n];
  const b = COVER_PALETTE[(id * 13 + 3) % n];
  const c = a === b ? COVER_PALETTE[(id + 1) % n] : b;
  return `linear-gradient(135deg, ${a} 0%, ${c} 100%)`;
}

/**
 * Converte un BookDto del backend (camelCase) nella shape legacy (snake_case)
 * usata dalle pagine HTML vecchie e da SAMPLE_BOOKS.
 *
 * Backend shape (estratto da BookDto):
 *   { id, title, author, year?, isbn?, pages?, coverUrl, available, ownerId,
 *     createdAt, viewCount, likesCount, owner?, primaryCategory?, categories? }
 *
 * Legacy shape attesa:
 *   { id, title, author, year, isbn, pages, cover_url, available, owner_id,
 *     created_at, views, likes_count, category, categories, condition?,
 *     description?, language?, cover_gradient (deterministico se assente) }
 */
export function bookToLegacy(b) {
  if (!b) return null;
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    year: b.year ?? null,
    isbn: b.isbn ?? '—',
    pages: b.pages ?? null,
    language: b.language ?? null,
    condition: b.condition ?? null,
    description: b.description ?? '',
    cover_url: b.coverUrl ?? null,
    cover_gradient: b.cover_gradient ?? deterministicGradient(b.id),
    available: b.available,
    owner_id: b.ownerId ?? (b.owner && b.owner.id) ?? null,
    owner_name: b.owner?.displayName ?? null,
    owner_city: b.owner?.city ?? null,
    owner_account_type: b.owner?.accountType ?? null,
    // Posizione pubblica del proprietario (presente negli elenchi)
    owner_lat: b.owner?.lat ?? null,
    owner_lng: b.owner?.lng ?? null,
    liked_by_me: b.likedByMe === true,
    created_at: b.createdAt ?? null,
    added: b.createdAt ? b.createdAt.slice(0, 10) : null,
    views: b.viewCount ?? 0,
    likes_count: b.likesCount ?? 0,
    category: b.primaryCategory?.slug ?? b.categories?.[0]?.slug ?? null,
    // Nome del genere principale, da mostrare
    category_name: b.primaryCategory?.name ?? b.categories?.[0]?.name ?? '',
    categories: (b.categories ?? []).map((c) => c.slug),
  };
}

/**
 * Converte un body legacy (snake_case, form add-book) nel body per
 * POST /api/books. Nota: `categoryIds` deve essere risolto separatamente
 * via `categories.slugsToIds()` PRIMA di chiamare questa funzione, perche'
 * richiede una fetch async della lista categorie.
 *
 * @param {object} legacy - shape come da form add-book
 * @param {number[]} categoryIds - id risolti dei tag selezionati
 */
export function bookToApi(legacy, categoryIds) {
  const out = {
    title: legacy.title?.trim(),
    author: legacy.author?.trim(),
    // Almeno un genere: lo controlla la pagina e lo valida il server
    categoryIds: categoryIds || [],
  };
  // Campi opzionali — passa solo se valorizzati (altrimenti il backend
  // rifiuta `null` con validation error)
  if (legacy.year) out.year = +legacy.year;
  if (legacy.isbn && legacy.isbn !== '—') out.isbn = legacy.isbn.trim();
  if (legacy.pages) out.pages = +legacy.pages;
  if (legacy.language) out.language = legacy.language;
  if (legacy.condition) out.condition = legacy.condition;
  if (legacy.description?.trim()) out.description = legacy.description.trim();
  if (legacy.cover_url) out.coverUrl = legacy.cover_url;
  return out;
}

// -----------------------------------------------------------------------------
// USERS
// -----------------------------------------------------------------------------

/**
 * Backend UserDto → legacy user shape.
 * Backend: { id, username, displayName, bio?, city?, lat?, lng?, avatarUrl,
 *   accountType, organization?, preferences?, counts?, isFollowing? }
 * Legacy:  { id, username, display_name, bio, city, lat, lng, avatar_url,
 *   account_type, organization, preferences, joined_at?, ... }
 */
export function userToLegacy(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    display_name: u.displayName ?? u.username,
    bio: u.bio ?? '',
    city: u.city ?? null,
    lat: u.lat ?? null,
    lng: u.lng ?? null,
    avatar_url: u.avatarUrl ?? null,
    account_type: u.accountType ?? 'reader',
    organization: u.organization ?? null,
    preferences: u.preferences ?? {},
    // metadati aggiuntivi del backend non rappresentati nel legacy
    _counts: u.counts ?? null,
    _isFollowing: u.isFollowing ?? null,
  };
}

/**
 * Body legacy per PATCH /api/users/me. Solo campi forniti vengono inviati.
 */
export function userPatchToApi(legacy) {
  const out = {};
  if ('display_name' in legacy) out.displayName = legacy.display_name;
  if ('bio' in legacy) out.bio = legacy.bio;
  if ('city' in legacy) out.city = legacy.city;
  if ('lat' in legacy) out.lat = legacy.lat;
  if ('lng' in legacy) out.lng = legacy.lng;
  if ('avatar_url' in legacy) out.avatarUrl = legacy.avatar_url;
  if ('preferences' in legacy) out.preferences = legacy.preferences;
  if ('organization' in legacy) out.organization = legacy.organization;
  return out;
}

// -----------------------------------------------------------------------------
// LOANS
// -----------------------------------------------------------------------------

/**
 * Backend LoanDto → legacy loan shape.
 *
 * Backend: timestamps annidati in `timestamps: {requested, confirmed, ...}`,
 *          campo `role` ('requester'|'lender'), `rejectReason`
 * Legacy:  timestamps sparsi (requested_at, confirmed_at, ...), niente role,
 *          requester_id / lender_id come riferimenti diretti
 */
export function loanToLegacy(l) {
  if (!l) return null;
  const ts = l.timestamps || {};
  return {
    id: l.id,
    book_id: l.book?.id ?? null,
    requester_id: l.requester?.id ?? null,
    lender_id: l.lender?.id ?? null,
    status: l.status,
    message: l.message ?? null,
    reject_reason: l.rejectReason ?? null,
    requested_at: ts.requested ?? l.requestedAt ?? null,
    confirmed_at: ts.confirmed ?? l.confirmedAt ?? null,
    borrowed_at: ts.borrowed ?? l.borrowedAt ?? null,
    returning_at: ts.returning ?? l.returningAt ?? null,
    returned_at: ts.returned ?? l.returnedAt ?? null,
    rejected_at: ts.rejected ?? l.rejectedAt ?? null,
    cancelled_at: ts.cancelled ?? l.cancelledAt ?? null,
    // estensioni: book/requester/lender embedded per evitare seconda fetch
    _book: l.book ? bookToLegacy(l.book) : null,
    _requester: l.requester ? userToLegacy(l.requester) : null,
    _lender: l.lender ? userToLegacy(l.lender) : null,
    _role: l.role,
    _messagesCount: l.messagesCount ?? 0,
  };
}

// -----------------------------------------------------------------------------
// POSTS
// -----------------------------------------------------------------------------

/**
 * Backend PostDto → legacy post shape.
 * Backend: { id, content, createdAt, status, author{...}, reactionsCount,
 *   reactionsByEmoji?, myReactions? }
 * Legacy:  { id, content, created_at, author_id, status, reactions{} }
 */
export function postToLegacy(p) {
  if (!p) return null;
  return {
    id: p.id,
    content: p.content,
    created_at: p.createdAt,
    author_id: p.author?.id ?? null,
    status: p.status ?? 'published',
    reactions: p.reactionsByEmoji ?? {},
    _author: p.author ? userToLegacy(p.author) : null,
    _myReactions: p.myReactions ?? [],
    _reactionsCount: p.reactionsCount ?? 0,
  };
}

// -----------------------------------------------------------------------------
// NOTIFICATIONS
// -----------------------------------------------------------------------------

/**
 * Backend NotificationDto → legacy notification shape.
 * Backend: { id, type, payload, isRead, createdAt, ... }
 * Legacy:  { id, type, payload, is_read, created_at }
 */
export function notificationToLegacy(n) {
  if (!n) return null;
  return {
    id: n.id,
    type: n.type,
    payload: n.payload ?? {},
    is_read: n.isRead ?? false,
    created_at: n.createdAt,
  };
}

// -----------------------------------------------------------------------------
// HELPER: applica un transformer su array o singolo oggetto
// -----------------------------------------------------------------------------

/**
 * Applica un transformer a un valore che puo' essere singolo o array.
 * @param {Array<T> | T | null} value
 * @param {(item: T) => U} fn
 * @returns {Array<U> | U | null}
 */
export function transform(value, fn) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(fn);
  return fn(value);
}
