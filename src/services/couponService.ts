import { supabase } from '../lib/supabase';
import { logAction } from './auditLogService';
import { normalizeCouponCode } from '../utils/coupon';
import type { Coupon, CouponInput, CouponLookupResult } from '../types/coupon';

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

  return (data || []) as Coupon[];
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
