import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_EMAIL = 'team@boxed2built.com';
const BCC_EMAIL = 'boxed2builtco@gmail.com';
const WEBSITE_URL = 'https://boxed2built.com';
const CONTACT_URL = 'https://boxed2built.com/contact';
const REVIEW_URL = 'https://g.page/r/CW-qaf93r1ZuEAI/review';
const CONTACT_PHONE = '615-403-4538';
const CONTACT_EMAIL = 'boxed2builtco@gmail.com';

const COOLDOWN_MINUTES = 10;
const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;

interface Payload {
  clientId: string;
  organizationId: string;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildHtml(clientName: string): string {
  const greetingName = escapeHtml(clientName.trim() || 'there');

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
                <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Thank You from Boxed2Built</h1>
                <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;">We appreciate your business</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:32px;">
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">Hi ${greetingName},</p>
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">Thank you for choosing Boxed2Built! It was a pleasure working with you and we hope everything looks great.</p>
                <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">If you need anything assembled, mounted, or set up in the future — we're just a message or call away. We'd love to help again.</p>

                <div style="margin:0 0 24px;padding:20px 24px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;text-align:center;">
                  <p style="margin:0 0 8px;color:#1e3a5f;font-size:14px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Enjoyed the service?</p>
                  <p style="margin:0 0 16px;color:#64748b;font-size:14px;line-height:1.6;">A quick review goes a long way and helps us continue doing what we love.</p>
                  <a href="${REVIEW_URL}" style="display:inline-block;padding:12px 28px;background:#1e3a5f;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Leave a Google Review</a>
                </div>

                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">Ready to book your next project?</p>
                <p style="margin:0;font-size:15px;">
                  <a href="${CONTACT_URL}" style="display:inline-block;padding:12px 28px;background:#f0f7ff;color:#1e3a5f;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;border:1px solid #bfdbfe;">Schedule Another Job</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:0 32px 24px;color:#374151;font-size:15px;line-height:1.7;">
                <p style="margin:0;">Thank you again,<br /><strong>Boxed2Built</strong><br /><a href="tel:${CONTACT_PHONE}" style="color:#1d4ed8;text-decoration:none;">${CONTACT_PHONE}</a><br /><a href="mailto:${CONTACT_EMAIL}" style="color:#1d4ed8;text-decoration:none;">${CONTACT_EMAIL}</a></p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:0 32px 32px;border-radius:0 0 12px 12px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
                  <div style="font-size:14px;line-height:1.8;">
                    <a href="${WEBSITE_URL}" style="color:#1d4ed8;text-decoration:none;font-weight:600;display:inline-block;margin:0 16px 10px 0;">Website</a>
                    <a href="${CONTACT_URL}" style="color:#1d4ed8;text-decoration:none;font-weight:600;display:inline-block;margin:0 16px 10px 0;">Contact Us</a>
                    <a href="${REVIEW_URL}" style="color:#1d4ed8;text-decoration:none;font-weight:600;display:inline-block;margin:0 16px 10px 0;">Leave a Review</a>
                  </div>
                  <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">Questions? Call or text <a href="tel:${CONTACT_PHONE}" style="color:#1d4ed8;text-decoration:none;">${CONTACT_PHONE}</a> or email <a href="mailto:${CONTACT_EMAIL}" style="color:#1d4ed8;text-decoration:none;">${CONTACT_EMAIL}</a>.</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildPlainText(clientName: string): string {
  const greetingName = clientName.trim() || 'there';
  return [
    `Hi ${greetingName},`,
    '',
    'Thank you for choosing Boxed2Built! It was a pleasure working with you and we hope everything looks great.',
    '',
    'If you need anything assembled, mounted, or set up in the future — we\'re just a message or call away. We\'d love to help again.',
    '',
    'If you enjoyed the service, a quick Google review goes a long way:',
    REVIEW_URL,
    '',
    'Ready to book your next project? Visit us at:',
    CONTACT_URL,
    '',
    'Thank you again,',
    'Boxed2Built',
    CONTACT_PHONE,
    CONTACT_EMAIL,
    '',
    'Website: ' + WEBSITE_URL,
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
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

    if (!body?.clientId || !body?.organizationId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, last_followup_email_sent_at')
      .eq('id', body.clientId)
      .eq('organization_id', body.organizationId)
      .maybeSingle();

    if (clientError || !client) {
      return new Response(JSON.stringify({ success: false, error: 'Client not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!client.email) {
      return new Response(JSON.stringify({ success: false, error: 'Client has no email address.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (client.last_followup_email_sent_at) {
      const lastSent = new Date(client.last_followup_email_sent_at).getTime();
      const elapsed = Date.now() - lastSent;
      if (elapsed < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'cooldown',
            remainingSeconds,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const subject = 'Thank You from Boxed2Built';
    const html = buildHtml(client.name);
    const text = buildPlainText(client.name);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Boxed2Built <${FROM_EMAIL}>`,
        to: [client.email],
        bcc: [BCC_EMAIL],
        subject,
        html,
        text,
        reply_to: FROM_EMAIL,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error(`Resend API error: ${err}`);
    }

    const resendData = await resendRes.json();
    const messageId: string = resendData?.id ?? '';
    const now = new Date().toISOString();

    await supabase.from('clients').update({ last_followup_email_sent_at: now }).eq('id', client.id);

    await supabase.from('email_events').insert({
      resend_event_id: messageId ? `send-${messageId}` : null,
      message_id: messageId || null,
      event_type: 'email.sent',
      recipient: client.email,
      subject,
      from_address: FROM_EMAIL,
      occurred_at: now,
      payload: { source: 'send-followup-email', clientId: client.id, clientName: client.name },
    });

    return new Response(JSON.stringify({ success: true, sentAt: now }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send follow-up email.';
    console.error('send-followup-email error:', error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
