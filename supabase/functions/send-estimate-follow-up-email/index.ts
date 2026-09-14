// The document this follows up on is stored as invoice_type = 'estimate' and is
// shown to the customer as a "Quote". The copy below says Quote; the file,
// function and payload names stay on the database's word. Twin file: src/services/estimateFollowUpEmailService.ts —
// change both together, or the sent email and the clipboard fallback disagree.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getBusinessContactPhone } from '../_shared/businessContact.ts';
import { authorizeAdminOrService } from '../_shared/authorize.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'team@boxed2built.com';
const WEBSITE_URL = 'https://boxed2built.com';
const TERMS_URL = 'https://boxed2built.com/terms-of-service';
const PRIVACY_URL = 'https://boxed2built.com/privacy-policy';
const CONTACT_EMAIL = 'nicholas.davidson@boxed2built.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type InvoiceType = 'estimate' | 'deposit' | 'progress' | 'final' | 'general';

interface Payload {
  email: string;
  clientName: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  serviceSummary?: string | null;
  estimateTotal?: string | null;
  estimatedDuration?: string | null;
  lookupRequestUrl?: string | null;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getGreetingName(clientName: string): string {
  return clientName.trim() || 'there';
}

function buildSubject(): string {
  return 'Boxed2Built Quote Follow-Up';
}

function normalizeOptional(input?: string | null): string | null {
  const normalized = input?.trim();
  return normalized ? normalized : null;
}

function buildPlainText(payload: Payload, contactPhone: string | null): string {
  const greetingName = getGreetingName(payload.clientName);
  const serviceSummary = normalizeOptional(payload.serviceSummary);
  const estimateTotal = normalizeOptional(payload.estimateTotal);
  const estimatedDuration = normalizeOptional(payload.estimatedDuration);
  const lookupRequestUrl = normalizeOptional(payload.lookupRequestUrl);
  const lines = [
    `Hello ${greetingName},`,
    '',
    `I wanted to follow up on quote ${payload.invoiceNumber}${serviceSummary ? ` for your ${serviceSummary}` : ''}.`,
    '',
  ];

  const detailLines = [
    serviceSummary ? `- Service: ${serviceSummary}` : null,
    estimateTotal ? `- Quote total: ${estimateTotal}` : null,
    estimatedDuration ? `- Estimated time: ${estimatedDuration}` : null,
  ].filter(Boolean);

  if (detailLines.length > 0) {
    lines.push('Here are the details I have for your project:');
    lines.push(...detailLines);
    lines.push('');
  }

  lines.push(
    'My goal is to make this as easy and stress-free as possible for you. I\'ll handle the assembly, bring the necessary tools, and clean up all packaging when the job is complete.',
    '',
    'If you\'re ready to move forward, just reply to this email and I can confirm the next steps and scheduling details. If you have any questions or want to review anything before moving forward, I\'m happy to help.',
    '',
    'Thank you,',
    'Boxed2Built',
    ...(contactPhone ? [contactPhone] : []),
    CONTACT_EMAIL,
    '',
    'Helpful links:',
    ...(lookupRequestUrl ? [`- View Your Request: ${lookupRequestUrl}`] : []),
    `- Website: ${WEBSITE_URL}`,
    `- Terms of Service: ${TERMS_URL}`,
    `- Privacy Policy: ${PRIVACY_URL}`,
  );

  return lines.join('\n');
}

function buildDetailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:0 0 10px;vertical-align:top;color:#64748b;font-size:14px;line-height:1.6;font-weight:600;white-space:nowrap;">${escapeHtml(label)}:</td>
      <td style="padding:0 0 10px 12px;vertical-align:top;color:#1f2937;font-size:14px;line-height:1.6;">${escapeHtml(value)}</td>
    </tr>`;
}

function buildFooterLink(label: string, url: string): string {
  return `<a href="${escapeHtml(url)}" style="color:#1d4ed8;text-decoration:none;font-weight:600;display:inline-block;margin:0 16px 10px 0;">${escapeHtml(label)}</a>`;
}

function buildHtml(payload: Payload, contactPhone: { display: string | null; telHref: string | null }): string {
  const greetingName = escapeHtml(getGreetingName(payload.clientName));
  const safeInvoiceNumber = escapeHtml(payload.invoiceNumber);
  const serviceSummary = normalizeOptional(payload.serviceSummary);
  const estimateTotal = normalizeOptional(payload.estimateTotal);
  const estimatedDuration = normalizeOptional(payload.estimatedDuration);
  const lookupRequestUrl = normalizeOptional(payload.lookupRequestUrl);
  const detailRows = [
    serviceSummary ? buildDetailRow('Service', serviceSummary) : '',
    estimateTotal ? buildDetailRow('Quote total', estimateTotal) : '',
    estimatedDuration ? buildDetailRow('Estimated time', estimatedDuration) : '',
  ].filter(Boolean).join('');
  const footerLinks = [
    lookupRequestUrl ? buildFooterLink('View Your Request', lookupRequestUrl) : '',
    buildFooterLink('Website', WEBSITE_URL),
    buildFooterLink('Terms of Service', TERMS_URL),
    buildFooterLink('Privacy Policy', PRIVACY_URL),
  ].filter(Boolean).join('');

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
                <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Boxed2Built Quote Follow-Up</h1>
                <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;">Quote ${safeInvoiceNumber}</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:32px;">
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">Hello ${greetingName},</p>
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">I wanted to follow up on quote <strong>${safeInvoiceNumber}</strong>${serviceSummary ? ` for your <strong>${escapeHtml(serviceSummary)}</strong>` : ''}.</p>
                ${detailRows ? `
                <div style="margin:0 0 20px;padding:18px 20px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                  <p style="margin:0 0 12px;color:#1f2937;font-size:15px;line-height:1.7;font-weight:600;">Here are the details I have for your project:</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${detailRows}
                  </table>
                </div>` : ''}
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">My goal is to make this as easy and stress-free as possible for you. I’ll handle the assembly, bring the necessary tools, and clean up all packaging when the job is complete.</p>
                <p style="margin:0;color:#374151;font-size:15px;line-height:1.7;">If you’re ready to move forward, just reply to this email and I can confirm the next steps and scheduling details. If you have any questions or want to review anything before moving forward, I’m happy to help.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:0 32px 24px;color:#374151;font-size:15px;line-height:1.7;">
                <p style="margin:0;">Thank you,<br />Boxed2Built<br />${contactPhone.display ? `${contactPhone.display}<br />` : ""}<a href="mailto:${CONTACT_EMAIL}" style="color:#1d4ed8;text-decoration:none;">${CONTACT_EMAIL}</a></p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:0 32px 32px;border-radius:0 0 12px 12px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
                  <p style="margin:0 0 12px;color:#1e3a5f;font-size:13px;line-height:1.6;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Helpful links</p>
                  <div style="margin:0 0 14px;font-size:14px;line-height:1.8;">${footerLinks}</div>
                  <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">Questions? ${contactPhone.display && contactPhone.telHref ? `Call or text <a href="tel:${contactPhone.telHref}" style="color:#1d4ed8;text-decoration:none;">${contactPhone.display}</a> or ` : ""}email <a href="mailto:${CONTACT_EMAIL}" style="color:#1d4ed8;text-decoration:none;">${CONTACT_EMAIL}</a>.</p>
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

async function sendEmail(to: string, subject: string, html: string, text: string) {
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
      text,
      reply_to: FROM_EMAIL,
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
    // F5: every field of this message, recipient included, comes from the request
    // body, so without this check the function was an open relay on the business's
    // verified sending domain.
    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status ?? 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Payload;

    if (!body?.email || !body?.invoiceNumber || !body?.invoiceType) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const contactPhone = await getBusinessContactPhone(supabase);
    const subject = buildSubject();
    const text = buildPlainText(body, contactPhone.display);
    const html = buildHtml(body, contactPhone);

    await sendEmail(body.email, subject, html, text);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send approval follow-up email.';
    console.error('send-estimate-follow-up-email error:', error);

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
