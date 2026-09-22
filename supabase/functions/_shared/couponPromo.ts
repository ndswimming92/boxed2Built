/*
 * The wording a coupon promotion needs, in the two places that need it: the
 * reminder email and the Facebook post.
 *
 * Both have to describe the same code the same way — "$25 off", "good through
 * Sunday the 30th" — so the phrasing lives here rather than being written twice
 * and drifting. `src/utils/coupon.ts` is the browser's copy of the same rules;
 * edge functions cannot import from `src/`, so the overlap is deliberate and
 * small: money and dates, nothing else.
 */

/** Spring Hill, TN. Dates are meaningless without it — see notify-qr-scan. */
export const BUSINESS_TIMEZONE = 'America/Chicago';

export interface CouponPromoRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  promote: boolean;
  promo_post_at: string | null;
  promo_message: string | null;
  promo_reminder_sent_at: string | null;
  promo_reminder_for: string | null;
  facebook_post_id: string | null;
  facebook_posted_at: string | null;
  facebook_post_error: string | null;
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2).replace(/\.00$/, '')}`;
}

/** "$25 off" / "10% off". Matches describeDiscount() in src/utils/coupon.ts. */
export function describeDiscount(coupon: Pick<CouponPromoRow, 'discount_type' | 'discount_value'>): string {
  const value = Number(coupon.discount_value);
  if (coupon.discount_type === 'percentage') {
    const shown = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
    return `${shown}% off`;
  }
  return `${formatMoney(value)} off`;
}

function formatDate(iso: string, endInclusive = false): string {
  const date = new Date(iso);
  // `ends_at` is the midnight *after* the last valid day, so the day a customer
  // would call the deadline is the day before the stored instant.
  if (endInclusive) date.setDate(date.getDate() - 1);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: BUSINESS_TIMEZONE,
  });
}

/**
 * "Monday, September 1 through Tuesday, September 30 (30 days)" — the answer to
 * "how long will it be active for", which is the whole reason the reminder
 * quotes a window rather than a raw pair of timestamps.
 */
export function describeActiveWindow(startsAt: string | null, endsAt: string | null): string {
  if (startsAt && endsAt) {
    return `${formatDate(startsAt)} through ${formatDate(endsAt, true)} (${describeDuration(startsAt, endsAt)})`;
  }
  if (startsAt) return `From ${formatDate(startsAt)}, with no end date set`;
  if (endsAt) return `Through ${formatDate(endsAt, true)} (${describeDuration(new Date().toISOString(), endsAt)} left)`;
  return 'Live as soon as it is switched on, with no end date set';
}

/** "30 days" / "1 day". Whole days, because the window is set in whole days. */
export function describeDuration(startsAt: string, endsAt: string): string {
  const days = Math.max(1, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 86_400_000));
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * "Tuesday, September 30" — the last day a customer can actually use the code.
 *
 * Exported so the Wallet pass and the reminder email cannot disagree about the
 * deadline: `ends_at` is the midnight *after* the last valid day, and getting
 * that off by one is the single easiest mistake to make with this column.
 */
export function describeValidThrough(endsAt: string): string {
  return formatDate(endsAt, true);
}

/** The quote form with the code already filled in and applied. */
export function couponShareUrl(code: string, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/contact?coupon=${encodeURIComponent(code)}`;
}

/**
 * What gets posted when Claude is unavailable or has not been asked yet.
 *
 * Every promotion is postable without an API call — a reminder email that says
 * "draft failed, write something yourself" would defeat the point of the
 * reminder. Claude makes the message better; it is not what makes it exist.
 */
export function buildFallbackPromoMessage(coupon: CouponPromoRow, siteUrl: string): string {
  const discount = describeDiscount(coupon);
  const lines = [
    `Take ${discount} your next furniture assembly with code ${coupon.code}.`,
    '',
  ];

  if (coupon.ends_at) {
    lines.push(`Good through ${formatDate(coupon.ends_at, true)} — enter the code when you request your quote.`);
  } else {
    lines.push('Enter the code when you request your quote.');
  }

  lines.push('', couponShareUrl(coupon.code, siteUrl), '', '#Boxed2Built');
  return lines.join('\n');
}

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const CLAUDE_VERSION = '2023-06-01';

const PROMO_SYSTEM_PROMPT =
  `You write short Facebook posts for Boxed2Built, a labor-only furniture ` +
  `assembly and mounting service in Spring Hill, Tennessee. The audience is ` +
  `local homeowners and renters who have a flat-pack box they do not want to ` +
  `open.\n\n` +
  `Voice: plain, warm, matter-of-fact. A neighbour who is good at this, not a ` +
  `brand. No hype words ("amazing", "incredible", "don't miss out"), no ` +
  `manufactured urgency beyond the real deadline, no emoji walls — one emoji ` +
  `at most, and none is fine.\n\n` +
  `Rules for the post:\n` +
  `- 4 to 6 short lines, under 600 characters all in.\n` +
  `- Open with the offer in plain words, not with the code.\n` +
  `- Name the code exactly as given, in caps, on its own line.\n` +
  `- State the discount and, if there is one, the real deadline date.\n` +
  `- Close with the link you are given on its own line.\n` +
  `- End with #Boxed2Built. Two or three further local hashtags are fine.\n` +
  `- Never invent services, prices, guarantees or dates beyond what you are told.\n\n` +
  `Respond with the post text only. No preamble, no quotation marks, no ` +
  `commentary about what you wrote.`;

/**
 * Drafts the post with Claude, or returns null so the caller can fall back.
 *
 * Never throws: this runs inside the reminder job as well as behind the admin
 * button, and a Claude outage must not stop a reminder going out.
 */
export async function draftPromoMessage(
  coupon: CouponPromoRow,
  apiKey: string,
  siteUrl: string,
): Promise<{ message: string | null; error: string | null }> {
  const facts = [
    `Code: ${coupon.code}`,
    `Discount: ${describeDiscount(coupon)}`,
    `Active: ${describeActiveWindow(coupon.starts_at, coupon.ends_at)}`,
    `Link: ${couponShareUrl(coupon.code, siteUrl)}`,
  ];
  if (coupon.description?.trim()) {
    facts.push(`What this promotion is for (context for you, not text to quote): ${coupon.description.trim()}`);
  }

  try {
    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': CLAUDE_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 4096,
        // A four-line promo is not a reasoning problem. Low effort keeps the
        // draft cheap and quick without turning thinking off, which on Opus 5
        // has its own failure modes.
        output_config: { effort: 'low' },
        system: PROMO_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `${facts.join('\n')}\n\nWrite the post.` }],
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { message: null, error: body?.error?.message || `Claude returned ${res.status}` };
    }
    if (body?.stop_reason === 'refusal') {
      return { message: null, error: 'Claude declined to write this post.' };
    }

    const text = (body?.content ?? [])
      .filter((block: { type?: string }) => block?.type === 'text')
      .map((block: { text?: string }) => block.text ?? '')
      .join('')
      .trim();

    if (!text) return { message: null, error: 'Claude returned an empty draft.' };
    return { message: text, error: null };
  } catch (error) {
    return { message: null, error: error instanceof Error ? error.message : 'Unknown error drafting the post' };
  }
}
