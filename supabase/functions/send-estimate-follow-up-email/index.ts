import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'team@boxed2built.com';

type InvoiceType = 'estimate' | 'deposit' | 'progress' | 'final' | 'general';

interface Payload {
  email: string;
  clientName: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getReferenceLabel(invoiceType: InvoiceType): string {
  return invoiceType === 'estimate' ? 'estimate' : 'invoice';
}

function getGreetingName(clientName: string): string {
  return clientName.trim() || 'there';
}

function buildSubject(invoiceNumber: string, invoiceType: InvoiceType): string {
  return `Following up on ${getReferenceLabel(invoiceType)} ${invoiceNumber}`;
}

function buildPlainText(clientName: string, invoiceNumber: string, invoiceType: InvoiceType): string {
  const greetingName = getGreetingName(clientName);
  const referenceLabel = getReferenceLabel(invoiceType);

  return [
    `Hi ${greetingName},`,
    '',
    `I wanted to follow up on ${referenceLabel} ${invoiceNumber}.`,
    'Would you like to proceed with the work, or is there anything you would like to review before we move forward?',
    '',
    'If you are ready to proceed, just reply to this email and I can confirm the next steps and scheduling details.',
    '',
    'Thank you,',
    'Boxed2Built',
  ].join('\n');
}

function buildHtml(clientName: string, invoiceNumber: string, invoiceType: InvoiceType): string {
  const greetingName = escapeHtml(getGreetingName(clientName));
  const referenceLabel = escapeHtml(getReferenceLabel(invoiceType));
  const safeInvoiceNumber = escapeHtml(invoiceNumber);

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
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Approval follow-up</h1>
                <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;">Estimate ${safeInvoiceNumber}</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:32px;">
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">Hi ${greetingName},</p>
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">I wanted to follow up on ${referenceLabel} <strong>${safeInvoiceNumber}</strong>.</p>
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">Would you like to proceed with the work, or is there anything you would like to review before we move forward?</p>
                <p style="margin:0;color:#374151;font-size:15px;line-height:1.7;">If you are ready to proceed, just reply to this email and I can confirm the next steps and scheduling details.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:0 32px 32px;color:#374151;font-size:15px;line-height:1.7;">
                <p style="margin:0;">Thank you,<br />Boxed2Built</p>
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
    const body = (await req.json()) as Payload;

    if (!body?.email || !body?.invoiceNumber || !body?.invoiceType) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subject = buildSubject(body.invoiceNumber, body.invoiceType);
    const text = buildPlainText(body.clientName ?? '', body.invoiceNumber, body.invoiceType);
    const html = buildHtml(body.clientName ?? '', body.invoiceNumber, body.invoiceType);

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
