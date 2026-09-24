import { supabase } from '../lib/supabase';

/**
 * The post-job follow-up (Google review ask, referral code), as the admin
 * console sees it.
 *
 * Everything here is rendered by the `send-followup-email` edge function —
 * the same code path that actually mails the client. The browser
 * deliberately does not build its own copy of the email: a preview that
 * drifts from what sends is worse than no preview at all.
 */

export {
  describeFollowupStatus,
  formatFollowupInstant,
  type FollowupReason,
  type FollowupStatus,
  type JobFollowupPreview,
} from './jobFollowupLabels';

import type { JobFollowupPreview } from './jobFollowupLabels';

async function callFollowupFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('send-followup-email', { body });

  if (error) {
    // On a non-2xx the Edge Function's JSON body (with a human-readable
    // `error`) is on error.context; surface that instead of the generic
    // "Edge Function returned a non-2xx status code".
    let message = error.message || 'The follow-up service did not respond';
    try {
      const errorBody = await (error as { context?: Response }).context?.json?.();
      if (errorBody?.error) message = errorBody.error;
    } catch {
      // fall back to the generic message
    }
    throw new Error(message);
  }

  if (!data) throw new Error('No response from the follow-up service');
  return data as T;
}

/** What this job's client would receive, and whether it is going out. Sends nothing. */
export async function getJobFollowupPreview(jobId: string): Promise<JobFollowupPreview> {
  const data = await callFollowupFunction<{ preview?: JobFollowupPreview }>({
    jobId,
    preview: true,
  });

  if (!data.preview) throw new Error('The follow-up service returned no preview');
  return data.preview;
}

interface SendResult {
  /** Where it actually went — the client, or the signed-in admin for a test. */
  to: string | null;
}

function readSendResult(data: {
  sent?: number;
  results?: Array<{ sent: boolean; to?: string; reason?: string }>;
}): SendResult {
  const row = data.results?.[0];
  if (!data.sent || !row?.sent) {
    throw new Error(row?.reason ? `Not sent (${row.reason})` : 'The follow-up was not sent');
  }
  return { to: row.to ?? null };
}

/**
 * Sends this job's follow-up immediately, overriding the timing guard — for
 * a job that just wrapped up, or a re-send after fixing an address. Does not
 * override eligibility: a quoted, lost, or cancelled job, or one with no
 * usable email, still refuses.
 */
export async function sendJobFollowupNow(jobId: string): Promise<SendResult> {
  return readSendResult(await callFollowupFunction({ jobId, force: true }));
}

/**
 * Mails the exact same email to the signed-in admin instead of the client.
 * The recipient is read from the caller's own token on the server, so there
 * is no address to pass and no way to aim this at anyone else. The client's
 * follow-up is untouched and still owed.
 */
export async function sendJobFollowupTest(jobId: string): Promise<SendResult> {
  return readSendResult(await callFollowupFunction({ jobId, test: true }));
}
