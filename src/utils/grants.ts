import type { BusinessGrant, GrantFunderScope } from '../types/grants';
// The explicit .ts is for the unit tests, which run this file on node directly.
import { centralToday, formatEndsOn } from './news.ts';

export const GRANT_SCOPE_LABELS: Record<GrantFunderScope, string> = {
  national: 'National',
  state: 'Tennessee',
  local: 'Local',
  federal: 'Federal',
};

/** Which tab a grant belongs on. */
export type GrantBucket = 'applied' | 'open' | 'upcoming' | 'closed';

/** A deadline this many days away or fewer is flagged as closing soon. */
export const CLOSING_SOON_DAYS = 14;
/** A grant counts as new for this many days after it was first saved. */
export const NEW_GRANT_DAYS = 7;
/** Past this many days without a re-check, the details are flagged as possibly stale. */
export const STALE_AFTER_DAYS = 3;

type DatedGrant = Pick<BusinessGrant, 'cycle_status' | 'deadline'> & Partial<Pick<BusinessGrant, 'applied_on'>>;

/** Whole days from one YYYY-MM-DD date to another. Null if either is not a date. */
export function daysBetween(from: string, to: string): number | null {
  const parse = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  };
  const start = parse(from);
  const end = parse(to);
  if (start === null || end === null) return null;
  return Math.round((end - start) / 86_400_000);
}

/**
 * The grant finder records what it saw on the day it looked. A deadline that
 * has passed since then closes the grant here without waiting for the next
 * run. The deadline day itself still counts as open, judged in Central time.
 */
export function grantBucket(grant: DatedGrant, today: string = centralToday()): GrantBucket {
  // Once applied, a grant stays on the Applied tab whatever its deadline does.
  if (grant.applied_on) return 'applied';
  if (grant.cycle_status === 'closed') return 'closed';
  if (grant.deadline && grant.deadline < today) return 'closed';
  return grant.cycle_status === 'upcoming' ? 'upcoming' : 'open';
}

/** Days left to apply, counting today as 0. Null when there is no deadline or it has passed. */
export function daysUntilDeadline(
  grant: Pick<BusinessGrant, 'deadline'>,
  today: string = centralToday(),
): number | null {
  if (!grant.deadline) return null;
  const days = daysBetween(today, grant.deadline);
  return days === null || days < 0 ? null : days;
}

export function isClosingSoon(grant: DatedGrant, today: string = centralToday()): boolean {
  if (grantBucket(grant, today) !== 'open') return false;
  const days = daysUntilDeadline(grant, today);
  return days !== null && days <= CLOSING_SOON_DAYS;
}

/** "Closes today", "Closes tomorrow" or "Closes in 9 days". Null when not closing soon. */
export function closingSoonLabel(grant: DatedGrant, today: string = centralToday()): string | null {
  if (!isClosingSoon(grant, today)) return null;
  const days = daysUntilDeadline(grant, today);
  if (days === 0) return 'Closes today';
  if (days === 1) return 'Closes tomorrow';
  return `Closes in ${days} days`;
}

/** First saved within the last week, judged by the Central-time day it was added. */
export function isNewGrant(
  grant: Pick<BusinessGrant, 'created_at'>,
  today: string = centralToday(),
): boolean {
  const added = new Date(grant.created_at);
  if (Number.isNaN(added.getTime())) return false;
  const days = daysBetween(centralToday(added), today);
  return days !== null && days >= 0 && days < NEW_GRANT_DAYS;
}

/** A short line to read at a glance, and the rest of what was said, if anything. */
export interface HeadlineParts {
  headline: string;
  detail: string | null;
}

/** A deadline note this short reads as the answer itself: "Rolling", "Not stated". */
const SHORT_NOTE_MAX = 28;

/**
 * The deadline in two parts: the date to read at a glance, and the funder's
 * extra wording (a cut-off time, how rounds repeat) as smaller text beside it.
 * With no date, a short note such as "Rolling" is the headline itself; a long
 * one sits under "No set date" so it is not set in large type.
 */
export function deadlineParts(grant: Pick<BusinessGrant, 'deadline' | 'deadline_note'>): HeadlineParts {
  const date = formatEndsOn(grant.deadline);
  const note = grant.deadline_note?.trim() || null;
  if (date) return { headline: date, detail: note };
  if (!note) return { headline: 'Not stated', detail: null };
  if (note.length <= SHORT_NOTE_MAX) return { headline: note, detail: null };
  return { headline: 'No set date', detail: note };
}

/**
 * For a grant that is not open yet, the opening date is the headline, so the
 * deadline goes in the small print under it, whole: the date, the funder's note
 * (a cut-off time, say), or both. A note with no date is kept too ("Rolling",
 * "Not stated"), so nothing known about the deadline is dropped from the card.
 */
export function upcomingDeadlineDetail(
  grant: Pick<BusinessGrant, 'deadline' | 'deadline_note'>,
): string | null {
  const date = formatEndsOn(grant.deadline);
  const note = grant.deadline_note?.trim() || null;
  if (date && note) return `Deadline ${date} (${note})`;
  if (date) return `Deadline ${date}`;
  if (note) return `Deadline: ${note}`;
  return null;
}

/** "U.S." and "D.C." end in a full stop without ending a sentence. */
const INITIALS_BEFORE = /(?:^|[\s(])(?:[A-Za-z]\.)+$/;
/** Common short forms that do the same. Compared without the final full stop. */
const ABBREVIATIONS = new Set([
  'inc', 'co', 'corp', 'ltd', 'no', 'st', 'mr', 'mrs', 'ms', 'dr', 'vs', 'etc', 'approx', 'est', 'dept',
]);

/** True when the full stop at `index` belongs to an abbreviation, not the end of a sentence. */
function isAbbreviationStop(text: string, index: number): boolean {
  if (text[index] !== '.') return false;
  const before = text.slice(0, index + 1);
  if (INITIALS_BEFORE.test(before)) return true;
  const word = /([A-Za-z]+)\.$/.exec(before)?.[1]?.toLowerCase();
  return word !== undefined && ABBREVIATIONS.has(word);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The amount as a headline figure and its small print. The grant finder writes
 * the award first and the detail after it ("$500 to one business each month;
 * monthly recipients are also considered for..."), and a whole sentence set in
 * large type is what made the card hard to read. The split is at the first
 * natural break. A comma inside a number ("$10,000") is not one, because a
 * break needs a space after it.
 */
export function splitAmount(amount: string): HeadlineParts {
  const text = amount.trim();
  let cut: { at: number; skip: number } | null = null;

  for (let index = 1; index < text.length - 1; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if ((char === ';' || char === ':' || char === ',') && next === ' ') {
      cut = { at: index, skip: 2 };
    } else if (char === '.' && next === ' ' && !isAbbreviationStop(text, index)) {
      cut = { at: index, skip: 2 };
    } else if (char === ' ' && next === '(') {
      // Keep the bracket with the detail, where it still reads as an aside.
      cut = { at: index, skip: 1 };
    }
    if (cut) break;
  }

  if (!cut) return { headline: text, detail: null };
  const headline = text.slice(0, cut.at).trim();
  const detail = text.slice(cut.at + cut.skip).trim();
  if (!headline || !detail) return { headline: text, detail: null };
  return { headline, detail: capitalize(detail) };
}

/** Sentence ends: a full stop, question or exclamation mark, then space, then a new start. */
const SENTENCE_BREAK = /[.!?]["')\]]?\s+(?=[A-Z0-9$"'(])/g;

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of text.matchAll(SENTENCE_BREAK)) {
    const stop = match.index;
    if (isAbbreviationStop(text, stop)) continue;
    const end = stop + match[0].trimEnd().length;
    sentences.push(text.slice(start, end).trim());
    start = stop + match[0].length;
  }
  sentences.push(text.slice(start).trim());
  return sentences.filter(Boolean);
}

/**
 * A block of grant text as separate points, so it can be read as a short list
 * instead of a paragraph.
 *
 * The grant finder writes one point per line. Text saved before it did, or by
 * hand, is a paragraph, which is split into its sentences instead. When in
 * doubt a sentence is left whole: "U.S." or "Inc." never starts a new point.
 */
export function toPoints(text: string | null | undefined): string[] {
  const value = text?.trim();
  if (!value) return [];

  const lines = value
    .split(/\r?\n+/)
    .map((line) => line.replace(/^\s*(?:[-*\u2022\u2013]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);

  return lines.length > 1 ? lines : splitSentences(lines[0] ?? value);
}

/** When an upcoming grant opens, or a plain statement that the funder has not said. */
export function formatGrantOpens(grant: Pick<BusinessGrant, 'opens_on'>): string {
  return formatEndsOn(grant.opens_on) ?? 'Date not announced';
}

/** True when the grant finder has not confirmed the details for a few days. */
export function isStale(
  grant: Pick<BusinessGrant, 'last_verified_on'>,
  today: string = centralToday(),
): boolean {
  const days = daysBetween(grant.last_verified_on, today);
  return days !== null && days > STALE_AFTER_DAYS;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

/** Nulls last, whichever direction the dates run. */
function compareDates(a: string | null, b: string | null, ascending: boolean): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return ascending ? a.localeCompare(b) : b.localeCompare(a);
}

/**
 * Open grants: soonest deadline first, so what needs doing next is on top, with
 * rolling and undated ones after. Upcoming: soonest opening first. Closed: most
 * recently closed first.
 */
export function sortGrants<
  T extends Pick<BusinessGrant, 'deadline' | 'opens_on' | 'name'> & Partial<Pick<BusinessGrant, 'applied_on'>>,
>(grants: T[], bucket: GrantBucket): T[] {
  return [...grants].sort((a, b) => {
    // Applied: most recently applied first.
    if (bucket === 'applied') {
      return (b.applied_on ?? '').localeCompare(a.applied_on ?? '') || compareText(a.name, b.name);
    }
    const byDate =
      bucket === 'upcoming'
        ? compareDates(a.opens_on, b.opens_on, true)
        : compareDates(a.deadline, b.deadline, bucket === 'open');
    return byDate || compareText(a.name, b.name);
  });
}

/** Case-insensitive match on the fields someone would search by. */
export function matchesGrantSearch(
  grant: Pick<BusinessGrant, 'name' | 'funder' | 'description' | 'eligibility' | 'amount'>,
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [grant.name, grant.funder, grant.description, grant.eligibility, grant.amount].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

/** The most recent day any grant was confirmed, i.e. when the finder last ran successfully. */
export function lastCheckedOn(grants: Array<Pick<BusinessGrant, 'last_verified_on'>>): string | null {
  return grants.reduce<string | null>(
    (latest, grant) => (latest === null || grant.last_verified_on > latest ? grant.last_verified_on : latest),
    null,
  );
}
