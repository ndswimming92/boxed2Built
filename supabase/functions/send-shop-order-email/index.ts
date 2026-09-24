import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { getBusinessContactPhone } from '../_shared/businessContact.ts';
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
// team@boxed2built.com cannot receive mail — it hard-bounces. This is the
// address that actually accepts replies.
const REPLY_TO_EMAIL = 'replies@reply.boxed2built.com';
const BCC_EMAIL = 'nicholas.davidson@boxed2built.com';
const APP_URL = 'https://www.boxed2built.com';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(input: string): string {
  return (input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format((cents || 0) / 100);
}

interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  fulfillment_method: 'shipping' | 'pickup';
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  customer_note: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  status: string;
}

interface ItemRow {
  product_name: string;
  quantity: number;
  line_total_cents: number;
}

function buildHtml(
  order: OrderRow,
  items: ItemRow[],
  pickupInstructions: string | null,
  contactPhone: string | null,
): string {
  const firstName = (order.customer_name || '').trim().split(' ')[0] || 'there';

  const itemRows = items
    .map(
      (item) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#334155;font-size:14px;">
          ${escapeHtml(item.product_name)} <span style="color:#94a3b8;">× ${item.quantity}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">
          ${money(item.line_total_cents)}
        </td>
      </tr>`,
    )
    .join('');

  const deliveryBlock =
    order.fulfillment_method === 'pickup'
      ? `<p style="margin:0;color:#334155;font-size:14px;line-height:1.7;">
           <strong>Local pickup.</strong> ${escapeHtml(
             pickupInstructions || "We'll email you as soon as it's printed and ready.",
           )}
         </p>`
      : `<p style="margin:0;color:#334155;font-size:14px;line-height:1.7;">
           <strong>Shipping to</strong><br>
           ${escapeHtml(order.shipping_line1 || '')}${
             order.shipping_line2 ? `<br>${escapeHtml(order.shipping_line2)}` : ''
           }<br>
           ${escapeHtml(order.shipping_city || '')}, ${escapeHtml(order.shipping_state || '')} ${escapeHtml(
             order.shipping_postal_code || '',
           )}
         </p>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Thanks for your order, ${escapeHtml(
          firstName,
        )}!</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">Order ${escapeHtml(
          order.order_number,
        )} · Boxed2Built Print Shop</p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:32px;">
        <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.7;">
          Your print is queued up. We'll email you again the moment it's on the way.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0">
          ${itemRows}
          <tr>
            <td style="padding:10px 0;color:#64748b;font-size:14px;">${
              order.fulfillment_method === 'pickup' ? 'Local pickup' : 'Shipping'
            }</td>
            <td style="padding:10px 0;color:#334155;font-size:14px;text-align:right;">${
              order.shipping_cents === 0 ? 'Free' : money(order.shipping_cents)
            }</td>
          </tr>
          ${
            order.tax_cents > 0
              ? `<tr>
                   <td style="padding:10px 0;color:#64748b;font-size:14px;">Sales tax</td>
                   <td style="padding:10px 0;color:#334155;font-size:14px;text-align:right;">${money(
                     order.tax_cents,
                   )}</td>
                 </tr>`
              : ''
          }
          <tr>
            <td style="padding:14px 0 0;color:#0f172a;font-size:16px;font-weight:700;border-top:2px solid #e2e8f0;">Total</td>
            <td style="padding:14px 0 0;color:#0f172a;font-size:16px;font-weight:700;text-align:right;border-top:2px solid #e2e8f0;">${money(
              order.total_cents,
            )}</td>
          </tr>
        </table>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:24px 0;">
          ${deliveryBlock}
        </div>

        ${
          order.customer_note
            ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                 <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.5px;">Your note</p>
                 <p style="margin:0;color:#78350f;font-size:14px;line-height:1.7;white-space:pre-line;">${escapeHtml(
                   order.customer_note,
                 )}</p>
               </div>`
            : ''
        }

        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">
          Questions about this order? Reply to this email${
            contactPhone ? ` or call us at ${escapeHtml(contactPhone)}` : ''
          }.
        </p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:0 32px 32px;border-radius:0 0 12px 12px;">
        <a href="${APP_URL}/store" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px;">Back to the shop</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildText(order: OrderRow, items: ItemRow[], contactPhone: string | null): string {
  const lines = [
    `Thanks for your order! (${order.order_number})`,
    '',
    ...items.map((item) => `- ${item.product_name} x${item.quantity}: ${money(item.line_total_cents)}`),
    `${order.fulfillment_method === 'pickup' ? 'Local pickup' : 'Shipping'}: ${
      order.shipping_cents === 0 ? 'Free' : money(order.shipping_cents)
    }`,
  ];

  if (order.tax_cents > 0) lines.push(`Sales tax: ${money(order.tax_cents)}`);
  lines.push(`Total: ${money(order.total_cents)}`, '');

  if (order.fulfillment_method === 'shipping') {
    lines.push(
      'Shipping to:',
      [order.shipping_line1, order.shipping_line2].filter(Boolean).join(', '),
      `${order.shipping_city}, ${order.shipping_state} ${order.shipping_postal_code}`,
      '',
    );
  }

  lines.push(
    `We'll email you again as soon as it ships or is ready for pickup.${
      contactPhone ? ` Questions? Call ${contactPhone}.` : ''
    }`,
    '',
    '— The Boxed2Built Team',
  );

  return lines.join('\n');
}

function buildAdminHtml(order: OrderRow, items: ItemRow[]): string {
  const itemRows = items
    .map(
      (item) => `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:14px;">
          ${escapeHtml(item.product_name)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:14px;text-align:center;">
          ${item.quantity}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">
          ${money(item.line_total_cents)}
        </td>
      </tr>`,
    )
    .join('');

  const addressBlock =
    order.fulfillment_method === 'shipping'
      ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:120px;">Address</td>
           <td style="padding:6px 0;color:#0f172a;font-size:13px;">
             ${escapeHtml(order.shipping_line1 || '')}${order.shipping_line2 ? `, ${escapeHtml(order.shipping_line2)}` : ''}<br>
             ${escapeHtml(order.shipping_city || '')}, ${escapeHtml(order.shipping_state || '')} ${escapeHtml(order.shipping_postal_code || '')}
           </td></tr>`
      : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#dc2626;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">New Store Order!</h1>
        <p style="margin:6px 0 0;color:#fecaca;font-size:14px;">Order ${escapeHtml(order.order_number)} &bull; ${money(order.total_cents)}</p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:28px 32px;">
        <h2 style="margin:0 0 16px;color:#0f172a;font-size:16px;font-weight:700;">Customer Info</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:120px;">Name</td>
              <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">${escapeHtml(order.customer_name)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Email</td>
              <td style="padding:6px 0;color:#0f172a;font-size:13px;">${escapeHtml(order.customer_email)}</td></tr>
          ${(order as any).customer_phone ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Phone</td>
              <td style="padding:6px 0;color:#0f172a;font-size:13px;">${escapeHtml((order as any).customer_phone)}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Fulfillment</td>
              <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">${order.fulfillment_method === 'pickup' ? 'Local Pickup' : 'Shipping'}</td></tr>
          ${addressBlock}
        </table>

        <h2 style="margin:0 0 12px;color:#0f172a;font-size:16px;font-weight:700;">Items Ordered</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr style="background:#f8fafc;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #e2e8f0;">Product</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #e2e8f0;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #e2e8f0;">Total</th>
          </tr>
          ${itemRows}
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e2e8f0;padding-top:12px;">
          <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Subtotal</td>
              <td style="padding:4px 0;color:#334155;font-size:13px;text-align:right;">${money(order.subtotal_cents)}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">${order.fulfillment_method === 'pickup' ? 'Pickup' : 'Shipping'}</td>
              <td style="padding:4px 0;color:#334155;font-size:13px;text-align:right;">${order.shipping_cents === 0 ? 'Free' : money(order.shipping_cents)}</td></tr>
          ${order.tax_cents > 0 ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Tax</td>
              <td style="padding:4px 0;color:#334155;font-size:13px;text-align:right;">${money(order.tax_cents)}</td></tr>` : ''}
          <tr><td style="padding:10px 0 0;color:#0f172a;font-size:16px;font-weight:700;border-top:2px solid #e2e8f0;">Total</td>
              <td style="padding:10px 0 0;color:#0f172a;font-size:16px;font-weight:700;text-align:right;border-top:2px solid #e2e8f0;">${money(order.total_cents)}</td></tr>
        </table>

        ${order.customer_note ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin:20px 0 0;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.5px;">Customer Note</p>
          <p style="margin:0;color:#78350f;font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(order.customer_note)}</p>
        </div>` : ''}
      </td></tr>
      <tr><td style="background:#ffffff;padding:0 32px 28px;border-radius:0 0 12px 12px;">
        <a href="${APP_URL}/admin/store-orders" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px;">View in Admin Portal</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildAdminText(order: OrderRow, items: ItemRow[]): string {
  const lines = [
    `NEW STORE ORDER: ${order.order_number}`,
    '',
    `Customer: ${order.customer_name}`,
    `Email: ${order.customer_email}`,
    ...((order as any).customer_phone ? [`Phone: ${(order as any).customer_phone}`] : []),
    `Fulfillment: ${order.fulfillment_method === 'pickup' ? 'Local Pickup' : 'Shipping'}`,
  ];

  if (order.fulfillment_method === 'shipping') {
    lines.push(
      `Ship to: ${[order.shipping_line1, order.shipping_line2].filter(Boolean).join(', ')}`,
      `         ${order.shipping_city}, ${order.shipping_state} ${order.shipping_postal_code}`,
    );
  }

  lines.push('', 'Items:');
  for (const item of items) {
    lines.push(`  - ${item.product_name} x${item.quantity}: ${money(item.line_total_cents)}`);
  }

  lines.push(
    '',
    `Subtotal: ${money(order.subtotal_cents)}`,
    `${order.fulfillment_method === 'pickup' ? 'Pickup' : 'Shipping'}: ${order.shipping_cents === 0 ? 'Free' : money(order.shipping_cents)}`,
  );
  if (order.tax_cents > 0) lines.push(`Tax: ${money(order.tax_cents)}`);
  lines.push(`Total: ${money(order.total_cents)}`);

  if (order.customer_note) {
    lines.push('', `Customer Note: ${order.customer_note}`);
  }

  lines.push('', `View in admin: ${APP_URL}/admin/store-orders`);

  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!RESEND_API_KEY) return json({ error: 'Email service not configured' }, 500);

  try {
    // F17: order receipts expose customer contact and purchase detail, so only the
    // checkout/webhook path (service role) and signed-in staff may trigger them.
    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) return json({ error: auth.error ?? 'Unauthorized' }, auth.status ?? 401);

    const { order_id } = (await req.json()) as { order_id?: string };
    if (!order_id) return json({ error: 'order_id required' }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error } = await supabase
      .from('shop_orders')
      .select(
        'id, order_number, customer_name, customer_email, customer_phone, fulfillment_method, shipping_line1, shipping_line2, shipping_city, shipping_state, shipping_postal_code, customer_note, subtotal_cents, shipping_cents, tax_cents, total_cents, status',
      )
      .eq('id', order_id)
      .maybeSingle();

    if (error || !order) return json({ error: 'Order not found' }, 404);
    if (order.status === 'pending' || order.status === 'failed') {
      return json({ error: `Cannot send a receipt for a ${order.status} order` }, 400);
    }
    if (!order.customer_email) return json({ error: 'Order has no email address' }, 400);

    const { data: items } = await supabase
      .from('shop_order_items')
      .select('product_name, quantity, line_total_cents')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    const { data: settings } = await supabase
      .from('shop_settings')
      .select('pickup_instructions')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const contact = await getBusinessContactPhone(supabase);
    const subject = `Order ${order.order_number} confirmed — Boxed2Built Print Shop`;
    const html = buildHtml(
      order as OrderRow,
      (items ?? []) as ItemRow[],
      settings?.pickup_instructions ?? null,
      contact.display,
    );
    const text = buildText(order as OrderRow, (items ?? []) as ItemRow[], contact.display);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Boxed2Built <${FROM_EMAIL}>`,
        to: [order.customer_email],
        subject,
        html,
        text,
        reply_to: REPLY_TO_EMAIL,
      }),
    });

    // Send a separate admin notification email with full order details
    try {
      const adminSubject = `New Store Order ${order.order_number} — ${money(order.total_cents)}`;
      const adminHtml = buildAdminHtml(order as OrderRow, (items ?? []) as ItemRow[]);
      const adminText = buildAdminText(order as OrderRow, (items ?? []) as ItemRow[]);
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Boxed2Built <${FROM_EMAIL}>`,
          to: [BCC_EMAIL],
          subject: adminSubject,
          html: adminHtml,
          text: adminText,
          reply_to: REPLY_TO_EMAIL,
        }),
      });
    } catch (adminEmailErr) {
      console.warn('Admin notification email failed:', adminEmailErr);
    }

    if (!resendRes.ok) {
      const errorText = await resendRes.text();
      console.error('Resend error:', errorText);
      return json({ error: `Resend: ${errorText}` }, 502);
    }

    const resendData = await resendRes.json().catch(() => ({}));
    const messageId: string = resendData?.id || '';
    const now = new Date().toISOString();

    // Best-effort email activity tracking.
    try {
      await supabase.from('email_events').insert({
        resend_event_id: messageId ? `send-${messageId}` : null,
        message_id: messageId || null,
        event_type: 'email.sent',
        recipient: order.customer_email,
        subject,
        from_address: FROM_EMAIL,
        occurred_at: now,
        payload: {
          source: 'send-shop-order-email',
          orderId: order.id,
          orderNumber: order.order_number,
          fulfillmentMethod: order.fulfillment_method,
        },
      });
    } catch (trackingError) {
      console.warn('email_events insert failed:', trackingError);
    }

    return json({ success: true, sentAt: now });
  } catch (error) {
    console.error('send-shop-order-email error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
