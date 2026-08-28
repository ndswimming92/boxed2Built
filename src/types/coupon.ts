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
}

export interface CouponInput {
  code: string;
  description?: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
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
