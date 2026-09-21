import type { CouponDiscountType } from '../utils/coupon';

export type { CouponDiscountType };

export interface Coupon {
  id: string;
  business_id: string | null;
  organization_id: string | null;
  created_by: string | null;
  code: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;

  /** In the promotion queue: gets a post date, a reminder and a Post button. */
  promote: boolean;
  /** When this code is due to be announced. The queue is sorted by it. */
  promo_post_at: string | null;
  /** The message that gets posted — drafted by Claude, editable by hand. */
  promo_message: string | null;
  promo_reminder_sent_at: string | null;
  /** The promo_post_at the last reminder covered. Moving the date re-arms it. */
  promo_reminder_for: string | null;
  facebook_post_id: string | null;
  facebook_posted_at: string | null;
  facebook_post_error: string | null;
}

export interface CouponInput {
  code: string;
  description?: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
  promote?: boolean;
  promo_post_at?: string | null;
  promo_message?: string | null;
}

/**
 * What the public form learns about a code. Deliberately narrow: the lookup
 * returns nothing at all for a code that is not redeemable right now, so this
 * shape has no status to report.
 */
export interface CouponLookupResult {
  code: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  ends_at: string | null;
}

/** The snapshot an inquiry carries once a coupon has been applied to it. */
export interface AppliedCoupon {
  coupon_code: string;
  coupon_discount_type: CouponDiscountType;
  coupon_discount_value: number;
  coupon_discount_amount: number;
}

/**
 * One customer who entered a code on the quote form.
 *
 * `coupons.times_used` is a bare counter — the people behind it live on the
 * inquiries the code was entered on, so the admin card reads them from there.
 */
export interface CouponRedemption {
  inquiry_id: string;
  client_name: string;
  client_email: string;
  /** Submission time: what the list is ordered and dated by. */
  used_at: string;
  /** Dollars this code took off their quote, as snapshotted at submission. */
  discount_amount: number | null;
  /** A test submission rather than a customer — tagged, never hidden. */
  is_test: boolean;
}
