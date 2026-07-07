import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { getBusinessContactPhone } from '../_shared/businessContact.ts';

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
const APP_URL = 'https://www.boxed2built.com';

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
    minimumFractionDigits: (cents % 100 === 0) ? 0 : 2,
  }).format((cents || 0) / 100);
}

interface GiftCardRow {
  id: string;
  code: string;
  initial_amount_cents: number;
  remaining_amount_cents: number;
  purchaser_name: string;
  purchaser_email: string;
  recipient_name: string | null;
  recipient_email: string | null;
  delivery_type: 'self' | 'recipient';
  personal_message: string | null;
  status: string;
}

function buildRecipientHtml(card: GiftCardRow, redeemUrl: string, contactPhone: string | null) {
  const firstName = (card.recipient_name || '').trim().split(' ')[0] || 'there';
  const purchaser = (card.purchaser_name || '').trim() || 'A friend';
  const msg = (card.personal_message || '').trim();
  const msgBlock = msg
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">A message for you</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;white-space:pre-line;">${escapeHtml(msg)}</p>
       </div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">You've received a Boxed2Built gift!</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">${escapeHtml(purchaser)} sent you service credit.</p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:32px;">
        <p style="margin:0 0 6px;color:#374151;font-size:16px;">Hi ${escapeHtml(firstName)},</p>
        <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">${escapeHtml(purchaser)} bought you a gift card for Boxed2Built — Spring Hill's furniture assembly and TV mounting pros. Use it the next time you need a hand.</p>

        <div style="text-align:center;background:linear-gradient(135deg,#0f766e,#14b8a6);border-radius:14px;padding:30px 24px;color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:.15em;text-transform:uppercase;opacity:.85;">Gift Card Value</p>
          <p style="margin:0 0 18px;font-size:40px;font-weight:800;">${money(card.initial_amount_cents)}</p>
          <div style="background:rgba(255,255,255,.12);border:1px dashed rgba(255,255,255,.5);border-radius:10px;padding:14px 18px;display:inline-block;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:.15em;text-transform:uppercase;opacity:.8;">Your code</p>
            <p style="margin:0;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:22px;letter-spacing:2px;font-weight:700;">${escapeHtml(card.code)}</p>
          </div>
        </div>

        ${msgBlock}

        <div style="text-align:center;padding:20px 0;">
          <a href="${redeemUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;">Redeem Your Gift &rarr;</a>
        </div>

        <div style="border-top:1px solid #f3f4f6;margin-top:20px;padding-top:20px;">
          <p style="margin:0 0 6px;color:#111827;font-size:13px;font-weight:700;">How it works</p>
          <ul style="margin:0;padding-left:18px;color:#4b5563;font-size:13px;line-height:1.7;">
            <li>Request a quote on our site and include your code.</li>
            <li>We'll apply the credit to your final invoice.</li>
            <li>Unused balance stays on the card — your credit never expires.</li>
          </ul>
        </div>

        <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">${contactPhone ? `Questions? Call or text ${contactPhone}.` : ""}</p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:20px 32px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">Boxed2Built &bull; Spring Hill, TN &bull; <a href="${WEBSITE_URL}" style="color:#9ca3af;">boxed2built.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildPurchaserHtml(card: GiftCardRow, redeemUrl: string, contactPhone: string | null) {
  const firstName = (card.purchaser_name || '').trim().split(' ')[0] || 'there';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Your Boxed2Built gift card is ready</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">Thanks for your purchase, ${escapeHtml(firstName)}.</p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:32px;">
        <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">Here's your gift card — keep this email for safe-keeping.</p>

        <div style="text-align:center;background:linear-gradient(135deg,#0f766e,#14b8a6);border-radius:14px;padding:30px 24px;color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:.15em;text-transform:uppercase;opacity:.85;">Gift Card Value</p>
          <p style="margin:0 0 18px;font-size:40px;font-weight:800;">${money(card.initial_amount_cents)}</p>
          <div style="background:rgba(255,255,255,.12);border:1px dashed rgba(255,255,255,.5);border-radius:10px;padding:14px 18px;display:inline-block;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:.15em;text-transform:uppercase;opacity:.8;">Your code</p>
            <p style="margin:0;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:22px;letter-spacing:2px;font-weight:700;">${escapeHtml(card.code)}</p>
          </div>
        </div>

        <div style="text-align:center;padding:20px 0;">
          <a href="${redeemUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;">Redeem Your Gift &rarr;</a>
        </div>

        <div style="border-top:1px solid #f3f4f6;margin-top:20px;padding-top:20px;">
          <p style="margin:0 0 6px;color:#111827;font-size:13px;font-weight:700;">How to use your gift card</p>
          <ul style="margin:0;padding-left:18px;color:#4b5563;font-size:13px;line-height:1.7;">
            <li>Request a quote and add your code.</li>
            <li>We'll apply the credit to your final invoice.</li>
            <li>Partial balances roll over and never expire.</li>
          </ul>
        </div>

        <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">${contactPhone ? `Questions? Call or text ${contactPhone}.` : ""}</p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:20px 32px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">Boxed2Built &bull; Spring Hill, TN &bull; <a href="${WEBSITE_URL}" style="color:#9ca3af;">boxed2built.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildPlainText(card: GiftCardRow, redeemUrl: string, toRecipient: boolean, contactPhone: string | null) {
  const greetName = toRecipient
    ? ((card.recipient_name || '').trim().split(' ')[0] || 'there')
    : ((card.purchaser_name || '').trim().split(' ')[0] || 'there');
  const lines = [
    `Hi ${greetName},`,
    '',
    toRecipient
      ? `${card.purchaser_name || 'A friend'} sent you a Boxed2Built gift card.`
      : 'Thank you for your Boxed2Built gift card purchase.',
    '',
    `Amount: ${money(card.initial_amount_cents)}`,
    `Code: ${card.code}`,
    '',
    `Redeem: ${redeemUrl}`,
    '',
    'Your credit never expires. Partial balances roll over.',
  ];
  if (contactPhone) lines.push(`Questions? Call or text ${contactPhone}.`);
  lines.push('', '— The Boxed2Built Team');
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { gift_card_id } = (await req.json()) as { gift_card_id?: string };
    if (!gift_card_id) {
      return new Response(JSON.stringify({ error: 'gift_card_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: card, error } = await supabase
      .from('gift_cards')
      .select('id, code, initial_amount_cents, remaining_amount_cents, purchaser_name, purchaser_email, recipient_name, recipient_email, delivery_type, personal_message, status')
      .eq('id', gift_card_id)
      .maybeSingle();

    if (error || !card) {
      return new Response(JSON.stringify({ error: 'Gift card not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (card.status === 'pending' || card.status === 'failed' || card.status === 'voided') {
      return new Response(JSON.stringify({ error: `Cannot send email for ${card.status} card` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const redeemUrl = `${APP_URL}/redeem-gift-card?code=${encodeURIComponent(card.code)}`;
    const contact = await getBusinessContactPhone(supabase);
    const toRecipient = card.delivery_type === 'recipient' && !!card.recipient_email;
    const toAddress = toRecipient ? card.recipient_email! : card.purchaser_email;
    const subject = toRecipient
      ? `You've received a ${money(card.initial_amount_cents)} Boxed2Built gift card`
      : `Your ${money(card.initial_amount_cents)} Boxed2Built gift card`;
    const html = toRecipient
      ? buildRecipientHtml(card as GiftCardRow, redeemUrl, contact.display)
      : buildPurchaserHtml(card as GiftCardRow, redeemUrl, contact.display);
    const text = buildPlainText(card as GiftCardRow, redeemUrl, toRecipient, contact.display);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Boxed2Built <${FROM_EMAIL}>`,
        to: [toAddress],
        bcc: [BCC_EMAIL],
        subject,
        html,
        text,
        reply_to: FROM_EMAIL,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: `Resend: ${err}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendData = await resendRes.json().catch(() => ({}));
    const messageId: string = resendData?.id || '';
    const now = new Date().toISOString();

    // Best-effort email activity tracking (table may exist in this project)
    try {
      await supabase.from('email_events').insert({
        resend_event_id: messageId ? `send-${messageId}` : null,
        message_id: messageId || null,
        event_type: 'email.sent',
        recipient: toAddress,
        subject,
        from_address: FROM_EMAIL,
        occurred_at: now,
        payload: {
          source: 'send-gift-card-email',
          giftCardId: card.id,
          giftCardCode: card.code,
          deliveryType: card.delivery_type,
        },
      });
    } catch (e) {
      // Non-fatal
      console.warn('email_events insert failed:', e);
    }

    return new Response(JSON.stringify({ success: true, sentAt: now }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-gift-card-email error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
