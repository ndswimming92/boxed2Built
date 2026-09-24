/**
 * How a job's post-job follow-up reads in the admin console.
 *
 * Split from jobFollowupService so it can be unit tested: that module
 * imports the Supabase client, which throws at import time without browser
 * env vars. Nothing here touches the network.
 */

/** Why a job is not getting a follow-up. Mirrors FollowupSkipReason on the server. */
export type FollowupReason =
  | 'no_scheduled_date'
  | 'no_end_time'
  | 'job_inactive'
  | 'status_not_eligible'
  | 'no_client_email'
  | 'already_sent'
  | 'too_early';

export type FollowupStatus = 'due' | 'scheduled' | 'sent' | 'blocked';

export interface JobFollowupPreview {
  subject: string;
  /** The email body. Rendered into a sandboxed iframe, never injected. */
  html: string;
  text: string;
  /** The client address it would go to, or null when there is not a usable one. */
  recipient: string | null;
  status: FollowupStatus;
  reason: FollowupReason | null;
  /** ISO instant the follow-up is or was due. */
  sendAt: string | null;
  sentAt: string | null;
  /** IANA zone, so both instants render on the business's clock rather than the viewer's. */
  timeZone: string;
}

/**
 * 'Fri, Sep 25 at 4:10 PM' on the business's clock.
 *
 * The zone matters: an admin checking from another state should read the
 * time the job actually ended, not the one their own laptop would show.
 */
export function formatFollowupInstant(iso: string, timeZone: string): string {
  const instant = new Date(iso);
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
const REASON_TEXT: Record<FollowupReason, string> = {
  no_scheduled_date: 'This job has no scheduled date yet.',
  no_end_time: 'This job has no end time set.',
  job_inactive: 'This job is archived.',
  status_not_eligible: 'Quoted, lost, or cancelled jobs don’t get a follow-up.',
  no_client_email: 'There is no usable email address on this job.',
  already_sent: 'This job has already been followed up on.',
  too_early: 'Not due yet.',
};

/** The one-line status the admin card leads with. */
export function describeFollowupStatus(preview: JobFollowupPreview): string {
  switch (preview.status) {
    case 'sent':
      return preview.sentAt
        ? `Sent ${formatFollowupInstant(preview.sentAt, preview.timeZone)}`
        : 'Already sent';
    case 'scheduled':
      return preview.sendAt
        ? `Goes out ${formatFollowupInstant(preview.sendAt, preview.timeZone)}`
        : 'Scheduled';
    case 'due':
      return 'Sending within the hour';
    case 'blocked':
    default:
      return preview.reason ? REASON_TEXT[preview.reason] : 'No follow-up will be sent.';
  }
}
