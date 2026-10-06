import type { NewsItem, NewsTopic } from '../types/news';

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
  items: Array<Pick<NewsItem, 'id' | 'published_at'>>,
  order: NewsOrder = 'newest',
): NewsCursor | null {
  const last = items[items.length - 1];
  if (!last?.published_at) return null;
  // An end-date order cannot anchor on a timestamp, because sales without an
  // end date sort after every dated one. There are only a handful of sales, so
  // that page asks for the whole list and drops every id already on screen.
  if (isEndingOrder(order)) {
    return { publishedAt: last.published_at, idsAtCursor: items.map((item) => item.id) };
  }
  return {
    publishedAt: last.published_at,
    idsAtCursor: items
      .filter((item) => item.published_at === last.published_at)
      .map((item) => item.id),
  };
}
