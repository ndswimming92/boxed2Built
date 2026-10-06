import type { NewsItem, NewsTopic } from '../types/news';

export const NEWS_TOPIC_LABELS: Record<NewsTopic, string> = {
  flat_pack: 'Flat pack furniture',
  furniture_assembly: 'Furniture assembly',
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
