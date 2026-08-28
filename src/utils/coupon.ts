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
