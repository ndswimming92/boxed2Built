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
const CONTACT_PHONE = '(615) 551-1402';
const CONTACT_EMAIL = 'boxed2builtco@gmail.com';
const APP_URL = 'https://www.boxed2built.com';

const COOLDOWN_MINUTES = 10;
const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;

interface Payload {
  clientId: string;
  organizationId: string;
  invoiceId: string;
  overrideEmail?: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type: string;
  is_taxable: boolean;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  client_name: string;
  client_email: string | null;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  notes: string | null;
  status: string;
  payment_terms: string | null;
  business_id: string;
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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function formatDate(d: string): string {
  const [year, month, day] = d.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function buildLineItemsTable(lineItems: LineItem[], invoice: Invoice): string {
  const rows = lineItems.map((item) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#374151;font-size:14px;line-height:1.5;">
        ${escapeHtml(item.description)}
        <div style="color:#9ca3af;font-size:12px;margin-top:2px;text-transform:capitalize;">${escapeHtml(item.item_type)}</div>
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#374151;font-size:14px;text-align:center;white-space:nowrap;">${item.quantity}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#374151;font-size:14px;text-align:right;white-space:nowrap;">${formatCurrency(item.unit_price)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#111827;font-size:14px;font-weight:600;text-align:right;white-space:nowrap;">${formatCurrency(item.total)}</td>
    </tr>`).join('');

  const taxRow = invoice.tax_amount > 0 ? `
    <tr>
      <td colspan="3" style="padding:8px 16px;color:#6b7280;font-size:13px;text-align:right;">Tax (${invoice.tax_rate}%)</td>
      <td style="padding:8px 16px;color:#6b7280;font-size:13px;text-align:right;white-space:nowrap;">${formatCurrency(invoice.tax_amount)}</td>
    </tr>` : '';

  const paidRow = invoice.amount_paid > 0 ? `
    <tr>
      <td colspan="3" style="padding:8px 16px;color:#16a34a;font-size:13px;text-align:right;">Amount Paid</td>
      <td style="padding:8px 16px;color:#16a34a;font-size:13px;text-align:right;white-space:nowrap;">-${formatCurrency(invoice.amount_paid)}</td>
    </tr>` : '';

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:8px;">
    <thead>
      <tr style="background:#f8fafc;">
        <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;">Description</th>
        <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">Qty</th>
        <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">Unit Price</th>
        <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr style="background:#f8fafc;">
        <td colspan="3" style="padding:10px 16px;font-size:13px;font-weight:600;color:#374151;text-align:right;border-top:1px solid #e5e7eb;">Subtotal</td>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#374151;text-align:right;white-space:nowrap;border-top:1px solid #e5e7eb;">${formatCurrency(invoice.subtotal)}</td>
      </tr>
      ${taxRow}
      ${paidRow}
      <tr style="background:#1e3a5f;">
        <td colspan="3" style="padding:12px 16px;font-size:15px;font-weight:700;color:#ffffff;text-align:right;">Total Due</td>
        <td style="padding:12px 16px;font-size:15px;font-weight:700;color:#ffffff;text-align:right;white-space:nowrap;">${formatCurrency(invoice.amount_due)}</td>
      </tr>
    </tbody>
  </table>`;
}

function buildHtml(
  clientName: string,
  invoice: Invoice,
  lineItems: LineItem[],
  payUrl: string,
  businessName: string,
): string {
  const firstName = escapeHtml((clientName.trim() || 'there').split(' ')[0] || 'there');
  const invoiceNum = escapeHtml(invoice.invoice_number);
  const typeLabel = (invoice.invoice_type || 'invoice').charAt(0).toUpperCase() + (invoice.invoice_type || 'invoice').slice(1);
  const dueDateStr = invoice.due_date ? formatDate(invoice.due_date) : null;
  const invoiceDateStr = formatDate(invoice.invoice_date);
  const notesBlock = invoice.notes
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Notes</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(invoice.notes)}</p>
       </div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Your Invoice from ${escapeHtml(businessName)}</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">Hi ${firstName} — your ${typeLabel.toLowerCase()} invoice is ready for review.</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:32px;">
        <p style="margin:0 0 6px;color:#374151;font-size:15px;line-height:1.7;">Hi ${firstName},</p>
        <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">Please find your ${typeLabel.toLowerCase()} invoice details below. You can pay securely online using the button at the bottom of this email.</p>

        <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;color:#6b7280;padding-bottom:6px;">Invoice #</td>
              <td style="font-size:13px;font-weight:700;color:#1e3a5f;text-align:right;padding-bottom:6px;">${invoiceNum}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding-bottom:6px;">Invoice Date</td>
              <td style="font-size:13px;color:#374151;text-align:right;padding-bottom:6px;">${invoiceDateStr}</td>
            </tr>
            ${dueDateStr ? `<tr>
              <td style="font-size:13px;color:#6b7280;padding-bottom:6px;">Due Date</td>
              <td style="font-size:13px;color:#374151;text-align:right;padding-bottom:6px;">${dueDateStr}</td>
            </tr>` : ''}
            ${invoice.payment_terms ? `<tr>
              <td style="font-size:13px;color:#6b7280;">Payment Terms</td>
              <td style="font-size:13px;color:#374151;text-align:right;">${escapeHtml(invoice.payment_terms)}</td>
            </tr>` : ''}
          </table>
        </div>

        ${buildLineItemsTable(lineItems, invoice)}

        ${notesBlock}

        <div style="text-align:center;padding:28px 0 4px;">
          <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">Amount Due</p>
          <p style="margin:0 0 20px;font-size:36px;font-weight:800;color:#1e3a5f;">${formatCurrency(invoice.amount_due)}</p>
          <a href="${payUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;">Pay Now &rarr;</a>
          <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;">Secured by Stripe. Your payment info is never stored on our servers.</p>
        </div>

        <div style="margin-top:28px;padding-top:24px;border-top:1px solid #f3f4f6;">
          <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.7;">Questions? Call or text <span style="color:#111827;font-weight:600;">${CONTACT_PHONE}</span> anytime.</p>
          <p style="margin:0;color:#374151;font-size:14px;">— The Boxed2Built Team</p>
        </div>
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

function buildPlainText(clientName: string, invoice: Invoice, lineItems: LineItem[], payUrl: string): string {
  const firstName = (clientName.trim() || 'there').split(' ')[0] || 'there';
  const lines = [
    `Hi ${firstName},`,
    '',
    `Please find your invoice details below.`,
    '',
    `Invoice #: ${invoice.invoice_number}`,
    `Invoice Date: ${formatDate(invoice.invoice_date)}`,
  ];
  if (invoice.due_date) lines.push(`Due Date: ${formatDate(invoice.due_date)}`);
  if (invoice.payment_terms) lines.push(`Terms: ${invoice.payment_terms}`);
  lines.push('');
  lines.push('--- Services ---');
  lineItems.forEach((item) => {
    lines.push(`${item.description} — ${formatCurrency(item.total)}`);
  });
  lines.push('');
  lines.push(`Subtotal: ${formatCurrency(invoice.subtotal)}`);
  if (invoice.tax_amount > 0) lines.push(`Tax (${invoice.tax_rate}%): ${formatCurrency(invoice.tax_amount)}`);
  if (invoice.amount_paid > 0) lines.push(`Amount Paid: -${formatCurrency(invoice.amount_paid)}`);
  lines.push(`Total Due: ${formatCurrency(invoice.amount_due)}`);
  lines.push('');
  lines.push('--- Pay Online ---');
  lines.push(payUrl);
  lines.push('');
  lines.push(`Questions? Call or text us at ${CONTACT_PHONE} or email ${CONTACT_EMAIL}`);
  lines.push('');
  lines.push('— The Boxed2Built Team');
  lines.push('Boxed2Built | Spring Hill, TN');
  lines.push(WEBSITE_URL);
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

    if (!body?.clientId || !body?.organizationId || !body?.invoiceId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, last_invoice_email_sent_at, organization_id')
      .eq('id', body.clientId)
      .eq('organization_id', body.organizationId)
      .maybeSingle();

    if (clientError || !client) {
      return new Response(JSON.stringify({ success: false, error: 'Client not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientEmail: string | null = body.overrideEmail?.trim() || client.email;

    if (!recipientEmail) {
      return new Response(JSON.stringify({ success: false, error: 'no_email' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (client.last_invoice_email_sent_at) {
      const lastSent = new Date(client.last_invoice_email_sent_at).getTime();
      const elapsed = Date.now() - lastSent;
      if (elapsed < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return new Response(
          JSON.stringify({ success: false, error: 'cooldown', remainingSeconds }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_type, client_name, client_email, invoice_date, due_date, subtotal, tax_rate, tax_amount, total_amount, amount_paid, amount_due, notes, status, payment_terms, business_id, payment_access_token')
      .eq('id', body.invoiceId)
      .eq('is_active', true)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ success: false, error: 'Invoice not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return new Response(JSON.stringify({ success: false, error: 'Invoice is already paid or cancelled.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: lineItems } = await supabase
      .from('invoice_line_items')
      .select('id, description, quantity, unit_price, total, item_type, is_taxable')
      .eq('invoice_id', invoice.id)
      .order('display_order', { ascending: true });

    const { data: bizData } = await supabase
      .from('business_info')
      .select('name')
      .eq('id', invoice.business_id)
      .maybeSingle();

    const businessName = bizData?.name || 'Boxed2Built';

    const payUrl = `${APP_URL}/pay/${invoice.id}/${(invoice as Invoice & { payment_access_token: string }).payment_access_token}`;

    const subject = `Invoice ${invoice.invoice_number} — ${formatCurrency(invoice.amount_due)} Due`;
    const html = buildHtml(client.name, invoice as Invoice, (lineItems || []) as LineItem[], payUrl, businessName);
    const text = buildPlainText(client.name, invoice as Invoice, (lineItems || []) as LineItem[], payUrl);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Boxed2Built <${FROM_EMAIL}>`,
        to: [recipientEmail],
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

    await supabase.from('clients').update({ last_invoice_email_sent_at: now }).eq('id', client.id);

    if (invoice.status === 'draft') {
      await supabase.from('invoices').update({ status: 'sent', sent_at: now }).eq('id', invoice.id);
    }

    await supabase.from('email_events').insert({
      resend_event_id: messageId ? `send-${messageId}` : null,
      message_id: messageId || null,
      event_type: 'email.sent',
      recipient: recipientEmail,
      subject,
      from_address: FROM_EMAIL,
      occurred_at: now,
      payload: {
        source: 'send-invoice-email',
        clientId: client.id,
        clientName: client.name,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
      },
    });

    return new Response(JSON.stringify({ success: true, sentAt: now }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send invoice email.';
    console.error('send-invoice-email error:', error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
