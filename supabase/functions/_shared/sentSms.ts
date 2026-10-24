import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  type ConsentLogRow,
  type KeywordStatusRow,
  decideSmsConsent,
  phoneDigits,
  smsValue,
  toUsE164,
} from './smsConsent.ts';

/**
 * Sends a customer text through Sent (sent.dm) from an approved template.
 *
 * Every text rides alongside an email that already went out, so this never
 * throws: a text that cannot go is reported in the outcome and logged, and the
 * caller carries on. Nothing is sent to a number without a service opt-in on
 * record (see smsConsent.ts).
 *
 * Configuration (Supabase -> Edge Functions -> Secrets):
 *   SENT_DM_API_KEY          sk_test_... for now, sk_live_... once the campaign is approved
 *   SENT_SMS_LIVE            "true" to really send; anything else sends in sandbox mode,
 *                            which Sent validates and answers but never delivers
 *   SENT_TEMPLATE_*          the template ID for each purpose (see TEMPLATE_ENV)
 * A purpose whose template ID is not set is skipped, so texts can be turned on
 * one at a time.
 */

export type SmsPurpose = 'booking_confirmed' | 'job_reminder' | 'quote_ready' | 'invoice_ready';

const TEMPLATE_ENV: Record<SmsPurpose, string> = {
  booking_confirmed: 'SENT_TEMPLATE_BOOKING_CONFIRMED',
  job_reminder: 'SENT_TEMPLATE_JOB_REMINDER',
  quote_ready: 'SENT_TEMPLATE_QUOTE_READY',
  invoice_ready: 'SENT_TEMPLATE_INVOICE_READY',
};

export type SmsSkipReason =
  | 'not_configured'
  | 'no_phone'
  | 'invalid_phone'
  | 'no_opt_in'
  | 'opted_out'
  | 'consent_lookup_failed'
  | 'send_failed';

export interface SmsOutcome {
  sent: boolean;
  reason?: SmsSkipReason;
  sandbox?: boolean;
  messageId?: string;
  /** Sent's error code when it refused the send, e.g. BUSINESS_004. */
  errorCode?: string;
}

export interface SmsRequest {
  purpose: SmsPurpose;
  phone: string | null | undefined;
  /** Template variables by name. Values are flattened to what Sent accepts. */
  parameters: Record<string, string | null | undefined>;
  /** Stable per real-world send, so a retried request can never text twice. */
  idempotencyKey: string;
  /** Stored with the send record, e.g. { jobId } or { invoiceId }. */
  context: Record<string, unknown>;
}

const SENT_MESSAGES_URL = 'https://api.sent.dm/v3/messages';

export async function sendCustomerSms(admin: SupabaseClient, request: SmsRequest): Promise<SmsOutcome> {
  const tag = `[sms:${request.purpose}]`;
  try {
    const apiKey = Deno.env.get('SENT_DM_API_KEY')?.trim();
    const templateId = Deno.env.get(TEMPLATE_ENV[request.purpose])?.trim();
    if (!apiKey || !templateId) return { sent: false, reason: 'not_configured' };

    if (!request.phone?.trim()) return { sent: false, reason: 'no_phone' };
    const to = toUsE164(request.phone);
    if (!to) return { sent: false, reason: 'invalid_phone' };

    const digits = phoneDigits(to);
    const [logResult, statusResult] = await Promise.all([
      admin
        .from('sms_consent_log')
        .select('event_type, service_texts, consent_given_at, created_at')
        .eq('phone_digits', digits)
        .returns<ConsentLogRow[]>(),
      admin
        .from('sms_contact_status')
        .select('opted_out, last_signal_at')
        .eq('phone_digits', digits)
        .returns<KeywordStatusRow[]>(),
    ]);
    if (logResult.error || statusResult.error) {
      console.error(tag, 'consent lookup failed', logResult.error ?? statusResult.error);
      return { sent: false, reason: 'consent_lookup_failed' };
    }

    const consent = decideSmsConsent(logResult.data ?? [], statusResult.data ?? []);
    if (!consent.allowed) return { sent: false, reason: consent.reason };

    const sandbox = Deno.env.get('SENT_SMS_LIVE')?.trim().toLowerCase() !== 'true';
    const parameters = Object.fromEntries(
      Object.entries(request.parameters).map(([name, value]) => [name, smsValue(value, name.endsWith('Link') ? 500 : 120)]),
    );

    const response = await fetch(SENT_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': request.idempotencyKey,
      },
      body: JSON.stringify({
        to: [to],
        channel: ['sms'],
        template: { id: templateId, parameters },
        ...(sandbox ? { sandbox: true } : {}),
      }),
    });

    const body = await response.json().catch(() => null) as
      | { success?: boolean; data?: { status?: string; recipients?: Array<{ message_id?: string }> }; error?: { code?: string; message?: string } }
      | null;

    if (!response.ok || body?.success === false) {
      console.error(tag, 'Sent refused the send', response.status, body?.error?.code, body?.error?.message);
      return { sent: false, reason: 'send_failed', sandbox, errorCode: body?.error?.code };
    }

    const messageId = body?.data?.recipients?.[0]?.message_id;

    // Recorded beside the webhook's delivery events for the same message_id, so
    // a delivery update can be traced back to the job or invoice it was about.
    const { error: logError } = await admin.from('sent_events').insert({
      sent_event_id: messageId && !sandbox ? `send-${messageId}` : `send-${request.idempotencyKey}`,
      field: 'message',
      event_type: 'message.requested',
      message_id: messageId ?? null,
      contact_phone: to,
      channel: 'sms',
      status: body?.data?.status ?? null,
      occurred_at: new Date().toISOString(),
      payload: { source: 'app', purpose: request.purpose, template_id: templateId, sandbox, ...request.context },
    });
    // 23505: the same send was recorded by an earlier attempt.
    if (logError && logError.code !== '23505') console.error(tag, 'could not record the send', logError);

    return { sent: true, sandbox, messageId };
  } catch (error) {
    console.error(tag, 'unexpected error', error);
    return { sent: false, reason: 'send_failed' };
  }
}
