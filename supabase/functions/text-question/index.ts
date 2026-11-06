import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendCustomerSms } from '../_shared/sentSms.ts';
import { adminInquiryLink, idempotencyKey, toUsE164, withoutLinks } from '../_shared/smsConsent.ts';

/**
 * "Text us a question" button on the public site.
 *
 *   POST { name, phone, message, consent, website, page_url }
 *
 * verify_jwt = false (see supabase/config.toml): visitors have no session. All
 * the work happens here with the service role, so the browser never writes to
 * the database directly. The message is saved as an inquiry (source
 * 'text_widget'), the visitor's consent to be texted back is logged, and the
 * owner gets a text through the existing new_request_alert template.
 *
 * Abuse controls: a hidden honeypot field, a per-address hourly limit, a
 * per-number daily limit, length caps, and an explicit consent tick.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const CONSENT_VERSION = 'text-widget-2026-11-06';
const CONSENT_TEXT =
  'I agree to receive a text message reply from Boxed2Built at this number about my question. Msg&data rates may apply. Reply STOP to opt out. Consent is not a condition of purchase.';
const NO_EMAIL = 'no-email@text-question.boxed2built.com';
const IP_PER_HOUR = 5;
const PHONE_PER_DAY = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const clip = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid request' }, 400);
  }

  // Bots fill the hidden field; pretend it worked so they learn nothing.
  if (clip(body.website, 200)) return json({ success: true });

  const name = clip(body.name, 100);
  const message = clip(body.message, 600);
  const to = toUsE164(clip(body.phone, 30));
  if (!name || message.length < 3 || !to || body.consent !== true) {
    return json({ success: false, error: 'Please fill in your name, a valid US phone number, your question, and tick the consent box.' }, 400);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const ip = clip(
    req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0],
    64,
  ) || 'unknown';
  const digits = to.replace(/\D/g, '').slice(-10);

  // Per-address hourly limit, using the same audit table as the other public forms.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: ipCount } = await admin
    .from('admin_audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'text_question_submit')
    .eq('entity_id', ip)
    .gte('created_at', hourAgo);
  if ((ipCount ?? 0) >= IP_PER_HOUR) return json({ success: false, error: 'Too many messages. Please try again later.' }, 429);

  // Per-number daily limit.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: phoneCount } = await admin
    .from('sms_consent_log')
    .select('id', { count: 'exact', head: true })
    .eq('phone_digits', digits)
    .eq('consent_version', CONSENT_VERSION)
    .gte('created_at', dayAgo);
  if ((phoneCount ?? 0) >= PHONE_PER_DAY) return json({ success: false, error: 'Too many messages from this number today.' }, 429);

  await admin.from('admin_audit_logs').insert({
    action: 'text_question_submit',
    entity_type: 'ip',
    entity_id: ip,
    details: {},
  });

  const { data: business } = await admin
    .from('business_info')
    .select('id, organization_id')
    .eq('is_active', true)
    .maybeSingle();
  if (!business) return json({ success: false, error: 'Unavailable right now' }, 503);

  const now = new Date().toISOString();
  const inquiryId = crypto.randomUUID();
  const { error: inquiryError } = await admin.from('form_inquiries').insert({
    id: inquiryId,
    business_id: business.id,
    organization_id: business.organization_id,
    client_name: name,
    client_email: NO_EMAIL,
    client_phone: to,
    furniture_type: 'Text Question',
    pieces: 1,
    notes: message,
    source: 'text_widget',
    status: 'pending',
    sms_opt_in: true,
    sms_marketing_opt_in: false,
    sms_consent_text: CONSENT_TEXT,
    sms_consent_timestamp: now,
  });
  if (inquiryError) {
    console.error('[text-question] inquiry insert failed', inquiryError);
    return json({ success: false, error: 'Could not send your message. Please call us instead.' }, 500);
  }

  const { error: consentError } = await admin.from('sms_consent_log').insert({
    event_type: 'opt_in',
    organization_id: business.organization_id,
    business_id: business.id,
    inquiry_id: inquiryId,
    name,
    email: null,
    phone: to,
    phone_digits: digits,
    service_texts: true,
    marketing_texts: false,
    consent_text: CONSENT_TEXT,
    consent_version: CONSENT_VERSION,
    consent_given_at: now,
    source_page: clip(body.page_url, 500) || null,
    ip_address: ip,
    user_agent: clip(req.headers.get('user-agent'), 500) || null,
    recorded_by: 'website',
  });
  if (consentError) console.error('[text-question] consent log failed', consentError);

  // Text the owner. Never fails the request: the message is already saved.
  try {
    const ownerPhone = Deno.env.get('SENT_OWNER_ALERT_PHONE')?.trim();
    if (ownerPhone) {
      const outcome = await sendCustomerSms(admin, {
        purpose: 'new_request_alert',
        phone: ownerPhone,
        parameters: {
          customerName: withoutLinks(name) || 'someone',
          requestSummary: `Text question: ${withoutLinks(message)}`,
          customerPhone: to,
          inquiryLink: adminInquiryLink(Deno.env.get('SITE_URL') ?? 'https://boxed2built.com', inquiryId),
        },
        idempotencyKey: idempotencyKey('text-question', inquiryId),
        context: { inquiryId, source: 'text_widget' },
      });
      if (!outcome.sent) console.log(`[text-question] owner text not sent: ${outcome.reason ?? 'unknown'}`);
    }
  } catch (err) {
    console.error('[text-question] owner text failed', err);
  }

  return json({ success: true });
});
