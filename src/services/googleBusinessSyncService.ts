import { supabase } from '../lib/supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface GoogleBusinessSyncResult {
  success?: boolean;
  error?: string;
}

export async function syncGoogleBusinessProfile(): Promise<GoogleBusinessSyncResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/sync-google-business-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: body?.error || 'Failed to sync to Google Business Profile' };
  }
  return { success: true };
}
