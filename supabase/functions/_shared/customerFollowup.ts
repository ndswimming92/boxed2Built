/**
 * When the customer's post-job "thanks, here's a review link" email goes out,
 * and whether a given job has earned one yet.
 *
 * Kept free of Deno and Supabase imports so `tests/unit` can exercise the
 * timing rules directly — the decision this module makes is the whole feature,
 * and it is not something worth discovering in production.
 */

import { zonedToUtc } from './ics.ts';
import { normalizeScheduleTime } from './scheduleLabels.ts';

/**
 * Values that live in `client_email` but are not addresses. Same list
 * customerReminder.ts rejects.
 */
const PLACEHOLDER_EMAILS = new Set([
  'na',
  'n/a',
  'none',
  'null',
  '-',
  'test@test.com',
  'test@example.com',
]);

/**
 * A job whose customer has earned a follow-up: it happened or is happening,
 * as opposed to one that is still just a quote, or one that was lost or
 * cancelled.
 */
const FOLLOWUP_ELIGIBLE_STATUSES = new Set(['scheduled', 'accepted', 'in_progress', 'completed']);

/**
 * Deliberately loose: the job is to catch "NA" and "555-1234" typed into an
 * email field, not to out-guess the mail server on what it will accept.
 */
export function isSendableEmail(value: string | null | undefined): boolean {
  const email = value?.trim().toLowerCase() ?? '';
  if (!email || PLACEHOLDER_EMAILS.has(email)) return false;
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(email);
}

/**
 * The instant a job's scheduled work is done: `endTime` local time on
 * `dateScheduled`. DST-safe via zonedToUtc, so a job ending right around a
 * clock change still gets followed up at the wall-clock time on the job.
 */
export function jobEndInstant(dateScheduled: string, endTime: string, timeZone: string): Date {
  return zonedToUtc(dateScheduled.slice(0, 10), normalizeScheduleTime(endTime)!, timeZone);
}

export interface FollowupJobFacts {
  dateScheduled: string | null;
  scheduledEndTime: string | null;
  clientEmail: string | null;
  isActive: boolean;
  jobStatus: string | null;
  /** date_scheduled the last follow-up covered; null when never sent. */
  followUpForDate: string | null;
  /** scheduled_end_time last followed up for, so a same-day time change re-sends. */
  followUpForEndTime: string | null;
  /** Set from the admin console to silence this job's follow-up. Null means not cancelled. */
  followUpCancelledAt?: string | null;
}

export type FollowupSkipReason =
  | 'no_scheduled_date'
  | 'no_end_time'
  | 'job_inactive'
  | 'status_not_eligible'
  | 'no_client_email'
  | 'cancelled'
  | 'already_sent'
  | 'too_early';

export type FollowupDecision =
  | { send: true; sendAt: Date }
  /** `sendAt` is present whenever the job has a date and an end time, even on a refusal. */
  | { send: false; reason: FollowupSkipReason; sendAt?: Date };

export interface FollowupOptions {
  now: Date;
  timeZone: string;
  /**
   * A human pressing "Send it now". It overrides the one timing guard —
   * already sent, not yet due — because the person clicking can see the job
   * and the clock. It never overrides the eligibility guards: no date, no
   * end time, inactive, wrong status, or no usable email mean the email is
   * wrong to send rather than merely early, and no button should force one.
   */
  force?: boolean;
}

/**
 * Whether this job's customer gets a follow-up email on this tick.
 *
 * The send window is open-ended on purpose — `now >= sendAt` rather than a
 * narrow band around it. A job whose end time passed while a sweep was down,
 * or was edited to an earlier time after that time had already come, still
 * gets its follow-up on the next tick rather than never.
 */
export function decideFollowup(job: FollowupJobFacts, options: FollowupOptions): FollowupDecision {
  const { now, timeZone, force = false } = options;

  // Eligibility first: these say the email is wrong, not early, so `force`
  // does not reach them and none of them can report a sendAt.
  if (!job.dateScheduled) return { send: false, reason: 'no_scheduled_date' };
  if (!job.isActive) return { send: false, reason: 'job_inactive' };
  if (!FOLLOWUP_ELIGIBLE_STATUSES.has(job.jobStatus?.trim().toLowerCase() ?? '')) {
    return { send: false, reason: 'status_not_eligible' };
  }
  if (!isSendableEmail(job.clientEmail)) return { send: false, reason: 'no_client_email' };
  if (!normalizeScheduleTime(job.scheduledEndTime)) return { send: false, reason: 'no_end_time' };

  // Every refusal past this point can say when the email was or is due, which
  // is what the admin preview puts on screen.
  const sendAt = jobEndInstant(job.dateScheduled, job.scheduledEndTime!, timeZone);

  // Cancelling is a deliberate override of the client's inbox from the admin
  // console, so it sits ahead of `force`: nothing short of clearing the column
  // (resuming it) brings this follow-up back, not even "send it now".
  if (job.followUpCancelledAt) return { send: false, reason: 'cancelled', sendAt };

  if (force) return { send: true, sendAt };

  // A reschedule changes one of these two, which is what makes the customer
  // worth mailing a second time. Times are normalized because Postgres
  // returns 'HH:MM:SS' where the Jobs form sends 'HH:MM'.
  const alreadySent =
    job.followUpForDate === job.dateScheduled &&
    normalizeScheduleTime(job.followUpForEndTime) === normalizeScheduleTime(job.scheduledEndTime);
  if (alreadySent) return { send: false, reason: 'already_sent', sendAt };

  if (now < sendAt) return { send: false, reason: 'too_early', sendAt };

  return { send: true, sendAt };
}
