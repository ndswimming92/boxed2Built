import { supabase } from '../lib/supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface GoogleBusinessSyncResult {
  success?: boolean;
  error?: string;
  /** Account name Google returned, when the call resolved one. */
  accountLabel?: string | null;
}

async function callSyncFunction(
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<GoogleBusinessSyncResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/sync-google-business-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: payload?.error || fallbackError };
  }
  return { success: true, accountLabel: payload?.account_label ?? null };
}

export async function syncGoogleBusinessProfile(): Promise<GoogleBusinessSyncResult> {
  return callSyncFunction({}, 'Failed to sync to Google Business Profile');
}

/**
 * Re-checks the connection without pushing anything to Google. This is how a
 * connection recovers the account details its connect-time lookup missed while
 * Google's Basic API Access approval was still pending — no reconnect needed.
 */
export async function checkGoogleBusinessConnection(): Promise<GoogleBusinessSyncResult> {
  return callSyncFunction({ probe: true }, 'Failed to check the Google Business Profile connection');
}
