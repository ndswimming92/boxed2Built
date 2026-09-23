import { supabase } from '../lib/supabase';

/**
 * The customer's day-before appointment reminder, as the admin console sees it.
 *
 * Everything here is rendered by the `send-customer-job-reminders` edge
 * function — the same code path that actually mails the customer. The browser
 * deliberately does not build its own copy of the email: a preview that drifts
 * from what sends is worse than no preview at all.
 */

export {
  describeReminderStatus,
  formatReminderInstant,
  type JobReminderPreview,
  type ReminderReason,
  type ReminderStatus,
} from './jobReminderLabels';

import type { JobReminderPreview } from './jobReminderLabels';

async function callReminderFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('send-customer-job-reminders', { body });

  if (error) {
    // On a non-2xx the Edge Function's JSON body (with a human-readable `error`)
    // is on error.context; surface that instead of the generic
    // "Edge Function returned a non-2xx status code".
    let message = error.message || 'The reminder service did not respond';
    try {
      const errorBody = await (error as { context?: Response }).context?.json?.();
      if (errorBody?.error) message = errorBody.error;
    } catch {
      // fall back to the generic message
    }
    throw new Error(message);
  }

  if (!data) throw new Error('No response from the reminder service');
  return data as T;
}

/** What this job's customer would receive, and whether it is going out. Sends nothing. */
export async function getJobReminderPreview(jobId: string): Promise<JobReminderPreview> {
  const data = await callReminderFunction<{ preview?: JobReminderPreview }>({
    jobId,
    preview: true,
  });

  if (!data.preview) throw new Error('The reminder service returned no preview');
  return data.preview;
}

interface SendResult {
  /** Where it actually went — the customer, or the signed-in admin for a test. */
  to: string | null;
}

function readSendResult(data: {
  sent?: number;
  results?: Array<{ sent: boolean; to?: string; reason?: string }>;
}): SendResult {
  const row = data.results?.[0];
  if (!data.sent || !row?.sent) {
    throw new Error(row?.reason ? `Not sent (${row.reason})` : 'The reminder was not sent');
  }
  return { to: row.to ?? null };
}

/**
 * Sends the customer's reminder immediately, overriding the timing guards — for
 * a job booked too late for the usual 5pm slot, or a re-send after fixing an
 * address. Does not override eligibility: a cancelled job or one with no usable
 * email still refuses.
 */
export async function sendJobReminderNow(jobId: string): Promise<SendResult> {
  return readSendResult(await callReminderFunction({ jobId, force: true }));
}

/**
 * Mails the exact same email to the signed-in admin instead of the customer.
 * The recipient is read from the caller's own token on the server, so there is
 * no address to pass and no way to aim this at anyone else. The customer's
 * reminder is untouched and still owed.
 */
export async function sendJobReminderTest(jobId: string): Promise<SendResult> {
  return readSendResult(await callReminderFunction({ jobId, test: true }));
}
