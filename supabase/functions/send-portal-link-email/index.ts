import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'team@boxed2built.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// The verification link is always built here, on a fixed origin. It is never
// taken from the request body, so a caller cannot mail an arbitrary URL from
// the business's sending domain.
const APP_URL = 'https://www.boxed2built.com';

interface Payload {
  token?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildVerificationEmailHtml(linkUrl: string, expiresAt?: string | null): string {
  const safeUrl = escapeHtml(linkUrl);
  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', { timeZone: 'America/Chicago' }) + ' CT'
    : '15 minutes from now';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
            <tr>
              <td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Verify your Boxed2Built account</h1>
                <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">Use this one-time secure link to connect your existing records.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:32px;">
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">We received a request to link historical customer, job, and invoice records to your portal account.</p>
                <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">Click the button below to finish verification.</p>
                <p style="margin:0 0 24px;text-align:center;">
                  <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;">Verify &amp; Link Account</a>
                </p>
                <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.6;">This link expires at <strong>${escapeHtml(expiryText)}</strong> and can only be used once.</p>
                <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">If you did not request this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Boxed2Built <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    // Logged server-side only; the upstream body is never relayed to the caller.
    const err = await res.text();
    console.error('Resend API error:', err);
    throw new Error('EMAIL_SEND_FAILED');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  if (!RESEND_API_KEY) {
    return json({ success: false, error: 'Email service is not configured.' }, 500);
  }

  try {
    // --- Require a real signed-in user. The published anon key is a valid JWT,
    // so verify_jwt alone is not authentication: resolve it to a user here.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ success: false, error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = (await req.json()) as Payload;
    const linkToken = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!linkToken || linkToken.length < 16) {
      return json({ success: false, error: 'Missing required fields.' }, 400);
    }

    // --- The recipient comes from the link-token record, never from the
    // request body, and the record must belong to this caller.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const tokenHash = await sha256Hex(linkToken);

    const { data: record, error: recordErr } = await admin
      .from('portal_account_link_tokens')
      .select('email, expires_at, consumed_at, created_by_auth_user_id, verification_method')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (recordErr) {
      console.error('send-portal-link-email lookup failed:', recordErr);
      return json({ success: false, error: 'Failed to send verification email.' }, 500);
    }

    if (
      !record ||
      record.created_by_auth_user_id !== userData.user.id ||
      record.consumed_at !== null ||
      new Date(record.expires_at as string) <= new Date() ||
      record.verification_method !== 'email' ||
      !record.email
    ) {
      return json({ success: false, error: 'This verification request is no longer valid.' }, 400);
    }

    const linkUrl = `${APP_URL}/portal/link-account?token=${encodeURIComponent(linkToken)}`;
    const html = buildVerificationEmailHtml(linkUrl, record.expires_at as string);
    await sendEmail(record.email as string, 'Verify your Boxed2Built portal account', html);

    return json({ success: true });
  } catch (error) {
    console.error('send-portal-link-email error:', error);
    return json({ success: false, error: 'Failed to send verification email.' }, 500);
  }
});
