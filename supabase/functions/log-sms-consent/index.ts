import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { UUID_PATTERN } from '../_shared/salesSubscribers.ts';

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
      'id, organization_id, business_id, client_name, client_email, client_phone, sms_opt_in, sms_marketing_opt_in, sms_consent_text, sms_consent_timestamp, created_at',
    )
    .eq('id', inquiryId)
    .maybeSingle();

  if (error || !inquiry) return json({ success: false, error: 'Inquiry not found' }, 404);
  if (!inquiry.sms_opt_in || !inquiry.client_phone) return json({ success: true, logged: false });
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
    service_texts: true,
    marketing_texts: inquiry.sms_marketing_opt_in === true,
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
  return json({ success: true, logged: true });
});
