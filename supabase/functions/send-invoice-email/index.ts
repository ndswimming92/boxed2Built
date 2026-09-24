import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import {
  invoiceLabels,
  amountLabel,
  totalLabel,
  headlineAmount,
  invoiceEmailSubject,
} from '../_shared/invoiceLabels.ts';
import {
  cooldownSecondsRemaining,
  describeCooldown,
  testRecipientFrom,
  type EmailPreviewPayload,
} from '../_shared/adminEmailModes.ts';

/**
 * The invoice or estimate, with its line items and a link that takes payment.
 * Sent by hand from the client's profile or the invoice form.
 *
 * POST {"clientId": "...", "organizationId": "...", "invoiceId": "..."} sends
 *   it, and moves a draft invoice to sent. An optional overrideEmail addresses
 *   a client who has none on file.
 * POST {..., "preview": true} returns the rendered email and what would stop it
 *   sending, without sending. This is what the admin console displays, so the
 *   preview is the same HTML the client would receive rather than a second copy
 *   of the template maintained in the browser.
 * POST {..., "test": true} sends the real email to the signed-in admin instead
 *   of the client. The recipient comes from the caller's own token, never from
 *   overrideEmail or anywhere else in the body — nothing here can be aimed at a
 *   third party. A test leaves the cooldown marker alone and a draft a draft.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_EMAIL = 'team@boxed2built.com';
// team@boxed2built.com cannot receive mail — it hard-bounces. This is the
// address that actually accepts replies.
const REPLY_TO_EMAIL = 'replies@reply.boxed2built.com';
const BCC_EMAIL = 'nicholas.davidson@boxed2built.com';
const WEBSITE_URL = 'https://boxed2built.com';
const CONTACT_PHONE = '(615) 403-4538';
const CONTACT_EMAIL = 'nicholas.davidson@boxed2built.com';
const APP_URL = 'https://www.boxed2built.com';
const LOGO_URL = 'https://boxed2built.com/boxed2built_logo.png';

const COOLDOWN_MINUTES = 10;
const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;

interface Payload {
  clientId: string;
  organizationId: string;
  invoiceId: string;
  overrideEmail?: string;
  /** Render the email and return it without sending. Touches nothing. */
  preview?: boolean;
  /** Send the real email to the signed-in admin instead of the client. */
  test?: boolean;
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

function buildLineItemsTable(lineItems: LineItem[]): string {
  return lineItems.map((item) => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #f3f4f6;text-align:left;vertical-align:top;">
        <div style="font-size:15px;font-weight:600;color:#111827;">${escapeHtml(item.description)}</div>
        <div style="margin-top:2px;font-size:13px;color:#9ca3af;text-transform:capitalize;">${escapeHtml(item.item_type)}</div>
      </td>
      <td style="padding:16px 0;border-bottom:1px solid #f3f4f6;text-align:center;font-size:14px;color:#4b5563;vertical-align:top;">${item.quantity}</td>
      <td style="padding:16px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:14px;color:#4b5563;vertical-align:top;">${formatCurrency(item.unit_price)}</td>
      <td style="padding:16px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:15px;font-weight:700;color:#111827;vertical-align:top;">${formatCurrency(item.total)}</td>
    </tr>`).join('');
}

function buildTotalsBlock(invoice: Invoice): string {
  const taxRow = invoice.tax_amount > 0 ? `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6b7280;text-align:left;">Tax (${invoice.tax_rate}%)</td>
      <td style="padding:6px 0;font-size:14px;font-weight:600;color:#374151;text-align:right;">${formatCurrency(invoice.tax_amount)}</td>
    </tr>` : '';

  const paidRow = invoice.amount_paid > 0 ? `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#16a34a;text-align:left;">Amount Paid</td>
      <td style="padding:6px 0;font-size:14px;font-weight:600;color:#16a34a;text-align:right;">-${formatCurrency(invoice.amount_paid)}</td>
    </tr>` : '';

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>
      <td></td>
      <td width="260">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#6b7280;text-align:left;">Subtotal</td>
            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#374151;text-align:right;">${formatCurrency(invoice.subtotal)}</td>
          </tr>
          ${taxRow}
          ${paidRow}
          <tr>
            <td colspan="2" style="padding:8px 0 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#0E2748;border-radius:10px;">
                <tr>
                  <td style="padding:13px 16px;font-size:14px;font-weight:700;color:#ffffff;text-align:left;">${totalLabel(invoice.invoice_type)}</td>
                  <td style="padding:13px 16px;font-size:17px;font-weight:800;color:#ffffff;text-align:right;letter-spacing:-0.01em;">${formatCurrency(headlineAmount(invoice.invoice_type, invoice))}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

export function buildHtml(
  clientName: string,
  invoice: Invoice,
  lineItems: LineItem[],
  payUrl: string,
  businessName: string,
): string {
  const firstName = escapeHtml((clientName.trim() || 'there').split(' ')[0] || 'there');
  const clientNameEsc = escapeHtml(clientName.trim() || 'there');
  const invoiceNum = escapeHtml(invoice.invoice_number);
  const labels = invoiceLabels(invoice.invoice_type);
  const dueDateStr = invoice.due_date ? formatDate(invoice.due_date) : null;
  const invoiceDateStr = formatDate(invoice.invoice_date);
  // A bill leads with what is still owed; a quote leads with the price of the job.
  const headlineStr = formatCurrency(headlineAmount(invoice.invoice_type, invoice));
  // A quote is an offer: it invites payment rather than expecting it.
  const greeting = labels.isQuote
    ? `Thanks for choosing ${escapeHtml(businessName)}. Your quote is ready — the details are below. Nothing is due now; if the numbers look right, reply and we'll get you on the schedule, or pay online any time you're ready.`
    : `Thanks for choosing ${escapeHtml(businessName)}. Your ${labels.noun} is ready — the details are below, and you can pay securely online whenever you're ready. No payment is due until the job is done.`;
  const payNote = labels.isQuote
    ? `<div style="margin:-6px 0 16px 0;font-size:13px;color:#15803D;">Paying now locks in your spot — it's optional, and you're welcome to reply and book first.</div>`
    : '';
  const termsCell = (span: string) => `<td ${span} style="padding:16px 20px;">
                    <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;">Payment Terms</div>
                    <div style="margin-top:5px;font-size:14px;font-weight:600;color:#111827;">${invoice.payment_terms ? escapeHtml(invoice.payment_terms) : 'N/A'}</div>
                  </td>`;
  // An estimate is a quote, not a bill: with no due date, payment terms take
  // the whole row instead of leaving an empty cell beside them.
  const metaBottomRow = dueDateStr
    ? `<tr>
                  <td width="50%" style="padding:16px 20px;border-right:1px solid #E5E7EB;">
                    <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;">Due Date</div>
                    <div style="margin-top:5px;font-size:14px;font-weight:600;color:#B91C1C;">${dueDateStr}</div>
                  </td>
                  ${termsCell('width="50%"')}
                </tr>`
    : `<tr>
                  ${termsCell('colspan="2"')}
                </tr>`;
  const notesBlock = invoice.notes
    ? `<tr><td style="padding:18px 40px 0 40px;">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Notes</div>
          <p style="margin:5px 0 0;color:#374151;font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(invoice.notes)}</p>
        </div>
      </td></tr>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEF1F5;">
<div style="background:#EEF1F5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-collapse:separate;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 12px 34px -10px rgba(14,39,72,0.22);">

          <!-- Header -->
          <tr>
            <td style="background:#0E2748;padding:28px 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="vertical-align:middle;padding-right:16px;">
                          <div style="width:72px;height:72px;background:#FFFFFF;border-radius:9999px;text-align:center;line-height:72px;box-shadow:0 2px 8px rgba(0,0,0,0.18);">
                            <img src="${LOGO_URL}" alt="${escapeHtml(businessName)}" width="60" style="width:60px;height:60px;vertical-align:middle;">
                          </div>
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="font-size:20px;font-weight:800;letter-spacing:-0.01em;color:#FFFFFF;line-height:1;">Boxed<span style="color:#D9A441;">2</span>Built</div>
                          <div style="margin-top:7px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#8FA6C4;">We assemble. You enjoy.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;background:rgba(217,164,65,0.16);border:1px solid rgba(217,164,65,0.5);color:#F0C877;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:7px 13px;border-radius:9999px;">${escapeHtml(labels.header)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Invoice number band -->
          <tr>
            <td style="background:#0B1F3A;padding:18px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#7E93B0;">${escapeHtml(labels.bandTag)}</div>
                    <div style="margin-top:3px;font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:-0.01em;">${invoiceNum}</div>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#7E93B0;">${escapeHtml(amountLabel(invoice.invoice_type))}</div>
                    <div style="margin-top:3px;font-size:20px;font-weight:800;color:#4ADE80;letter-spacing:-0.01em;">${headlineStr}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:34px 40px 0 40px;">
              <p style="margin:0 0 14px 0;font-size:17px;font-weight:700;color:#111827;letter-spacing:-0.01em;">Hi ${firstName},</p>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#4B5563;">${greeting}</p>
            </td>
          </tr>

          <!-- Meta grid -->
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;">
                <tr>
                  <td width="50%" style="padding:16px 20px;border-right:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;">
                    <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;">Billed To</div>
                    <div style="margin-top:5px;font-size:14px;font-weight:600;color:#111827;">${clientNameEsc}</div>
                  </td>
                  <td width="50%" style="padding:16px 20px;border-bottom:1px solid #E5E7EB;">
                    <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;">${escapeHtml(labels.dateLabel)}</div>
                    <div style="margin-top:5px;font-size:14px;font-weight:600;color:#111827;">${invoiceDateStr}</div>
                  </td>
                </tr>
                ${metaBottomRow}
              </table>
            </td>
          </tr>

          <!-- Line items -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 10px 0;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;text-align:left;border-bottom:2px solid #E5E7EB;">Description</td>
                  <td style="padding:0 0 10px 0;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;text-align:center;border-bottom:2px solid #E5E7EB;">Qty</td>
                  <td style="padding:0 0 10px 0;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;text-align:right;border-bottom:2px solid #E5E7EB;">Unit</td>
                  <td style="padding:0 0 10px 0;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;text-align:right;border-bottom:2px solid #E5E7EB;">Total</td>
                </tr>
                ${buildLineItemsTable(lineItems)}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:18px 40px 0 40px;">
              ${buildTotalsBlock(invoice)}
            </td>
          </tr>

          ${notesBlock}

          <!-- Pay panel -->
          <tr>
            <td style="padding:30px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;">
                <tr>
                  <td align="center" style="padding:26px 24px;">
                    <div style="font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#15803D;">${escapeHtml(amountLabel(invoice.invoice_type))}</div>
                    <div style="margin:6px 0 18px 0;font-size:42px;font-weight:800;color:#0E2748;letter-spacing:-0.02em;line-height:1;">${headlineStr}</div>${payNote}
                    <a href="${payUrl}" style="display:inline-block;background:#15803D;color:#FFFFFF;font-size:16px;font-weight:700;padding:15px 42px;border-radius:10px;text-decoration:none;box-shadow:0 6px 14px -4px rgba(21,128,61,0.5);">Pay Now &rarr;</a>
                    <div style="margin-top:14px;font-size:13px;color:#374151;">Pay with Apple&nbsp;Pay, Google&nbsp;Pay, or any major card.</div>
                    <div style="margin-top:8px;font-size:12px;color:#6B7280;">Secured by Stripe &middot; Your card details are never stored on our servers.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Trust bar -->
          <tr>
            <td style="padding:22px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="font-size:12px;font-weight:600;color:#6B7280;">
                    <span style="color:#EAB308;">&#9733;&#9733;&#9733;&#9733;&#9733;</span>&nbsp; 5-Star Rated &nbsp;&middot;&nbsp; No Payment Until Done &nbsp;&middot;&nbsp; Locally Owned
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Help -->
          <tr>
            <td style="padding:26px 40px 30px 40px;">
              <div style="border-top:1px solid #EEF1F5;padding-top:22px;">
                <p style="margin:0 0 4px 0;font-size:14px;color:#4B5563;line-height:1.6;">Questions about this ${labels.noun}? Call or text <strong style="color:#111827;">${CONTACT_PHONE}</strong> anytime.</p>
                <p style="margin:0;font-size:14px;color:#4B5563;">&mdash; The ${escapeHtml(businessName)} Team</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0E2748;padding:26px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center">
                    <div style="width:64px;height:64px;background:#FFFFFF;border-radius:9999px;display:inline-block;text-align:center;line-height:64px;"><img src="${LOGO_URL}" alt="${escapeHtml(businessName)}" width="52" style="width:52px;height:52px;vertical-align:middle;"></div>
                    <div style="margin-top:8px;font-size:12px;color:#8FA6C4;">Furniture assembly &amp; TV mounting &middot; Spring Hill, TN</div>
                    <div style="margin-top:12px;font-size:12px;">
                      <a href="${WEBSITE_URL}" style="color:#B7C6DC;text-decoration:none;">boxed2built.com</a>
                      <span style="color:#3C567A;">&nbsp;&middot;&nbsp;</span>
                      <a href="mailto:${CONTACT_EMAIL}" style="color:#B7C6DC;text-decoration:none;">Email</a>
                      <span style="color:#3C567A;">&nbsp;&middot;&nbsp;</span>
                      <a href="${WEBSITE_URL}/privacy-policy" style="color:#B7C6DC;text-decoration:none;">Privacy</a>
                      <span style="color:#3C567A;">&nbsp;&middot;&nbsp;</span>
                      <a href="${WEBSITE_URL}/terms-of-service" style="color:#B7C6DC;text-decoration:none;">Terms</a>
                    </div>
                    <div style="margin-top:14px;font-size:11px;color:#5C749A;font-style:italic;">Turning boxes into comfort, one home at a time.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <div style="margin-top:16px;font-size:11px;color:#9CA3AF;">This ${labels.noun} was sent by ${escapeHtml(businessName)}, Spring Hill, TN.</div>
      </td>
    </tr>
  </table>
</div>
</body></html>`;
}

export function buildPlainText(clientName: string, invoice: Invoice, lineItems: LineItem[], payUrl: string): string {
  const firstName = (clientName.trim() || 'there').split(' ')[0] || 'there';
  const labels = invoiceLabels(invoice.invoice_type);
  const lines = [
    `Hi ${firstName},`,
    '',
    `Please find your ${labels.noun} details below.`,
    '',
    `${labels.type} #: ${invoice.invoice_number}`,
    `${labels.dateLabel}: ${formatDate(invoice.invoice_date)}`,
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
  lines.push(`${totalLabel(invoice.invoice_type)}: ${formatCurrency(headlineAmount(invoice.invoice_type, invoice))}`);
  lines.push('');
  lines.push(labels.isQuote ? '--- Pay Online (optional) ---' : '--- Pay Online ---');
  if (labels.isQuote) {
    lines.push("Nothing is due yet. Reply to this email if you'd like to go ahead and we'll get you scheduled.");
  }
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
    // F4: the published anon key is a valid JWT, so this function was reachable by
    // anyone. Sending an invoice (and honouring overrideEmail) requires staff.
    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status ?? 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Payload;

    if (!body?.clientId || !body?.organizationId || !body?.invoiceId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Where a test copy goes, resolved from the caller's own token — never from
    // overrideEmail, which is how the client is reached, not the admin. Decided
    // before any database work so a test with nobody to send to fails early.
    let testRecipient: string | null = null;
    if (body.test) {
      const resolved = testRecipientFrom(auth);
      if (!resolved.ok) {
        return new Response(JSON.stringify({ success: false, error: resolved.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      testRecipient = resolved.email;
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

    const recipientEmail: string | null = body.overrideEmail?.trim() || client.email?.trim() || null;
    const cooldownRemaining = cooldownSecondsRemaining(
      client.last_invoice_email_sent_at,
      COOLDOWN_MS,
    );

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

    const settled = invoice.status === 'paid' || invoice.status === 'cancelled';

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

    const subject = invoiceEmailSubject(
      invoice.invoice_type,
      invoice.invoice_number,
      formatCurrency(headlineAmount(invoice.invoice_type, invoice)),
    );
    const html = buildHtml(client.name, invoice as Invoice, (lineItems || []) as LineItem[], payUrl, businessName);
    const text = buildPlainText(client.name, invoice as Invoice, (lineItems || []) as LineItem[], payUrl);

    // A preview renders even when the guards below would refuse, and reports
    // which one refused: seeing the email is how you work out what to fix.
    // Nothing past this point runs, so nothing is sent and nothing is written.
    // The pay link it shows is live, which is the point — an admin checking the
    // email before it goes out should be able to follow it as the client will.
    if (body.preview) {
      return new Response(
        JSON.stringify({
          success: true,
          preview: {
            subject,
            html,
            text,
            recipient: recipientEmail,
            blocked: settled
              ? `This invoice is already ${invoice.status} and will not be sent.`
              : !recipientEmail
                ? 'This client has no email address on file.'
                : cooldownRemaining > 0
                  ? describeCooldown(cooldownRemaining)
                  : null,
          } satisfies EmailPreviewPayload,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Neither of these is waived for a test copy: a settled invoice or a client
    // with no address means this email is wrong rather than early, and a test
    // would only show something misleading.
    if (settled) {
      return new Response(JSON.stringify({ success: false, error: 'Invoice is already paid or cancelled.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ success: false, error: 'no_email' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The cooldown keeps the client from being billed twice over. A test copy
    // goes to the admin's own inbox, so it is not what that protects.
    if (!testRecipient && cooldownRemaining > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'cooldown', remainingSeconds: cooldownRemaining }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sendTo = testRecipient ?? recipientEmail;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Boxed2Built <${FROM_EMAIL}>`,
        to: [sendTo],
        ...(testRecipient ? {} : { bcc: [BCC_EMAIL] }),
        subject,
        html,
        text,
        reply_to: REPLY_TO_EMAIL,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error(`Resend API error: ${err}`);
    }

    const resendData = await resendRes.json();
    const messageId: string = resendData?.id ?? '';
    const now = new Date().toISOString();

    // A test copy went to the admin, not the client, so the invoice has not been
    // sent: the cooldown marker stays put and a draft stays a draft.
    if (!testRecipient) {
      await supabase.from('clients').update({ last_invoice_email_sent_at: now }).eq('id', client.id);

      if (invoice.status === 'draft') {
        await supabase.from('invoices').update({ status: 'sent', sent_at: now }).eq('id', invoice.id);
      }
    }

    // Logged either way: Resend will post delivery and open events for a test
    // send too, and a log missing the send they belong to reads as an orphan.
    await supabase.from('email_events').insert({
      resend_event_id: messageId ? `send-${messageId}` : null,
      message_id: messageId || null,
      event_type: 'email.sent',
      recipient: sendTo,
      subject,
      from_address: FROM_EMAIL,
      occurred_at: now,
      payload: {
        source: 'send-invoice-email',
        clientId: client.id,
        clientName: client.name,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        ...(testRecipient ? { test: true } : {}),
      },
    });

    return new Response(
      JSON.stringify(
        testRecipient
          ? { success: true, test: true, to: sendTo }
          : { success: true, sentAt: now, to: sendTo },
      ),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send invoice email.';
    console.error('send-invoice-email error:', error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
