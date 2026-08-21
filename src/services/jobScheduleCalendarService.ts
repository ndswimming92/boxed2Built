import { supabase } from '../lib/supabase';

export interface SendJobScheduleEmailResult {
  success: boolean;
  /** True when the function decided no email was warranted (already sent, no date, inactive). */
  skipped?: boolean;
  reason?: string;
  sentAt?: string;
  sentTo?: string;
  rescheduled?: boolean;
  error?: string;
}

/**
 * Emails the calendar invite for a job's scheduled date.
 *
 * Safe to call on every save: the edge function only sends when the scheduled
 * date differs from the one it last notified about, so an unrelated edit to an
 * already-scheduled job is a no-op. Pass `force` for an explicit re-send.
 */
export async function sendJobScheduleEmail(
  jobId: string,
  force = false,
): Promise<SendJobScheduleEmailResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-job-schedule-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ jobId, force }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      return { success: false, error: json?.error ?? 'Failed to send calendar email.' };
    }

    return {
      success: true,
      skipped: json.skipped ?? false,
      reason: json.reason,
      sentAt: json.sentAt,
      sentTo: json.sentTo,
      rescheduled: json.rescheduled,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reach the calendar email service.';
    return { success: false, error: message };
  }
}

export interface CalendarFeedToken {
  id: string;
  token: string;
  label: string;
  is_active: boolean;
  last_accessed_at: string | null;
  created_at: string;
}

/** 32 hex characters of CSPRNG output — this token is the only credential on the feed URL. */
function generateFeedToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the org's active feed token, creating one on first use. The token is
 * only ever handed to the signed-in admin; anyone holding the URL can read the
 * schedule, so treat it like a password and use `rotateCalendarFeedToken` if it
 * leaks.
 */
export async function getOrCreateCalendarFeedToken(
  organizationId: string,
): Promise<CalendarFeedToken | null> {
  const { data: existing, error: selectError } = await supabase
    .from('calendar_feed_tokens')
    .select('id, token, label, is_active, last_accessed_at, created_at')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    console.error('Failed to read calendar feed token:', selectError);
    return null;
  }
  if (existing) return existing as CalendarFeedToken;

  const { data: { user } } = await supabase.auth.getUser();

  const { data: created, error: insertError } = await supabase
    .from('calendar_feed_tokens')
    .insert({
      organization_id: organizationId,
      token: generateFeedToken(),
      label: 'Job schedule',
      created_by: user?.id ?? null,
    })
    .select('id, token, label, is_active, last_accessed_at, created_at')
    .single();

  if (insertError) {
    console.error('Failed to create calendar feed token:', insertError);
    return null;
  }

  return created as CalendarFeedToken;
}

/** Revokes the current token and issues a new one. Existing subscribers stop updating. */
export async function rotateCalendarFeedToken(
  organizationId: string,
): Promise<CalendarFeedToken | null> {
  const { error: revokeError } = await supabase
    .from('calendar_feed_tokens')
    .update({ is_active: false })
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (revokeError) {
    console.error('Failed to revoke calendar feed tokens:', revokeError);
    return null;
  }

  return getOrCreateCalendarFeedToken(organizationId);
}

/** The https:// form — use this for "copy link". */
export function buildCalendarFeedUrl(token: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/job-calendar-feed?token=${encodeURIComponent(token)}`;
}

/**
 * The webcal:// form. Clicking it hands the feed straight to the desktop
 * calendar app instead of downloading a one-time copy of the file.
 */
export function buildCalendarSubscribeUrl(token: string): string {
  return buildCalendarFeedUrl(token).replace(/^https?:\/\//, 'webcal://');
}
