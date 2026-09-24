import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import {
  BUSINESS_TIMEZONE,
  buildFallbackPromoMessage,
  couponShareUrl,
  describeActiveWindow,
  describeDiscount,
  draftPromoMessage,
  type CouponPromoRow,
} from '../_shared/couponPromo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const FROM_EMAIL = 'team@boxed2built.com';
// team@boxed2built.com cannot receive mail — it hard-bounces. This is the
// address that actually accepts replies.
const REPLY_TO_EMAIL = 'replies@reply.boxed2built.com';
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://boxed2built.com';
const ADMIN_COUPONS_URL = `${SITE_URL.replace(/\/+$/, '')}/admin/coupons`;

/** Where the reminder lands. Falls back to the business contact address. */
const NOTIFY_EMAIL_OVERRIDE = Deno.env.get('COUPON_PROMO_NOTIFY_EMAIL');

/**
 * How far ahead of the post time the reminder goes out. The cron tick is
 * hourly, so a 24 means the email lands between 23 and 24 hours before.
 */
const LEAD_HOURS = Number(Deno.env.get('COUPON_PROMO_REMINDER_LEAD_HOURS') ?? '24');

const COUPON_COLUMNS =
  'id, code, description, discount_type, discount_value, starts_at, ends_at, is_active, ' +
  'promote, promo_post_at, promo_message, promo_reminder_sent_at, promo_reminder_for, ' +
  'facebook_post_id, facebook_posted_at, facebook_post_error';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** "Tomorrow, September 1 at 9:00 AM CT" — the deadline, in words. */
function formatPostTime(iso: string): string {
  return `${new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  })} CT`;
}

interface ReminderFacts {
  title: string;
  discount: string;
  activeFor: string;
  postTime: string;
  message: string;
  shareUrl: string;
  warning: string | null;
}

function gather(coupon: CouponPromoRow, message: string): ReminderFacts {
  const overdue = coupon.promo_post_at !== null && new Date(coupon.promo_post_at) <= new Date();

  let warning: string | null = null;
  if (!coupon.is_active) {
    warning = `Heads up: ${coupon.code} is currently switched off. Turn it on before you post, or the form will refuse it.`;
  } else if (overdue) {
    warning = `This one was due to go out already — it is still unposted.`;
  }

  return {
    title: coupon.description?.trim() ? `${coupon.code} — ${coupon.description.trim()}` : coupon.code,
    discount: describeDiscount(coupon),
    activeFor: describeActiveWindow(coupon.starts_at, coupon.ends_at),
    postTime: coupon.promo_post_at ? formatPostTime(coupon.promo_post_at) : 'No post time set',
    message,
    shareUrl: couponShareUrl(coupon.code, SITE_URL),
    warning,
  };
}

/** Plain-text alternative. Sending html without it hurts deliverability. */
function buildEmailText(facts: ReminderFacts): string {
  const lines = [
    `Time to post: ${facts.title}`,
    '',
    `Post it: ${facts.postTime}`,
    `Discount: ${facts.discount}`,
    `Active for: ${facts.activeFor}`,
  ];
  if (facts.warning) lines.push('', facts.warning);
  lines.push(
    '',
    '--- The post ---',
    '',
    facts.message,
    '',
    '----------------',
    '',
    `Prefilled quote link: ${facts.shareUrl}`,
    '',
    `Post it to Facebook in one click: ${ADMIN_COUPONS_URL}`,
  );
  return lines.join('\n');
}

function buildEmailHtml(facts: ReminderFacts): string {
  const rows: Array<[string, string]> = [
    ['Post it', facts.postTime],
    ['Discount', facts.discount],
    ['Active for', facts.activeFor],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
          </tr>`,
    )
    .join('');

  const warningHtml = facts.warning
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin-bottom:22px;">
         <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">${escapeHtml(facts.warning)}</p>
       </div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="background:#1e3a5f;padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Time to post ${escapeHtml(facts.title)}</h1>
        <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">${escapeHtml(facts.discount)} &middot; ${escapeHtml(facts.postTime)}</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:32px;">
        ${warningHtml}
        <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>

        <p style="margin:26px 0 8px;color:#6b7280;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">The post</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px 22px;">
          <p style="margin:0;color:#111827;font-size:14px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(facts.message)}</p>
        </div>
        <p style="margin:10px 0 0;color:#9ca3af;font-size:12px;line-height:1.6;">
          Copy that straight out if you are posting by hand, or use the button below and it goes to your Facebook Page as it stands.
        </p>

        <div style="text-align:center;margin-top:28px;">
          <a href="${ADMIN_COUPONS_URL}" style="display:inline-block;background:#059669;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:11px 24px;border-radius:6px;">Post it from the admin portal &rarr;</a>
        </div>
      </td></tr>

      <tr><td style="background:#ffffff;padding:0 32px 28px;border-radius:0 0 12px 12px;">
        <p style="margin:0;padding-top:18px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.6;">
          Sent ${LEAD_HOURS} hours before a promoted coupon is due to be posted. One reminder per code &mdash; move its post date and a fresh one goes out.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // Sends mail on behalf of the business, so only the cron caller (service
    // role) or signed-in staff may trigger a run.
    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) return json({ error: auth.error ?? 'Unauthorized' }, auth.status ?? 401);

    if (!RESEND_API_KEY) {
      return json({ error: 'Email is not configured (RESEND_API_KEY missing).' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    /** "Send mine now" from the admin page: one coupon, ignoring the window. */
    const onlyCouponId = body?.coupon_id as string | undefined;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: business } = await admin
      .from('business_info')
      .select('name, email')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const recipient = NOTIFY_EMAIL_OVERRIDE?.trim() || business?.email?.trim();
    if (!recipient) {
      return json({ error: 'No reminder address: set COUPON_PROMO_NOTIFY_EMAIL or a business email.' }, 500);
    }

    let query = admin
      .from('coupons')
      .select(COUPON_COLUMNS)
      .eq('promote', true)
      .not('promo_post_at', 'is', null)
      .is('facebook_posted_at', null)
      .order('promo_post_at', { ascending: true });

    if (onlyCouponId) {
      query = query.eq('id', onlyCouponId);
    } else {
      const dueBy = new Date(Date.now() + LEAD_HOURS * 3_600_000).toISOString();
      query = query.lte('promo_post_at', dueBy);
    }

    const { data: candidates, error: dueErr } = await query.returns<CouponPromoRow[]>();
    if (dueErr) throw new Error(dueErr.message);
    if (!candidates || candidates.length === 0) return json({ sent: 0 });

    // Keying "already reminded" off the post time rather than a flag means
    // moving the date re-arms the reminder while editing the message does not.
    const due = onlyCouponId
      ? candidates
      : candidates.filter((c) => c.promo_reminder_for !== c.promo_post_at);
    if (due.length === 0) return json({ sent: 0 });

    const apiKey =
      Deno.env.get('Claude_Coupon_Promo') ?? Deno.env.get('Claude_Gallery_Image_Creation');

    const results: { code: string; sent: boolean; error?: string }[] = [];

    for (const coupon of due) {
      try {
        // Claim the reminder before sending. A slow send or an overlapping tick
        // would otherwise mail the same coupon twice, and the whole point of
        // this job is that it stays quiet enough to be trusted.
        const { data: claimed } = await admin
          .from('coupons')
          .update({ promo_reminder_for: coupon.promo_post_at, promo_reminder_sent_at: new Date().toISOString() })
          .eq('id', coupon.id)
          .eq('promo_post_at', coupon.promo_post_at!)
          .select('id')
          .maybeSingle();
        if (!claimed) continue;

        // The email has to carry a postable message, so a code that has never
        // been drafted gets one now. Claude improves it; the fallback ships it.
        let message = coupon.promo_message?.trim() ?? '';
        if (!message) {
          if (apiKey) {
            const draft = await draftPromoMessage(coupon, apiKey, SITE_URL);
            if (draft.error) console.error(`send-coupon-promo-reminders ${coupon.code}: ${draft.error}`);
            message = draft.message ?? '';
          }
          if (!message) message = buildFallbackPromoMessage(coupon, SITE_URL);
          await admin.from('coupons').update({ promo_message: message }).eq('id', coupon.id);
        }

        const facts = gather(coupon, message);

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${business?.name?.trim() || 'Boxed2Built'} <${FROM_EMAIL}>`,
            to: [recipient],
            subject: `Post tomorrow: ${coupon.code} — ${facts.discount}`,
            html: buildEmailHtml(facts),
            text: buildEmailText(facts),
            reply_to: REPLY_TO_EMAIL,
          }),
        });

        if (!emailResponse.ok) {
          const detail = await emailResponse.text();
          console.error('send-coupon-promo-reminders: Resend rejected the send', emailResponse.status, detail);
          // Release the claim so the next tick tries again rather than leaving
          // the reminder silently unsent.
          await admin
            .from('coupons')
            .update({ promo_reminder_for: coupon.promo_reminder_for, promo_reminder_sent_at: coupon.promo_reminder_sent_at })
            .eq('id', coupon.id);
          results.push({ code: coupon.code, sent: false, error: `Resend returned ${emailResponse.status}` });
          continue;
        }

        results.push({ code: coupon.code, sent: true });
      } catch (couponError) {
        console.error(`send-coupon-promo-reminders: ${coupon.code} failed:`, couponError);
        results.push({
          code: coupon.code,
          sent: false,
          error: couponError instanceof Error ? couponError.message : 'Unknown error',
        });
      }
    }

    return json({ sent: results.filter((r) => r.sent).length, sentTo: recipient, results });
  } catch (error) {
    console.error('send-coupon-promo-reminders error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
