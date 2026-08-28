/**
 * Coupon rules shared by the public form, the admin list and the invoice form.
 *
 * The money math lives here rather than in any one screen because the same
 * discount has to come out identical in three places a customer can see it:
 * the estimate on the contact form, the quote an admin turns into a job, and
 * the discount line on the invoice.
 */

export type CouponDiscountType = 'fixed' | 'percentage';

export interface CouponDiscount {
  discount_type: CouponDiscountType;
  discount_value: number;
}

export interface CouponWindow {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

/** What the admin list shows in the status pill. */
export type CouponState = 'active' | 'scheduled' | 'expired' | 'off';

export function couponState(coupon: CouponWindow, now: Date = new Date()): CouponState {
  if (!coupon.is_active) return 'off';
  if (coupon.ends_at && new Date(coupon.ends_at) <= now) return 'expired';
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return 'scheduled';
  return 'active';
}

export function isRedeemable(coupon: CouponWindow, now: Date = new Date()): boolean {
  return couponState(coupon, now) === 'active';
}

/**
 * The discount in dollars, rounded to the cent and never more than the amount
 * being discounted — a $25 coupon against a $20 job is $20 off, not a refund.
 */
export function discountAmount(coupon: CouponDiscount, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const raw =
    coupon.discount_type === 'percentage'
      ? (amount * coupon.discount_value) / 100
      : coupon.discount_value;

  return Math.min(Math.round(raw * 100) / 100, Math.round(amount * 100) / 100);
}

/** The amount actually charged after the coupon comes off. */
export function amountAfterDiscount(coupon: CouponDiscount, amount: number): number {
  return Math.round((amount - discountAmount(coupon, amount)) * 100) / 100;
}

/** "$25 off" / "10% off" — the phrase used on the form, the card and the invoice line. */
export function describeDiscount(coupon: CouponDiscount): string {
  if (coupon.discount_type === 'percentage') {
    const value = Number.isInteger(coupon.discount_value)
      ? String(coupon.discount_value)
      : coupon.discount_value.toFixed(2).replace(/\.?0+$/, '');
    return `${value}% off`;
  }
  return `${formatMoney(coupon.discount_value)} off`;
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2).replace(/\.00$/, '')}`;
}

/** Uppercase, trimmed, and stripped of the spaces people paste in. */
export function normalizeCouponCode(input: string): string {
  return input.toUpperCase().replace(/\s+/g, '').slice(0, 30);
}

/** Matches the CHECK constraint on `coupons.code`. */
export function isValidCouponCode(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{2,29}$/.test(code);
}

/** The line an invoice shows for a coupon, so every invoice words it the same. */
export function couponLineDescription(code: string, coupon: CouponDiscount): string {
  return `Coupon ${code} (${describeDiscount(coupon)})`;
}

/**
 * The admin sets plain start and end dates; the column stores an instant.
 *
 * A coupon that "ends" on the 30th has to work all day on the 30th, so the
 * window closes at midnight going into the 1st and `ends_at` is exclusive
 * everywhere it is read. These four functions are the only place that offset
 * lives, so the form round-trips a date to the same date.
 */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** First moment of the chosen day, in the admin's own timezone. */
export function startDateToTimestamp(value: string): string | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).toISOString();
}

/** Midnight after the chosen day, so the whole day counts as inside the window. */
export function endDateToTimestamp(value: string): string | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day + 1).toISOString();
}

export function timestampToStartDate(iso: string | null): string {
  if (!iso) return '';
  return toDateInput(new Date(iso));
}

export function timestampToEndDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  date.setDate(date.getDate() - 1);
  return toDateInput(date);
}

/** "Sep 1 – Sep 30", "From Sep 1", "Through Sep 30", or "Any time". */
export function describeWindow(starts_at: string | null, ends_at: string | null): string {
  const format = (iso: string, endInclusive = false) => {
    const date = new Date(iso);
    if (endInclusive) date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (starts_at && ends_at) return `${format(starts_at)} – ${format(ends_at, true)}`;
  if (starts_at) return `From ${format(starts_at)}`;
  if (ends_at) return `Through ${format(ends_at, true)}`;
  return 'Any time';
}

/*
 * ── The promotion queue ─────────────────────────────────────────────────────
 *
 * A code marked `promote` carries a date you mean to announce it on. The admin
 * list is sorted by that date so the next one up is the top card and nothing
 * has to be worked out by hand.
 */

export interface CouponPromo {
  promote: boolean;
  promo_post_at: string | null;
  facebook_posted_at: string | null;
  created_at: string;
}

/**
 * `queued` is the only state that puts a code in the queue. `undated` is a
 * promotion with no date yet — it needs one before it can be reminded about,
 * so it sorts above the archive rather than disappearing into it.
 */
export type CouponPromoState = 'queued' | 'undated' | 'posted' | 'none';

export function couponPromoState(coupon: CouponPromo): CouponPromoState {
  if (coupon.facebook_posted_at) return 'posted';
  if (!coupon.promote) return 'none';
  return coupon.promo_post_at ? 'queued' : 'undated';
}

const PROMO_GROUP: Record<CouponPromoState, number> = {
  queued: 0,
  undated: 1,
  posted: 2,
  none: 2,
};

/**
 * Queue first, soonest post date at the top; then everything else, newest
 * first. Posted promotions rejoin the archive because their job is done —
 * what the page is for is the one that has not gone out yet.
 */
export function sortCouponsForQueue<T extends CouponPromo>(coupons: T[]): T[] {
  return [...coupons].sort((a, b) => {
    const group = PROMO_GROUP[couponPromoState(a)] - PROMO_GROUP[couponPromoState(b)];
    if (group !== 0) return group;

    if (a.promo_post_at && b.promo_post_at && couponPromoState(a) === 'queued') {
      const byDate = new Date(a.promo_post_at).getTime() - new Date(b.promo_post_at).getTime();
      if (byDate !== 0) return byDate;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** The code that is up next, or null when the queue is empty. */
export function nextCouponToPost<T extends CouponPromo>(coupons: T[]): T | null {
  return sortCouponsForQueue(coupons).find((c) => couponPromoState(c) === 'queued') ?? null;
}

/** "Due in 3 days" / "Due tomorrow" / "Overdue by 2 days" — how urgent it is. */
export function describePostDue(postAt: string, now: Date = new Date()): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(postAt);
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const days = Math.round((targetDay - start) / 86_400_000);

  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return 'Overdue by a day';
  return `Overdue by ${Math.abs(days)} days`;
}

/** "Sep 1, 9:00 AM" — the post time on a card, where space is tight. */
export function formatPostAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "30 days" — the answer to "how long will it be active for". */
export function describeActiveDuration(starts_at: string | null, ends_at: string | null): string {
  if (!ends_at) return 'No end date';
  const from = starts_at ? new Date(starts_at) : new Date();
  const days = Math.max(1, Math.round((new Date(ends_at).getTime() - from.getTime()) / 86_400_000));
  return `${days} day${days === 1 ? '' : 's'}`;
}

/*
 * `datetime-local` round-tripping. Same shape as the date helpers above: the
 * input speaks the admin's own timezone and the column stores an instant.
 */
export function toDatetimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function timestampToDatetimeLocal(iso: string | null): string {
  return iso ? toDatetimeLocal(new Date(iso)) : '';
}

export function datetimeLocalToTimestamp(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** 9am is early enough to catch the morning scroll and late enough to be awake. */
const DEFAULT_POST_HOUR = 9;

/**
 * The post date a newly promoted code gets: the morning of its first day, or
 * tomorrow morning when it starts right away. Never in the past — a default
 * that is already overdue would fire a reminder the moment it is saved.
 */
export function defaultPromoPostAt(startsOn: string, now: Date = new Date()): string {
  const base = startsOn
    ? (() => {
        const [year, month, day] = startsOn.split('-').map(Number);
        return new Date(year, month - 1, day, DEFAULT_POST_HOUR);
      })()
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, DEFAULT_POST_HOUR);

  if (base.getTime() > now.getTime()) return toDatetimeLocal(base);
  return toDatetimeLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, DEFAULT_POST_HOUR));
}
