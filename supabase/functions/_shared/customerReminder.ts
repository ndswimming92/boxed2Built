/**
 * When the customer's "your appointment is tomorrow" email goes out, and
 * whether a given job has earned one yet.
 *
 * Kept free of Deno and Supabase imports so `tests/unit` can exercise the
 * timing rules directly — the decision this module makes is the whole feature,
 * and it is not something worth discovering in production.
 */

import { addDays, zonedToUtc } from './ics.ts';
import { normalizeScheduleTime } from './scheduleLabels.ts';

/**
 * Local wall-clock time, the day before the job, that the reminder aims for.
 * Evening on purpose: the customer is home, reads it, and still has the whole
 * evening to reply if the address or the time is wrong.
 */
export const DEFAULT_SEND_HOUR = '17:00';

/**
 * Values that live in `client_email` but are not addresses. Same list the
 * client-bucketing migration (20260218221848) rejects, plus the seed addresses
 * `upsert_client_by_email` refuses — mailing either is worse than not mailing.
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

/** Only a job that is actually going to happen is worth reminding anyone about. */
const REMINDABLE_STATUSES = new Set(['scheduled', 'accepted']);

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
 * The instant the reminder for `dateScheduled` should go out: `sendHour` local
 * time on the previous day. DST-safe via zonedToUtc, so the evening before a
 * spring-forward job is still the evening before.
 */
export function reminderSendAt(
  dateScheduled: string,
  timeZone: string,
  sendHour: string = DEFAULT_SEND_HOUR,
): Date {
  return zonedToUtc(addDays(dateScheduled.slice(0, 10), -1), sendHour, timeZone);
}

/**
 * When the job itself begins. A job with no start time is treated as starting
 * at local midnight, so a reminder never lands on the morning of a day-long
 * job that is already underway.
 */
export function jobStartInstant(
  dateScheduled: string,
  startTime: string | null | undefined,
  timeZone: string,
): Date {
  return zonedToUtc(dateScheduled.slice(0, 10), normalizeScheduleTime(startTime) ?? '00:00', timeZone);
}

export interface ReminderJobFacts {
  dateScheduled: string | null;
  scheduledStartTime: string | null;
  clientEmail: string | null;
  isActive: boolean;
  jobStatus: string | null;
  /** Date the customer was last reminded for; null when never. */
  reminderFor: string | null;
  /** Start time last reminded for, so a same-day time change re-sends. */
  reminderStartTime: string | null;
  /** Set from the admin console to silence this job's reminder. Null means not cancelled. */
  reminderCancelledAt?: string | null;
}

export type ReminderSkipReason =
  | 'no_scheduled_date'
  | 'job_inactive'
  | 'status_not_remindable'
  | 'no_client_email'
  | 'cancelled'
  | 'already_reminded'
  | 'too_early'
  | 'job_already_started';

export type ReminderDecision =
  | { send: true; sendAt: Date }
  /** `sendAt` is present whenever the job has a date, even on a refusal. */
  | { send: false; reason: ReminderSkipReason; sendAt?: Date };

export interface ReminderOptions {
  now: Date;
  timeZone: string;
  sendHour?: string;
  /**
   * A human pressing "Send it now". It overrides the three timing guards —
   * already reminded, not yet due, job already under way — because the person
   * clicking can see the job and the clock. It never overrides the eligibility
   * guards: no date, inactive, wrong status, or no usable email mean the email
   * is wrong to send rather than merely early, and no button should force one.
   */
  force?: boolean;
}

/**
 * Whether this job's customer gets an email on this tick.
 *
 * The send window is open-ended on purpose — `now >= sendAt` rather than a
 * narrow band around it. A job booked at 9pm for tomorrow, or a job whose date
 * moves after the evening has passed, has a send time already behind it; the
 * next hourly tick still mails it. That is what "at least the day before"
 * costs: when it cannot be a day, it is as soon as possible instead.
 */
export function decideReminder(
  job: ReminderJobFacts,
  options: ReminderOptions,
): ReminderDecision {
  const { now, timeZone, sendHour = DEFAULT_SEND_HOUR, force = false } = options;

  // Eligibility first: these say the email is wrong, not early, so `force` does
  // not reach them and none of them can report a sendAt.
  if (!job.dateScheduled) return { send: false, reason: 'no_scheduled_date' };
  if (!job.isActive) return { send: false, reason: 'job_inactive' };
  if (!REMINDABLE_STATUSES.has(job.jobStatus?.trim().toLowerCase() ?? '')) {
    return { send: false, reason: 'status_not_remindable' };
  }
  if (!isSendableEmail(job.clientEmail)) return { send: false, reason: 'no_client_email' };

  // Every refusal past this point can say when the email was or is due, which is
  // what the admin preview puts on screen.
  const sendAt = reminderSendAt(job.dateScheduled, timeZone, sendHour);

  // Cancelling is a deliberate override of the customer's inbox from the admin
  // console, so it sits ahead of `force`: nothing short of clearing the column
  // (resuming it) brings this reminder back, not even "send it now".
  if (job.reminderCancelledAt) return { send: false, reason: 'cancelled', sendAt };

  if (force) return { send: true, sendAt };

  // A reschedule changes one of these two, which is what makes the customer
  // worth mailing a second time. Times are normalized because Postgres returns
  // 'HH:MM:SS' where the Jobs form sends 'HH:MM'.
  const alreadyReminded =
    job.reminderFor === job.dateScheduled &&
    normalizeScheduleTime(job.reminderStartTime) === normalizeScheduleTime(job.scheduledStartTime);
  if (alreadyReminded) return { send: false, reason: 'already_reminded', sendAt };

  // Past the start, the email is no longer a reminder — it is a receipt for a
  // visit already in progress. Checked before `too_early` so a same-day job
  // that has begun reports the honest reason.
  if (now >= jobStartInstant(job.dateScheduled, job.scheduledStartTime, timeZone)) {
    return { send: false, reason: 'job_already_started', sendAt };
  }

  if (now < sendAt) return { send: false, reason: 'too_early', sendAt };

  return { send: true, sendAt };
}

/**
 * 'tomorrow' / 'today' when the job falls on one of them in the business's own
 * timezone, null otherwise. Drives the lead-in only; every email still prints
 * the full date, so a null here costs nothing.
 */
export function describeProximity(
  dateScheduled: string,
  timeZone: string,
  now: Date,
): 'today' | 'tomorrow' | null {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const date = dateScheduled.slice(0, 10);
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  return null;
}
