import { supabase } from '../lib/supabase';
import { logAction } from './auditLogService';
import { normalizeCouponCode, sortCouponsForQueue } from '../utils/coupon';
import type { Coupon, CouponInput, CouponLookupResult, CouponRedemption } from '../types/coupon';
import {
  DEFAULT_COUPON_POPUP_SETTINGS, normalizePopupSettings,
  type CouponPopupContent, type CouponPopupSettings,
} from '../utils/couponPopup';

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
      show_on_home: input.show_on_home ?? false,
      popup_headline: input.popup_headline?.trim() || null,
      popup_message: input.popup_message?.trim() || null,
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
      show_on_home: input.show_on_home ?? false,
      popup_headline: input.popup_headline?.trim() || null,
      popup_message: input.popup_message?.trim() || null,
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
 * Who has used each code, keyed by the code they used.
 *
 * The counter on `coupons` has no names in it, so the people come from the
 * inquiries the codes were entered on. One query for the whole page rather
 * than one per card: a business with a dozen codes would otherwise open with a
 * dozen requests to the same table.
 *
 * Deleted inquiries are left out — they were removed on purpose. Test
 * submissions are kept, because the counter on the coupon counted them and a
 * list that quietly disagrees with the number above it is worse than one that
 * labels the odd row.
 */
export async function getCouponRedemptions(
  businessId: string,
): Promise<Record<string, CouponRedemption[]>> {
  const { data, error } = await supabase
    .from('form_inquiries')
    .select('id, client_name, client_email, submission_date, coupon_code, coupon_discount_amount, is_test')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('coupon_code', 'is', null)
    .order('submission_date', { ascending: false });

  if (error) {
    console.error('Error fetching coupon redemptions:', error);
    throw new Error(`Failed to load coupon usage: ${error.message}`);
  }

  const byCode: Record<string, CouponRedemption[]> = {};

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    // Codes are stored uppercase on both tables, but an inquiry from before
    // that constraint existed can still carry whatever was typed.
    const code = normalizeCouponCode(String(row.coupon_code ?? ''));
    if (!code) continue;

    const amount = Number(row.coupon_discount_amount);

    byCode[code] = byCode[code] ?? [];
    byCode[code].push({
      inquiry_id: String(row.id),
      client_name: String(row.client_name ?? '').trim() || 'Name not given',
      client_email: String(row.client_email ?? '').trim(),
      used_at: String(row.submission_date),
      discount_amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      is_test: row.is_test === true,
    });
  }

  return byCode;
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

/**
 * Partner leads that have a code made for them, keyed by coupon id. This is
 * what tells the coupons page which codes belong to partners rather than
 * customers. Never throws: without it the page falls back to the description.
 */
export async function getPartnerCouponOwners(organizationId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('partner_leads')
    .select('name, coupon_id')
    .eq('organization_id', organizationId)
    .not('coupon_id', 'is', null);

  if (error) {
    console.error('Error loading partner codes:', error);
    return {};
  }

  const owners: Record<string, string> = {};
  for (const row of (data || []) as { name: string; coupon_id: string }[]) {
    owners[row.coupon_id] = row.name;
  }
  return owners;
}

/*
 * ── Home page popup ─────────────────────────────────────────────────────────
 */

export interface HomeCouponPopup {
  coupon: CouponPopupContent;
  settings: CouponPopupSettings;
}

/**
 * The public path for the home page popup: the one ticked coupon that is live
 * right now, with the display settings beside it. Null when the popup is
 * switched off or nothing ticked is live. Never throws — a popup that cannot
 * load is a popup that does not show, not a broken home page.
 */
export async function getHomeCouponPopup(businessId: string): Promise<HomeCouponPopup | null> {
  try {
    const { data, error } = await supabase.rpc('get_home_coupon_popup', { p_business_id: businessId });
    if (error) throw error;

    const row = ((data as Record<string, unknown>[] | null) ?? [])[0];
    if (!row || typeof row.code !== 'string') return null;

    return {
      coupon: {
        code: row.code,
        discount_type: row.discount_type === 'percentage' ? 'percentage' : 'fixed',
        discount_value: Number(row.discount_value),
        ends_at: (row.ends_at as string | null) ?? null,
        headline: (row.headline as string | null) ?? null,
        message: (row.message as string | null) ?? null,
      },
      settings: normalizePopupSettings({
        ...DEFAULT_COUPON_POPUP_SETTINGS,
        delay_seconds: Number(row.delay_seconds),
        fade_ms: Number(row.fade_ms),
        frequency: (row.frequency as CouponPopupSettings['frequency']) ?? DEFAULT_COUPON_POPUP_SETTINGS.frequency,
        position: row.position === 'corner' ? 'corner' : 'center',
        cta_label: String(row.cta_label ?? ''),
      }),
    };
  } catch (error) {
    console.warn('[couponPopup] Could not load the home page coupon:', error);
    return null;
  }
}

/** The admin's saved popup settings, or the defaults when none are saved yet. */
export async function getCouponPopupSettings(businessId: string): Promise<CouponPopupSettings> {
  const { data, error } = await supabase
    .from('coupon_popup_settings')
    .select('is_enabled, delay_seconds, fade_ms, frequency, position, cta_label')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching coupon popup settings:', error);
    throw new Error(`Failed to load popup settings: ${error.message}`);
  }

  if (!data) return DEFAULT_COUPON_POPUP_SETTINGS;

  return normalizePopupSettings({
    ...DEFAULT_COUPON_POPUP_SETTINGS,
    ...(data as Partial<CouponPopupSettings>),
    delay_seconds: Number(data.delay_seconds),
    fade_ms: Number(data.fade_ms),
  });
}

export async function saveCouponPopupSettings(
  businessId: string,
  settings: CouponPopupSettings,
): Promise<CouponPopupSettings> {
  const clean = normalizePopupSettings(settings);

  const { error } = await supabase
    .from('coupon_popup_settings')
    .upsert({ business_id: businessId, ...clean }, { onConflict: 'business_id' });

  if (error) {
    console.error('Error saving coupon popup settings:', error);
    throw new Error(`Failed to save popup settings: ${error.message}`);
  }

  await logAction({
    actionType: 'UPDATE',
    tableName: 'coupon_popup_settings',
    recordId: businessId,
    recordIdentifier: 'Home page coupon popup',
    metadata: { ...clean },
  });

  return clean;
}

/** The card's quick switch: put one code on, or take it off, the home page. */
export async function setCouponShowOnHome(id: string, showOnHome: boolean): Promise<Coupon> {
  const { data, error } = await supabase
    .from('coupons')
    .update({ show_on_home: showOnHome })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating coupon home page setting:', error);
    throw new Error(`Failed to update coupon: ${error.message}`);
  }

  await logAction({
    actionType: 'UPDATE',
    tableName: 'coupons',
    recordId: id,
    recordIdentifier: data.code,
    metadata: { show_on_home: showOnHome },
  });

  return data as Coupon;
}
