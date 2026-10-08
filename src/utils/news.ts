import type { FurnitureType, NewsItem, NewsTopic, SaleFilterRow, SaleScope } from '../types/news';

export const NEWS_TOPIC_LABELS: Record<NewsTopic, string> = {
  flat_pack: 'Flat pack furniture',
  furniture_assembly: 'Furniture assembly',
  deals: 'Sales',
};

/** Mirrors the length checks on public.news_items. */
export const NEWS_TITLE_MAX = 200;
export const NEWS_SUMMARY_MAX = 1000;

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};

/**
 * A date-only column must not go through `new Date('2026-10-05')`: that parses
 * as UTC midnight and prints as October 4 for anyone west of Greenwich.
 */
function formatDateOnly(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('en-US', DATE_FORMAT);
}

/** Deals are local to Spring Hill, TN, so "the end date" means Central time. */
const DEAL_TIME_ZONE = 'America/Chicago';

/** Today's date (YYYY-MM-DD) in Central time. */
export function centralToday(now: Date = new Date()): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * True once the day after `ends_on` has begun (Central time). An item with no
 * end date never expires. The database applies the same rule to anonymous
 * visitors; this is for signed-in admins, who can read everything.
 */
export function isNewsExpired(item: Pick<NewsItem, 'ends_on'>, now: Date = new Date()): boolean {
  if (!item.ends_on) return false;
  return item.ends_on < centralToday(now);
}

/** "October 12, 2026", or null when there is no valid end date. */
export function formatEndsOn(value: string | null): string | null {
  return value ? formatDateOnly(value) : null;
}

/**
 * The date shown beside a story: when the source published it if we know,
 * otherwise when it was posted here.
 */
export function formatNewsDate(
  item: Pick<NewsItem, 'source_published_on' | 'published_at'>,
): string | null {
  if (item.source_published_on) {
    const formatted = formatDateOnly(item.source_published_on);
    if (formatted) return formatted;
  }
  if (item.published_at) {
    const date = new Date(item.published_at);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('en-US', DATE_FORMAT);
  }
  return null;
}

/**
 * Source links come from an automated check, so the page never trusts them
 * blindly: anything that is not plain http(s) is dropped rather than rendered
 * as a link. The table has the same rule as a CHECK constraint; this is the
 * second lock, not the only one.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * newest / oldest — by the date the story went live.
 * ending_soonest / ending_latest — by the end date, for the Sales tab only.
 * Sales with no end date always come last, newest first, in both directions.
 */
export type NewsOrder = 'newest' | 'oldest' | 'ending_soonest' | 'ending_latest';

export function isEndingOrder(order: NewsOrder): boolean {
  return order === 'ending_soonest' || order === 'ending_latest';
}

/** Where the next page of the public feed starts. */
export interface NewsCursor {
  /** `published_at` of the last story already on screen. */
  publishedAt: string;
  /** Stories on screen that share that exact timestamp. */
  idsAtCursor: string[];
  /**
   * End-date orders only: the last sale's end date (null = none), which is
   * where the next page starts. Absent for the date orders.
   */
  endsOn?: string | null;
}

/**
 * The feed is paged by "older than the last story shown", not by row offset.
 *
 * An offset counts rows from the top of a list that changes underneath the
 * visitor: a story approved between two pages pushes everything down one and
 * repeats a story, and one unpublished pulls everything up one and silently
 * skips a story. Anchoring on the last timestamp shown is immune to both.
 *
 * Stories that share that timestamp are asked for again and dropped by id, so
 * a tie can never hide one.
 */
export function newsCursor(
  items: Array<Pick<NewsItem, 'id' | 'published_at'> & Partial<Pick<NewsItem, 'ends_on'>>>,
  order: NewsOrder = 'newest',
): NewsCursor | null {
  const last = items[items.length - 1];
  if (!last?.published_at) return null;
  // An end-date order is keyed on (end date, posted date, id) of the last sale
  // shown; the id settles any remaining tie, so it is the only id to name.
  if (isEndingOrder(order)) {
    return {
      publishedAt: last.published_at,
      idsAtCursor: [last.id],
      endsOn: last.ends_on ?? null,
    };
  }
  return {
    publishedAt: last.published_at,
    idsAtCursor: items
      .filter((item) => item.published_at === last.published_at)
      .map((item) => item.id),
  };
}

/**
 * The PostgREST condition for "comes after this sale" in an end-date order:
 * end date (nulls last), then posted date newest first, then id newest first.
 *
 * - After a dated sale: a later date (an earlier one for ending_latest), the
 *   same date but posted earlier (or the same instant with a lower id), or any
 *   sale with no end date.
 * - After a sale with no end date: only other undated sales, posted earlier
 *   (or the same instant with a lower id).
 *
 * Written as a position rather than a page offset, so a sale approved or
 * re-dated while a visitor is reading cannot repeat, skip or reorder a row.
 */
export function endingAfterCondition(order: NewsOrder, cursor: NewsCursor): string {
  const [id] = cursor.idsAtCursor;
  const posted = cursor.publishedAt;
  const afterInPostedOrder = (datePart: string) =>
    `and(${datePart},published_at.lt.${posted}),and(${datePart},published_at.eq.${posted},id.lt.${id})`;

  if (cursor.endsOn == null) {
    return afterInPostedOrder('ends_on.is.null');
  }
  const later = order === 'ending_soonest' ? 'gt' : 'lt';
  return [
    `ends_on.${later}.${cursor.endsOn}`,
    afterInPostedOrder(`ends_on.eq.${cursor.endsOn}`),
    'ends_on.is.null',
  ].join(',');
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sales filters: store, local or online, furniture type
 * ────────────────────────────────────────────────────────────────────────── */

export const SALE_SCOPE_LABELS: Record<SaleScope, string> = {
  local: 'Local stores',
  online: 'Online',
};

/** In the order they are offered. Mirrors the check constraint on `furniture_types`. */
export const FURNITURE_TYPE_LABELS: Record<FurnitureType, string> = {
  living_room: 'Living room',
  bedroom: 'Bedroom',
  dining: 'Dining',
  office: 'Office',
  outdoor: 'Outdoor',
  mattresses: 'Mattresses',
  storage: 'Storage and organization',
  rugs_decor: 'Rugs and decor',
};

export const FURNITURE_TYPES = Object.keys(FURNITURE_TYPE_LABELS) as FurnitureType[];

export const NEWS_STORE_NAME_MAX = 80;

/**
 * The page-link form of a store name ("Bassett Home Furnishings" becomes
 * "bassett-home-furnishings"). `news_items.store_slug` is generated with the
 * same rule, so keep the two in step.
 */
export function storeSlug(name: string | null | undefined): string | null {
  if (!name) return null;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || null;
}

export type TopicFilter = NewsTopic | 'all';

export interface SalesFilters {
  /** `store_slug` of the chosen store. */
  store: string | null;
  scope: SaleScope | null;
  type: FurnitureType | null;
}

export const NO_SALES_FILTERS: SalesFilters = { store: null, scope: null, type: null };

export function hasSalesFilters(filters: SalesFilters): boolean {
  return Boolean(filters.store || filters.scope || filters.type);
}

/** Everything a visitor can change on the page, and everything the page link carries. */
export interface NewsView extends SalesFilters {
  topic: TopicFilter;
  order: NewsOrder;
}

/** Visitors who open the Sales tab see the sales about to end first. */
export const SALES_DEFAULT_ORDER: NewsOrder = 'ending_soonest';

export const DEFAULT_NEWS_VIEW: NewsView = {
  topic: 'deals',
  order: SALES_DEFAULT_ORDER,
  ...NO_SALES_FILTERS,
};

export function defaultOrderFor(topic: TopicFilter): NewsOrder {
  return topic === 'deals' ? SALES_DEFAULT_ORDER : 'newest';
}

const TAB_PARAM: Record<TopicFilter, string> = {
  all: 'all',
  flat_pack: 'flat-pack',
  furniture_assembly: 'assembly',
  deals: 'sales',
};

const SORT_PARAM: Record<NewsOrder, string> = {
  newest: 'newest',
  oldest: 'oldest',
  ending_soonest: 'ending-soonest',
  ending_latest: 'ending-latest',
};

function reverseLookup<T extends string>(table: Record<T, string>, value: string | null): T | null {
  if (value === null) return null;
  return (Object.keys(table) as T[]).find((key) => table[key] === value) ?? null;
}

/**
 * Reads the page link, e.g. `?tab=sales&store=wayfair&where=online&type=bedroom`.
 * Anything unrecognised is ignored rather than trusted, and a filter that does
 * not apply to the tab (store on a news tab) or an order that does not exist
 * there (end dates on a news tab) falls back to the tab's default.
 *
 * `explicit` is true when the link chose something, which stops the page from
 * overriding it with the "no sales, show all news" fallback.
 */
export function parseNewsView(search: string): { view: NewsView; explicit: boolean } {
  const params = new URLSearchParams(search);
  const topic = reverseLookup(TAB_PARAM, params.get('tab')) ?? 'deals';
  const requestedOrder = reverseLookup(SORT_PARAM, params.get('sort'));
  const order =
    requestedOrder && (topic === 'deals' || !isEndingOrder(requestedOrder))
      ? requestedOrder
      : defaultOrderFor(topic);

  let filters = NO_SALES_FILTERS;
  if (topic === 'deals') {
    const store = params.get('store');
    const scope = params.get('where');
    const type = params.get('type');
    filters = {
      store: store && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(store) && store.length <= 100 ? store : null,
      scope: scope === 'local' || scope === 'online' ? scope : null,
      type: FURNITURE_TYPES.find((value) => value === type) ?? null,
    };
  }

  const explicit = ['tab', 'sort', 'store', 'where', 'type'].some((key) => params.has(key));
  return { view: { topic, order, ...filters }, explicit };
}

/** The query string for a view, leaving out anything that is the default. */
export function newsViewToSearch(view: NewsView): string {
  const params = new URLSearchParams();
  if (view.topic !== 'deals') params.set('tab', TAB_PARAM[view.topic]);
  if (view.order !== defaultOrderFor(view.topic)) params.set('sort', SORT_PARAM[view.order]);
  if (view.topic === 'deals') {
    if (view.store) params.set('store', view.store);
    if (view.scope) params.set('where', view.scope);
    if (view.type) params.set('type', view.type);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function rowMatches(row: SaleFilterRow, filters: Partial<SalesFilters>): boolean {
  if (filters.store && row.store_slug !== filters.store) return false;
  if (filters.scope && row.sale_scope !== filters.scope) return false;
  if (filters.type && !row.furniture_types.includes(filters.type)) return false;
  return true;
}

/** How many live sales match the filters. */
export function countSales(rows: SaleFilterRow[], filters: Partial<SalesFilters> = {}): number {
  return rows.reduce((sum, row) => (rowMatches(row, filters) ? sum + Number(row.sale_count) : sum), 0);
}

export interface StoreOption {
  slug: string;
  name: string;
  count: number;
}

/**
 * Stores that have live sales under the chosen local/online and type filters,
 * busiest first. The store filter itself is not applied, so choosing a store
 * does not make the other stores vanish from the chips.
 */
export function storeOptions(rows: SaleFilterRow[], filters: Partial<SalesFilters> = {}): StoreOption[] {
  const byStore = new Map<string, StoreOption>();
  for (const row of rows) {
    if (!row.store_slug || !row.store_name) continue;
    if (!rowMatches(row, { scope: filters.scope, type: filters.type })) continue;
    const existing = byStore.get(row.store_slug);
    if (existing) existing.count += Number(row.sale_count);
    else byStore.set(row.store_slug, { slug: row.store_slug, name: row.store_name, count: Number(row.sale_count) });
  }
  return [...byStore.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Sales per local/online choice under the chosen store and type. */
export function scopeCounts(
  rows: SaleFilterRow[],
  filters: Partial<SalesFilters> = {},
): Record<SaleScope, number> & { all: number } {
  const narrowed = { store: filters.store, type: filters.type };
  return {
    all: countSales(rows, narrowed),
    local: countSales(rows, { ...narrowed, scope: 'local' }),
    online: countSales(rows, { ...narrowed, scope: 'online' }),
  };
}

export interface TypeOption {
  value: FurnitureType;
  label: string;
  count: number;
}

/** Furniture types with live sales under the chosen store and local/online filters. */
export function typeOptions(rows: SaleFilterRow[], filters: Partial<SalesFilters> = {}): TypeOption[] {
  const narrowed = { store: filters.store, scope: filters.scope };
  return FURNITURE_TYPES.map((value) => ({
    value,
    label: FURNITURE_TYPE_LABELS[value],
    count: countSales(rows, { ...narrowed, type: value }),
  })).filter((option) => option.count > 0);
}
