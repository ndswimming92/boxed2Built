import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'team@boxed2built.com';

interface Payload {
  email: string;
  linkUrl: string;
  expiresAt?: string | null;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
                  <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;">Verify & Link Account</a>
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
    const err = await res.text();
    throw new Error(`Resend API error: ${err}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'Email service is not configured.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as Payload;

    if (!body?.email || !body?.linkUrl) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = buildVerificationEmailHtml(body.linkUrl, body.expiresAt);
    await sendEmail(body.email, 'Verify your Boxed2Built portal account', html);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send verification email.';
    console.error('send-portal-link-email error:', error);

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
