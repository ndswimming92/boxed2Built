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
export type GrantBucket = 'open' | 'upcoming' | 'closed';

/** A deadline this many days away or fewer is flagged as closing soon. */
export const CLOSING_SOON_DAYS = 14;
/** A grant counts as new for this many days after it was first saved. */
export const NEW_GRANT_DAYS = 7;
/** Past this many days without a re-check, the details are flagged as possibly stale. */
export const STALE_AFTER_DAYS = 3;

type DatedGrant = Pick<BusinessGrant, 'cycle_status' | 'deadline'>;

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

/**
 * The deadline as one line: the date, the funder's wording when there is no
 * date ("Rolling"), or both when the note adds detail to a date.
 */
export function formatGrantDeadline(grant: Pick<BusinessGrant, 'deadline' | 'deadline_note'>): string {
  const date = formatEndsOn(grant.deadline);
  const note = grant.deadline_note?.trim() || null;
  if (date && note) return `${date} (${note})`;
  return date ?? note ?? 'Not stated';
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
export function sortGrants<T extends Pick<BusinessGrant, 'deadline' | 'opens_on' | 'name'>>(
  grants: T[],
  bucket: GrantBucket,
): T[] {
  return [...grants].sort((a, b) => {
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
