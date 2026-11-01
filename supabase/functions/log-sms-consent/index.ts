import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { UUID_PATTERN } from '../_shared/salesSubscribers.ts';
import { sendCustomerSms } from '../_shared/sentSms.ts';
import { idempotencyKey, toUsE164 } from '../_shared/smsConsent.ts';

/**
 * Writes one audit row when a customer ticks the SMS consent box.
 *
 *   POST { inquiry_id, page_url, consent_version }   from the service form
 *
 * Runs with verify_jwt = false (see supabase/config.toml): visitors have no
 * session. The browser only names the request. Everything about the consent
 * itself (name, phone, which box, the wording, the time) is read back from the
 * inquiry the form just saved, so a caller cannot invent a consent record. This
 * function adds what only the server can see: the IP address and browser.
 * One opt-in row per inquiry; a repeat call is a no-op.
 *
 * The first time a service opt-in is logged, it also texts the customer that the
 * request arrived (see textRequestReceived below).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// An inquiry is only loggable for a short time after it is saved.
const MAX_AGE_MS = 15 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const clip = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

function clientIp(req: Request): string | null {
  const direct = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip');
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0];
  return clip(direct ?? forwarded, 64);
}

// Anyone can type any number into the form and tick the box, so a number gets at
// most one of these a day, and one address cannot set off a run of them.
const NUMBER_WINDOW_MS = 24 * 60 * 60 * 1000;
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_OPT_INS_PER_WINDOW = 3;

interface InquiryForText {
  id: string;
  client_name: string | null;
  client_phone: string | null;
}

/** Texts the customer that their request arrived. Returns what happened, for the logs. */
async function textRequestReceived(
  admin: SupabaseClient,
  inquiry: InquiryForText,
  confirmationCode: string | null,
  ip: string | null,
): Promise<string> {
  if (!confirmationCode) return 'skipped: no confirmation code';
  const to = toUsE164(inquiry.client_phone);
  if (!to) return 'skipped: invalid phone';

  const { count: toNumber, error: numberError } = await admin
    .from('sent_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'message.requested')
    .eq('contact_phone', to)
    .filter('payload->>purpose', 'eq', 'request_received')
    .gte('created_at', new Date(Date.now() - NUMBER_WINDOW_MS).toISOString());
  if (numberError) return 'skipped: could not check the number limit';
  if ((toNumber ?? 0) > 0) return 'skipped: number already texted today';

  if (ip) {
    // The opt-in just logged counts itself, so more than the limit means this one is over it.
    const { count: fromIp, error: ipError } = await admin
      .from('sms_consent_log')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'opt_in')
      .eq('ip_address', ip)
      .gte('created_at', new Date(Date.now() - IP_WINDOW_MS).toISOString());
    if (ipError) return 'skipped: could not check the address limit';
    if ((fromIp ?? 0) > IP_OPT_INS_PER_WINDOW) return 'skipped: too many sign-ups from one address';
  }

  const outcome = await sendCustomerSms(admin, {
    purpose: 'request_received',
    phone: inquiry.client_phone,
    parameters: {
      customerName: (inquiry.client_name ?? '').trim().split(/\s+/)[0] || 'there',
      confirmationCode,
    },
    idempotencyKey: idempotencyKey('request', inquiry.id),
    context: { inquiryId: inquiry.id },
  });
  return outcome.sent ? `sent${outcome.sandbox ? ' (test mode)' : ''}` : `not sent: ${outcome.reason ?? 'unknown'}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const inquiryId = typeof body.inquiry_id === 'string' ? body.inquiry_id : '';
  if (!UUID_PATTERN.test(inquiryId)) return json({ success: false, error: 'Invalid inquiry' }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: inquiry, error } = await admin
    .from('form_inquiries')
    .select(
      'id, organization_id, business_id, client_name, client_email, client_phone, is_test, sms_opt_in, sms_marketing_opt_in, sms_consent_text, sms_consent_timestamp, created_at',
    )
    .eq('id', inquiryId)
    .maybeSingle();

  if (error || !inquiry) return json({ success: false, error: 'Inquiry not found' }, 404);
  const serviceTexts = inquiry.sms_opt_in === true;
  const marketingTexts = inquiry.sms_marketing_opt_in === true;
  if ((!serviceTexts && !marketingTexts) || !inquiry.client_phone) return json({ success: true, logged: false });
  if (Date.now() - new Date(inquiry.created_at).getTime() > MAX_AGE_MS) {
    return json({ success: false, error: 'Inquiry too old' }, 400);
  }

  const { data: saved } = await admin
    .from('saved_requests')
    .select('confirmation_code')
    .eq('inquiry_id', inquiryId)
    .maybeSingle();

  const { error: insertError } = await admin.from('sms_consent_log').insert({
    event_type: 'opt_in',
    organization_id: inquiry.organization_id,
    business_id: inquiry.business_id,
    inquiry_id: inquiry.id,
    confirmation_code: saved?.confirmation_code ?? null,
    name: inquiry.client_name,
    email: inquiry.client_email,
    phone: inquiry.client_phone,
    phone_digits: String(inquiry.client_phone).replace(/\D/g, '').slice(-10),
    service_texts: serviceTexts,
    marketing_texts: marketingTexts,
    consent_text: inquiry.sms_consent_text,
    consent_version: clip(body.consent_version, 40),
    consent_given_at: inquiry.sms_consent_timestamp,
    source_page: clip(body.page_url, 500),
    ip_address: clientIp(req),
    user_agent: clip(req.headers.get('user-agent'), 500),
    recorded_by: 'website',
  });

  // 23505 is the one-opt-in-per-inquiry index: already logged, which is fine.
  if (insertError && insertError.code !== '23505') {
    console.error('[log-sms-consent] insert failed:', insertError);
    return json({ success: false, error: 'Could not record consent' }, 500);
  }

  // The first time consent is logged for a request, confirm it by text. A repeat
  // call hits the one-opt-in-per-inquiry index above and never texts, so a request
  // gets at most one. Only the service box covers it; a test inquiry never texts.
  // The outcome stays in the logs: this endpoint is open to anonymous visitors and
  // must not reveal whether a given number can be texted.
  if (!insertError && serviceTexts && inquiry.is_test !== true) {
    const outcome = await textRequestReceived(admin, inquiry, saved?.confirmation_code ?? null, clientIp(req));
    console.log(`[log-sms-consent] request text for ${inquiry.id}: ${outcome}`);
  }
  return json({ success: true, logged: true });
});
