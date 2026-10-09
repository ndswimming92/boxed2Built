import type {
  ActionItemCategory,
  ActionItemEffort,
  ActionItemPriority,
  ActionItemStatus,
  Competitor,
  CompetitorActionItem,
  CompetitorCategory,
  CompetitorLink,
} from '../types/competitors';
// The explicit .ts is for the unit tests, which run this file on node directly.
import { daysBetween } from './grants.ts';
import { centralToday, safeExternalUrl } from './news.ts';

export const COMPETITOR_CATEGORY_LABELS: Record<CompetitorCategory, string> = {
  local: 'Local',
  platform: 'National platform',
  retailer: 'Retailer service',
  out_of_area: 'Out of area',
};

/** The order competitors are listed in: the ones competing for the same customers first. */
export const COMPETITOR_CATEGORIES: CompetitorCategory[] = ['local', 'platform', 'retailer', 'out_of_area'];

export const ACTION_CATEGORY_LABELS: Record<ActionItemCategory, string> = {
  services: 'Services',
  pricing: 'Pricing',
  booking: 'Booking',
  marketing: 'Marketing',
  trust: 'Trust',
  customer_experience: 'Customer experience',
  other: 'Other',
};

export const PRIORITY_LABELS: Record<ActionItemPriority, string> = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
};

export const EFFORT_LABELS: Record<ActionItemEffort, string> = {
  quick: 'Quick win',
  moderate: 'Some work',
  big: 'Bigger project',
};

/** An item or competitor counts as new for this many days after it was first saved. */
export const NEW_FOR_DAYS = 7;
/** The watch runs weekly; past this many days without a run the page says so. */
export const STALE_AFTER_DAYS = 10;

/** First saved within the last week, judged by the Central-time day it was added. */
export function isNewThisWeek(createdAt: string, today: string = centralToday()): boolean {
  const added = new Date(createdAt);
  if (Number.isNaN(added.getTime())) return false;
  const days = daysBetween(centralToday(added), today);
  return days !== null && days >= 0 && days < NEW_FOR_DAYS;
}

const PRIORITY_ORDER: Record<ActionItemPriority, number> = { high: 0, medium: 1, low: 2 };
const EFFORT_ORDER: Record<ActionItemEffort, number> = { quick: 0, moderate: 1, big: 2 };

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

/**
 * To do: what matters most first, and among equals the quickest to do, so the
 * top of the list is always the best next thing. Done and removed: the most
 * recently changed first, so a mistaken tick is right there to undo.
 */
export function sortActionItems<
  T extends Pick<CompetitorActionItem, 'priority' | 'effort' | 'title' | 'created_at' | 'status_changed_at'>,
>(items: T[], status: ActionItemStatus): T[] {
  return [...items].sort((a, b) => {
    if (status !== 'open') {
      return (
        (b.status_changed_at ?? '').localeCompare(a.status_changed_at ?? '') || compareText(a.title, b.title)
      );
    }
    return (
      (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) ||
      (EFFORT_ORDER[a.effort] ?? 9) - (EFFORT_ORDER[b.effort] ?? 9) ||
      b.created_at.localeCompare(a.created_at) ||
      compareText(a.title, b.title)
    );
  });
}

/** Local businesses first, then platforms, retailers and out-of-area ones; by name within each. */
export function sortCompetitors<T extends Pick<Competitor, 'category' | 'name'>>(competitors: T[]): T[] {
  const order = (category: CompetitorCategory) => {
    const index = COMPETITOR_CATEGORIES.indexOf(category);
    return index === -1 ? COMPETITOR_CATEGORIES.length : index;
  };
  return [...competitors].sort(
    (a, b) => order(a.category) - order(b.category) || compareText(a.name, b.name),
  );
}

/** Case-insensitive match on the fields someone would search a competitor by. */
export function matchesCompetitorSearch(
  competitor: Pick<
    Competitor,
    'name' | 'summary' | 'location' | 'owner_name' | 'email' | 'services' | 'pricing' | 'standout' | 'service_area'
  >,
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [
    competitor.name,
    competitor.summary,
    competitor.location,
    competitor.owner_name,
    competitor.email,
    competitor.services,
    competitor.pricing,
    competitor.standout,
    competitor.service_area,
  ].some((value) => (value ?? '').toLowerCase().includes(needle));
}

const LINK_LABEL_MAX = 60;

/**
 * The extra links saved for a competitor, keeping only the ones that are safe
 * to render. The column is written by an automated process from web pages, so
 * nothing about its shape is assumed: anything that is not a labelled http(s)
 * address is dropped, and so is a second copy of the same address.
 */
export function competitorLinks(links: unknown): CompetitorLink[] {
  if (!Array.isArray(links)) return [];
  const seen = new Set<string>();
  const safe: CompetitorLink[] = [];
  for (const entry of links) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { label, url } = entry as { label?: unknown; url?: unknown };
    if (typeof url !== 'string') continue;
    const href = safeExternalUrl(url);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const text = typeof label === 'string' ? label.trim().slice(0, LINK_LABEL_MAX) : '';
    safe.push({ label: text || websiteLabel(href) || 'Link', url: href });
  }
  return safe;
}

/** "example.com" from "https://www.example.com/about". Null when it is not a web address. */
export function websiteLabel(url: string | null | undefined): string | null {
  const href = safeExternalUrl(url);
  if (!href) return null;
  return new URL(href).hostname.replace(/^www\./i, '');
}

/**
 * A mailto: link for a saved email, or null when the value is not one plain
 * address. Encoded so nothing in it can add recipients, a subject or a body.
 */
export function mailtoHref(email: string | null | undefined): string | null {
  const value = email?.trim();
  if (!value || !/^[^@\s<>,;:"]+@[^@\s<>,;:"]+\.[^@\s<>,;:"]+$/.test(value)) return null;
  return `mailto:${encodeURIComponent(value).replace(/%40/g, '@')}`;
}

/** A tel: link for a saved phone number, or null when it has too few digits to be one. */
export function telHref(phone: string | null | undefined): string | null {
  const value = phone?.trim();
  if (!value) return null;
  // An extension is not part of the number to dial.
  const main = value.split(/\s*(?:ext\.?|x)\s*\d+\s*$/i)[0];
  const digits = main.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:${main.trim().startsWith('+') ? '+' : ''}${digits}`;
}

/** The most recent day the weekly run confirmed anything, i.e. when it last ran successfully. */
export function lastRanOn(
  competitors: Array<Pick<Competitor, 'last_verified_on'>>,
  items: Array<Pick<CompetitorActionItem, 'last_seen_on'>>,
): string | null {
  const days = [...competitors.map((row) => row.last_verified_on), ...items.map((row) => row.last_seen_on)];
  return days.reduce<string | null>((latest, day) => (latest === null || day > latest ? day : latest), null);
}

/** True when the weekly run has not saved anything for longer than a week and a few days. */
export function isWatchStale(lastRan: string | null, today: string = centralToday()): boolean {
  if (!lastRan) return false;
  const days = daysBetween(lastRan, today);
  return days !== null && days > STALE_AFTER_DAYS;
}
