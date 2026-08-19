import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizeAdminOrService } from '../_shared/authorize.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_EMAIL = 'team@boxed2built.com';
const BCC_EMAIL = 'nicholas.davidson@boxed2built.com';
const WEBSITE_URL = 'https://boxed2built.com';
const CONTACT_EMAIL = 'nicholas.davidson@boxed2built.com';

const COOLDOWN_MINUTES = 10;
const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;
const QUOTE_VALIDITY_DAYS = 7;

interface Payload {
  clientId: string;
  organizationId: string;
  jobId: string;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getExpiryDate(): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + QUOTE_VALIDITY_DAYS);
  return expiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

interface QuoteDetails {
  jobType: string;
  jobDescription: string | null;
  quotedPrice: number;
  materialsCost: number;
  dateScheduled: string | null;
}

function buildHtml(
  clientName: string,
  quote: QuoteDetails,
  businessName: string,
  contactPhone: string,
): string {
  const firstName = escapeHtml((clientName.trim() || 'there').split(' ')[0] || 'there');
  const expiryDate = getExpiryDate();
  const total = quote.quotedPrice + quote.materialsCost;
  const hasDescription = quote.jobDescription && quote.jobDescription.trim().length > 0;
  const hasMaterials = quote.materialsCost > 0;

  const scheduledRow = quote.dateScheduled
    ? `<tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Scheduled Date</td><td style="padding:10px 16px;color:#111827;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;">${escapeHtml(formatDate(quote.dateScheduled))}</td></tr>`
    : '';

  const materialsRow = hasMaterials
    ? `<tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Materials & Extras</td><td style="padding:10px 16px;color:#111827;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;">${formatCurrency(quote.materialsCost)}</td></tr>`
    : '';

  const descriptionBlock = hasDescription
    ? `<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;"><strong>Description:</strong> ${escapeHtml(quote.jobDescription!)}</p>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Your Quote from ${escapeHtml(businessName)}</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">for ${escapeHtml(quote.jobType)}</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:32px;">
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">Hi ${firstName},</p>
        <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">Thank you for reaching out! Below is the pricing quote for your upcoming project. Please review the details and let me know if you have any questions or would like to move forward.</p>

        ${descriptionBlock}

        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
          <tr style="background:#f9fafb;">
            <td style="padding:12px 16px;color:#374151;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;">Item</td>
            <td style="padding:12px 16px;color:#374151;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:right;border-bottom:1px solid #e5e7eb;">Amount</td>
          </tr>
          <tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">${escapeHtml(quote.jobType)} — Labor</td><td style="padding:10px 16px;color:#111827;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;">${formatCurrency(quote.quotedPrice)}</td></tr>
          ${materialsRow}
          ${scheduledRow}
          <tr style="background:#f0fdf4;">
            <td style="padding:14px 16px;color:#166534;font-size:15px;font-weight:700;">Total</td>
            <td style="padding:14px 16px;color:#166534;font-size:18px;font-weight:800;text-align:right;">${formatCurrency(total)}</td>
          </tr>
        </table>

        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 20px;margin-bottom:24px;">
          <p style="margin:0;color:#92400e;font-size:13px;font-weight:600;">This quote is valid for ${QUOTE_VALIDITY_DAYS} days (through ${expiryDate}).</p>
        </div>

        <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px 24px;margin-bottom:24px;text-align:center;">
          <p style="margin:0 0 6px;color:#1e3a5f;font-size:14px;font-weight:700;">Ready to move forward?</p>
          <p style="margin:0 0 4px;color:#374151;font-size:14px;line-height:1.6;">Simply reply to this email or give me a call to confirm.</p>
          <p style="margin:0;color:#1e3a5f;font-size:15px;font-weight:700;">${escapeHtml(contactPhone)}</p>
        </div>

        <p style="margin:0 0 4px;color:#374151;font-size:15px;font-weight:600;">Nicholas Davidson</p>
        <p style="margin:0 0 2px;color:#6b7280;font-size:14px;">Owner, ${escapeHtml(businessName)}</p>
        <p style="margin:0 0 2px;color:#6b7280;font-size:14px;">${escapeHtml(contactPhone)}</p>
        <p style="margin:0;color:#6b7280;font-size:14px;"><a href="mailto:${CONTACT_EMAIL}" style="color:#6b7280;text-decoration:underline;">${CONTACT_EMAIL}</a></p>
      </td></tr>

      <tr><td style="background:#f9fafb;padding:20px 32px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-align:center;">
          ${escapeHtml(businessName)} &bull; Spring Hill, TN &bull;
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

function buildPlainText(
  clientName: string,
  quote: QuoteDetails,
  businessName: string,
  contactPhone: string,
): string {
  const firstName = (clientName.trim() || 'there').split(' ')[0] || 'there';
  const expiryDate = getExpiryDate();
  const total = quote.quotedPrice + quote.materialsCost;

  const lines = [
    `Hi ${firstName},`,
    '',
    'Thank you for reaching out! Below is the pricing quote for your upcoming project.',
    '',
    `Service: ${quote.jobType}`,
  ];

  if (quote.jobDescription) {
    lines.push(`Description: ${quote.jobDescription}`);
  }

  lines.push('', '--- Quote Breakdown ---');
  lines.push(`${quote.jobType} (Labor): ${formatCurrency(quote.quotedPrice)}`);

  if (quote.materialsCost > 0) {
    lines.push(`Materials & Extras: ${formatCurrency(quote.materialsCost)}`);
  }

  lines.push(`Total: ${formatCurrency(total)}`);

  if (quote.dateScheduled) {
    lines.push(`Scheduled Date: ${formatDate(quote.dateScheduled)}`);
  }

  lines.push(
    '',
    `This quote is valid for ${QUOTE_VALIDITY_DAYS} days (through ${expiryDate}).`,
    '',
    '--- Ready to move forward? ---',
    'Simply reply to this email or give me a call to confirm.',
    contactPhone,
    '',
    'Nicholas Davidson',
    `Owner, ${businessName}`,
    contactPhone,
    CONTACT_EMAIL,
    '',
    `${businessName} | Spring Hill, TN`,
    WEBSITE_URL,
    '',
    `Privacy Policy: ${WEBSITE_URL}/privacy-policy`,
    `Terms of Service: ${WEBSITE_URL}/terms-of-service`,
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
    // F14: sending a quote is a staff action. The published anon key is itself a
    // valid JWT, so without this the endpoint was reachable by anyone.
    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status ?? 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Payload;

    if (!body?.clientId || !body?.organizationId || !body?.jobId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields (clientId, organizationId, jobId).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, last_quote_email_sent_at')
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

    // Cooldown check
    if (client.last_quote_email_sent_at) {
      const lastSent = new Date(client.last_quote_email_sent_at).getTime();
      const elapsed = Date.now() - lastSent;
      if (elapsed < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return new Response(
          JSON.stringify({ success: false, error: 'cooldown', remainingSeconds }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, job_type, job_description, quoted_price, materials_cost, date_scheduled')
      .eq('id', body.jobId)
      .eq('organization_id', body.organizationId)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(JSON.stringify({ success: false, error: 'Job not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (job.quoted_price == null) {
      return new Response(JSON.stringify({ success: false, error: 'This job does not have a quoted price set.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch business info
    const { data: business } = await supabase
      .from('business_info')
      .select('business_name, phone')
      .eq('organization_id', body.organizationId)
      .eq('is_active', true)
      .maybeSingle();

    const businessName = business?.business_name || 'Boxed2Built';
    const contactPhone = business?.phone || '615-403-4538';

    const quote: QuoteDetails = {
      jobType: job.job_type || 'Service',
      jobDescription: job.job_description || null,
      quotedPrice: Number(job.quoted_price),
      materialsCost: Number(job.materials_cost || 0),
      dateScheduled: job.date_scheduled || null,
    };

    const subject = `Your Quote from ${businessName} — ${quote.jobType}`;
    const html = buildHtml(client.name, quote, businessName, contactPhone);
    const text = buildPlainText(client.name, quote, businessName, contactPhone);

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${businessName} <${FROM_EMAIL}>`,
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

    // Update cooldown timestamp
    await supabase.from('clients').update({ last_quote_email_sent_at: now }).eq('id', client.id);

    // Log email event
    await supabase.from('email_events').insert({
      resend_event_id: messageId ? `send-${messageId}` : null,
      message_id: messageId || null,
      event_type: 'email.sent',
      recipient: client.email,
      subject,
      from_address: FROM_EMAIL,
      occurred_at: now,
      payload: { source: 'send-quote-email', clientId: client.id, clientName: client.name, jobId: job.id, quotedPrice: quote.quotedPrice },
    });

    return new Response(JSON.stringify({ success: true, sentAt: now }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send quote email.';
    console.error('send-quote-email error:', error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
