import { supabase } from '../lib/supabase';

/**
 * Every customer-facing email that is scheduled but not yet sent, as the
 * admin console's Scheduled Emails page shows it — one merged list built
 * server-side (list-scheduled-emails) from job reminders, job follow-ups,
 * and the portal welcome series.
 *
 * Cancelling or resuming one is a plain write against the row it actually
 * came from, not a call back into that function: a reminder/follow-up
 * lives on the job that owns it, and a welcome step lives on its queue
 * row. Both already carry admin-only RLS, so there is nothing an edge
 * function would add here besides a second network round trip.
 */

export type ScheduledEmailKind = 'reminder' | 'followup' | 'welcome';
export type ScheduledEmailStatus = 'due' | 'scheduled' | 'cancelled' | 'blocked';

export interface ScheduledEmailRow {
  id: string;
  kind: ScheduledEmailKind;
  label: string;
  detail: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  sendAt: string | null;
  status: ScheduledEmailStatus;
  reason: string | null;
  timeZone: string;
  jobId?: string;
  queueId?: string;
}

export async function listScheduledEmails(): Promise<ScheduledEmailRow[]> {
  const { data, error } = await supabase.functions.invoke('list-scheduled-emails', { body: {} });

  if (error) {
    // On a non-2xx the Edge Function's JSON body (with a human-readable
    // `error`) is on error.context; surface that instead of the generic
    // "Edge Function returned a non-2xx status code".
    let message = error.message || 'Could not load scheduled emails';
    try {
      const errorBody = await (error as { context?: Response }).context?.json?.();
      if (errorBody?.error) message = errorBody.error;
    } catch {
      // fall back to the generic message
    }
    throw new Error(message);
  }

  if (!data?.emails) throw new Error('No response from the scheduled emails service');
  return data.emails as ScheduledEmailRow[];
}

/** Silences a job's day-before reminder without touching the job itself. */
export async function cancelJobReminder(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ customer_reminder_cancelled_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw new Error(error.message);
}

/** Puts a job's day-before reminder back on schedule. */
export async function resumeJobReminder(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ customer_reminder_cancelled_at: null })
    .eq('id', jobId);
  if (error) throw new Error(error.message);
}

/** Silences a job's post-job follow-up without touching the job itself. */
export async function cancelJobFollowup(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ follow_up_cancelled_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw new Error(error.message);
}

/** Puts a job's post-job follow-up back on schedule. */
export async function resumeJobFollowup(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ follow_up_cancelled_at: null })
    .eq('id', jobId);
  if (error) throw new Error(error.message);
}

/**
 * Pauses one step of a customer's portal welcome series. Its scheduled
 * time is left untouched, so resuming it later picks up right where it
 * would have been — instantly, if that time has already passed.
 */
export async function cancelWelcomeEmail(queueId: string): Promise<void> {
  const { error } = await supabase
    .from('portal_welcome_email_queue')
    .update({ status: 'cancelled' })
    .eq('id', queueId);
  if (error) throw new Error(error.message);
}

export async function resumeWelcomeEmail(queueId: string): Promise<void> {
  const { error } = await supabase
    .from('portal_welcome_email_queue')
    .update({ status: 'pending' })
    .eq('id', queueId);
  if (error) throw new Error(error.message);
}
