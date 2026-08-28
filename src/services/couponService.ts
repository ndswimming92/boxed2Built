import { supabase } from '../lib/supabase';
import { logAction } from './auditLogService';
import { normalizeCouponCode, sortCouponsForQueue } from '../utils/coupon';
import type { Coupon, CouponInput, CouponLookupResult } from '../types/coupon';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * Ordered the way the admin page reads it: whatever is due to be posted next
 * first, then the rest newest-first. The sort is a two-key affair that Postgres
 * cannot express in one `order()` chain, so it happens here — one place, so the
 * page and its tests never disagree about what "next up" means.
 */
export async function getCoupons(businessId: string): Promise<Coupon[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching coupons:', error);
    throw new Error(`Failed to load coupons: ${error.message}`);
  }

  return sortCouponsForQueue((data || []) as Coupon[]);
}

export async function createCoupon(
  businessId: string,
  organizationId: string | null,
  input: CouponInput
): Promise<Coupon> {
  const code = normalizeCouponCode(input.code);

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      business_id: businessId,
      organization_id: organizationId,
      code,
      description: input.description?.trim() || null,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      starts_at: input.starts_at || null,
      ends_at: input.ends_at || null,
      is_active: input.is_active ?? true,
      promote: input.promote ?? false,
      promo_post_at: input.promo_post_at || null,
      promo_message: input.promo_message?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    // The unique index is the only way two admins racing on the same code can
    // be caught, so turn it into something readable rather than a raw 23505.
    if (error.code === '23505') {
      throw new Error(`Coupon code ${code} already exists.`);
    }
    console.error('Error creating coupon:', error);
    throw new Error(`Failed to create coupon: ${error.message}`);
  }

  await logAction({
    actionType: 'CREATE',
    tableName: 'coupons',
    recordId: data.id,
    recordIdentifier: code,
    metadata: { discount_type: input.discount_type, discount_value: input.discount_value },
  });

  return data as Coupon;
}

export async function updateCoupon(id: string, input: CouponInput): Promise<Coupon> {
  const code = normalizeCouponCode(input.code);

  const { data, error } = await supabase
    .from('coupons')
    .update({
      code,
      description: input.description?.trim() || null,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      starts_at: input.starts_at || null,
      ends_at: input.ends_at || null,
      is_active: input.is_active ?? true,
      promote: input.promote ?? false,
      promo_post_at: input.promo_post_at || null,
      promo_message: input.promo_message?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Coupon code ${code} already exists.`);
    }
    console.error('Error updating coupon:', error);
    throw new Error(`Failed to update coupon: ${error.message}`);
  }

  await logAction({
    actionType: 'UPDATE',
    tableName: 'coupons',
    recordId: id,
    recordIdentifier: code,
  });

  return data as Coupon;
}

export async function setCouponActive(id: string, isActive: boolean): Promise<Coupon> {
  const { data, error } = await supabase
    .from('coupons')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error toggling coupon:', error);
    throw new Error(`Failed to update coupon: ${error.message}`);
  }

  await logAction({
    actionType: 'UPDATE',
    tableName: 'coupons',
    recordId: id,
    recordIdentifier: data.code,
    metadata: { is_active: isActive },
  });

  return data as Coupon;
}

export async function deleteCoupon(id: string, code: string): Promise<void> {
  const { error } = await supabase.from('coupons').delete().eq('id', id);

  if (error) {
    console.error('Error deleting coupon:', error);
    throw new Error(`Failed to delete coupon: ${error.message}`);
  }

  await logAction({
    actionType: 'DELETE',
    tableName: 'coupons',
    recordId: id,
    recordIdentifier: code,
  });
}

/**
 * The public path. Returns null for anything not redeemable this second —
 * unknown, paused, not yet started, or expired all look the same from here,
 * which is what stops the form from being used to enumerate codes.
 */
export async function lookupCouponByCode(code: string): Promise<CouponLookupResult | null> {
  const { data, error } = await supabase.rpc('lookup_coupon_by_code', {
    p_code: normalizeCouponCode(code),
  });

  if (error) throw error;

  const rows = (data as CouponLookupResult[] | null) ?? [];
  return rows[0] ?? null;
}

/*
 * ── Promotion ───────────────────────────────────────────────────────────────
 *
 * Three admin-only edge functions, all reached the same way the gallery's
 * publish button reaches its own: a signed-in session bearer, because each one
 * either spends money at Anthropic or posts to the business's Facebook Page.
 */

async function callPromoFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FN_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || `Request to ${name} failed`);
  return payload as T;
}

export interface DraftCouponPromoResult {
  message: string;
  /** False when Claude was unreachable and the built-in wording was used. */
  drafted_by_claude: boolean;
  error: string | null;
}

/** Asks Claude for the Facebook post and stores it on the coupon. */
export async function draftCouponPromo(couponId: string): Promise<DraftCouponPromoResult> {
  return callPromoFunction<DraftCouponPromoResult>('draft-coupon-promo', { coupon_id: couponId });
}

export interface PublishCouponPromoResult {
  facebook: { success: boolean; post_id?: string; error?: string };
  /** What was actually posted, which is also what gets stored. */
  message: string;
}

/**
 * Posts the coupon to the Facebook Page. `message` carries an unsaved edit
 * straight from the textarea, so what the admin is looking at is what goes out.
 */
export async function publishCouponPromo(
  couponId: string,
  message?: string,
): Promise<PublishCouponPromoResult> {
  return callPromoFunction<PublishCouponPromoResult>('publish-coupon-promo', {
    coupon_id: couponId,
    ...(message ? { message } : {}),
  });
}

export interface SendCouponPromoReminderResult {
  sent: number;
  sentTo?: string;
}

/** Sends this coupon's reminder now, for checking the email lands. */
export async function sendCouponPromoReminder(couponId: string): Promise<SendCouponPromoReminderResult> {
  return callPromoFunction<SendCouponPromoReminderResult>('send-coupon-promo-reminders', {
    coupon_id: couponId,
  });
}
