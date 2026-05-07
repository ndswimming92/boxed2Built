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

function buildReferralBlock(referralCode: string | null): string {
  if (!referralCode) return '';
  const code = escapeHtml(referralCode);
  return `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 6px;color:#166534;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Your Personal Referral Code</p>
          <p style="margin:0 0 14px;font-size:32px;font-weight:800;color:#15803d;font-family:monospace;letter-spacing:3px;">${code}</p>
          <p style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.6;">Know someone who could use a hand? If they book a job and mention your code, <strong>you both get $25 off</strong> — no strings attached.</p>
          <p style="margin:0;color:#15803d;font-size:12px;font-weight:600;">No limit on how many people you can refer.</p>
        </div>`;
}

function buildHtml(clientName: string, referralCode: string | null): string {
  const firstName = escapeHtml((clientName.trim() || 'there').split(' ')[0] || 'there');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Thanks for trusting me with your home, ${firstName}!</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">It was genuinely great working with you.</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:32px;">
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">Hi ${firstName},</p>
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">I really appreciate you choosing Boxed2Built. I hope the space feels exactly the way you imagined — one less thing on your plate and your home feeling a little more complete.</p>

        <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px 24px;margin-bottom:24px;text-align:center;">
          <p style="margin:0 0 6px;color:#1e3a5f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Would you leave me a Google review?</p>
          <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.6;">As a small local business, reviews mean everything to me. If I earned it, a quick review takes less than 30 seconds and helps more than you know.</p>
          <a href="${REVIEW_URL}" style="display:inline-block;background:#1e3a5f;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:11px 24px;border-radius:6px;">Leave a Google Review &rarr;</a>
        </div>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 12px;color:#111827;font-size:14px;font-weight:700;">Need help again down the road?</p>
          <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.7;">Whether it's another piece of furniture, a TV to mount, or anything else you need set up — just reply to this email or request a quote anytime. I'm always happy to come back.</p>
          <div style="text-align:center;">
            <a href="${CONTACT_URL}" style="display:inline-block;background:#1e3a5f;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:11px 24px;border-radius:6px;">Request a Quote &rarr;</a>
          </div>
        </div>

        ${buildReferralBlock(referralCode)}
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">Feel free to save my number in case you need help again down the road: <span style="color:#111827;font-weight:600;">(615) 403-4538</span></p>
        <p style="margin:0 0 4px;color:#374151;font-size:15px;font-weight:600;">Nicholas Davidson</p>
        <p style="margin:0 0 2px;color:#6b7280;font-size:14px;">Owner, Boxed2Built</p>
        <p style="margin:0 0 2px;color:#6b7280;font-size:14px;">(615) 403-4538</p>
        <p style="margin:0;color:#6b7280;font-size:14px;"><a href="mailto:${CONTACT_EMAIL}" style="color:#6b7280;text-decoration:underline;">${CONTACT_EMAIL}</a></p>
      </td></tr>

      <tr><td style="background:#f9fafb;padding:20px 32px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-align:center;">
          Boxed2Built &bull; Spring Hill, TN &bull;
          <a href="${WEBSITE_URL}" style="color:#9ca3af;text-decoration:underline;">boxed2built.com</a>
        </p>
        <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;line-height:1.7;">
          <a href="${WEBSITE_URL}/privacy-policy" style="color:#9ca3af;text-decoration:underline;">Privacy Policy</a>
          &nbsp;&bull;&nbsp;
          <a href="${WEBSITE_URL}/terms-of-service" style="color:#9ca3af;text-decoration:underline;">Terms of Service</a>
          &nbsp;&bull;&nbsp;
          <a href="mailto:${CONTACT_EMAIL}" style="color:#9ca3af;text-decoration:underline;">${CONTACT_EMAIL}</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildPlainText(clientName: string, referralCode: string | null): string {
  const firstName = (clientName.trim() || 'there').split(' ')[0] || 'there';
  const lines = [
    `Hi ${firstName},`,
    '',
    'I really appreciate you choosing Boxed2Built. I hope the space feels exactly the way you imagined — one less thing on your plate and your home feeling a little more complete.',
    '',
    '--- Would you leave me a Google review? ---',
    'As a small local business, reviews mean everything to me. If I earned it, it only takes 30 seconds:',
    REVIEW_URL,
    '',
    '--- Need help again down the road? ---',
    'Whether it\'s another piece of furniture, a TV to mount, or anything else you need set up — just reply to this email or request a quote anytime:',
    CONTACT_URL,
    '',
  ];

  if (referralCode) {
    lines.push(
      '--- Your Personal Referral Code ---',
      `Your code: ${referralCode}`,
      '',
      'Know someone who could use a hand? If they book a job and mention your code, you both get $25 off — no strings attached.',
      '',
      'No limit on how many people you can refer.',
      '',
    );
  }

  lines.push(
    'Feel free to save my number in case you need help again down the road: (615) 403-4538',
    '',
    'Nicholas Davidson',
    'Owner, Boxed2Built',
    '(615) 403-4538',
    CONTACT_EMAIL,
    '',
    'Boxed2Built | Spring Hill, TN',
    WEBSITE_URL,
    '',
    'Privacy Policy: ' + WEBSITE_URL + '/privacy-policy',
    'Terms of Service: ' + WEBSITE_URL + '/terms-of-service',
  );

  return lines.join('\n');
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
      .select('id, name, email, last_followup_email_sent_at, referral_code')
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
    const html = buildHtml(client.name, client.referral_code ?? null);
    const text = buildPlainText(client.name, client.referral_code ?? null);

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
