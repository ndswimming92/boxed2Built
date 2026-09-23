/**
 * How a job's customer reminder reads in the admin console.
 *
 * Split from jobReminderService so it can be unit tested: that module imports
 * the Supabase client, which throws at import time without browser env vars.
 * Nothing here touches the network.
 */

/** Why a job is not getting a reminder. Mirrors ReminderSkipReason on the server. */
export type ReminderReason =
  | 'no_scheduled_date'
  | 'job_inactive'
  | 'status_not_remindable'
  | 'no_client_email'
  | 'already_reminded'
  | 'too_early'
  | 'job_already_started';

export type ReminderStatus = 'due' | 'scheduled' | 'sent' | 'blocked';

export interface JobReminderPreview {
  subject: string;
  /** The email body. Rendered into a sandboxed iframe, never injected. */
  html: string;
  text: string;
  /** The customer address it would go to, or null when there is not a usable one. */
  recipient: string | null;
  status: ReminderStatus;
  reason: ReminderReason | null;
  /** ISO instant the reminder is or was due. */
  sendAt: string | null;
  sentAt: string | null;
  /** IANA zone, so both instants render on the business's clock rather than the viewer's. */
  timeZone: string;
}

/**
 * 'Fri, Sep 25 at 5:00 PM' on the business's clock.
 *
 * The zone matters: an admin checking the schedule from another state should
 * read the time the customer was actually promised, not the one their own
 * laptop would show.
 */
export function formatReminderInstant(iso: string, timeZone: string): string {
  const instant = new Date(iso);
  // Date and time are formatted separately and joined with "at": toLocaleString
  // with both would give 'Fri, Sep 25, 5:00 PM', and "Goes out Fri, Sep 25,
  // 5:00 PM" is three commas deep before it reaches the useful part.
  const date = instant.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
  const time = instant.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
  return `${date} at ${time}`;
}

/** Why a blocked job is blocked, in words that say what to do about it. */
const REASON_TEXT: Record<ReminderReason, string> = {
  no_scheduled_date: 'This job has no scheduled date yet.',
  job_inactive: 'This job is archived.',
  status_not_remindable: 'Only jobs marked Scheduled or Accepted get a reminder.',
  no_client_email: 'There is no usable email address on this job.',
  already_reminded: 'The customer has already been reminded.',
  too_early: 'Not due yet.',
  job_already_started: 'The start time has already passed.',
};

/** The one-line status the admin card leads with. */
export function describeReminderStatus(preview: JobReminderPreview): string {
  switch (preview.status) {
    case 'sent':
      return preview.sentAt
        ? `Sent ${formatReminderInstant(preview.sentAt, preview.timeZone)}`
        : 'Already sent';
    case 'scheduled':
      return preview.sendAt
        ? `Goes out ${formatReminderInstant(preview.sendAt, preview.timeZone)}`
        : 'Scheduled';
    case 'due':
      return 'Sending within the hour';
    case 'blocked':
    default:
      return preview.reason ? REASON_TEXT[preview.reason] : 'No reminder will be sent.';
  }
}
