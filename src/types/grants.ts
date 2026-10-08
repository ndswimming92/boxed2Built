/**
 * Who is giving the money. Mirrors the check constraint on `funder_scope`.
 * state — a Tennessee program. local — Spring Hill, Maury or Williamson County,
 * or the Nashville area.
 */
export type GrantFunderScope = 'national' | 'state' | 'local' | 'federal';

/**
 * open     — accepting applications.
 * upcoming — a real program that is between cycles or has not opened yet.
 * closed   — the cycle ended.
 *
 * This is what the grant finder last saw. A grant whose deadline has since
 * passed is treated as closed on the page whatever this says; see
 * `grantBucket` in src/utils/grants.ts.
 */
export type GrantCycleStatus = 'open' | 'upcoming' | 'closed';

/** One row of `business_grants`, written by the daily grant finder. */
export interface BusinessGrant {
  id: string;
  organization_id: string;
  name: string;
  /** The company or organization giving the grant. */
  funder: string;
  description: string;
  /** The award or range as the funder states it. */
  amount: string;
  /** Who can apply. */
  eligibility: string;
  /** Why it fits Boxed2Built, and what the owner has to confirm himself. */
  fit_notes: string | null;
  /** What the application asks for: an essay, a video, financials. */
  application_requirements: string | null;
  /** Spending restrictions, tax treatment, matching funds, reporting. */
  other_notes: string | null;
  /** Null when applying is free. */
  entry_fee: string | null;
  apply_url: string;
  funder_scope: GrantFunderScope;
  cycle_status: GrantCycleStatus;
  /** Last day to apply (YYYY-MM-DD). Null when rolling or not stated. */
  deadline: string | null;
  /** "Rolling", "Not stated", or detail such as a cut-off time. */
  deadline_note: string | null;
  /** Upcoming grants: when applications open (YYYY-MM-DD), if stated. */
  opens_on: string | null;
  /** The last day the grant finder confirmed these details (YYYY-MM-DD). */
  last_verified_on: string;
  created_at: string;
  updated_at: string;
}
