import { supabase } from '../lib/supabase';
import type {
  GiftCard,
  GiftCardRedemption,
  GiftCardLookupResult,
  GiftCardDeliveryType,
} from '../types/giftCard';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const FN_HEADERS: Record<string, string> = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export interface CreateGiftCardCheckoutPayload {
  amount_cents: number;
  purchaser_name: string;
  purchaser_email: string;
  delivery_type: GiftCardDeliveryType;
  recipient_name?: string;
  recipient_email?: string;
  personal_message?: string;
}

export interface CreateGiftCardCheckoutResult {
  url: string;
  gift_card_id: string;
}

export async function createGiftCardCheckout(
  payload: CreateGiftCardCheckoutPayload,
): Promise<CreateGiftCardCheckoutResult> {
  const res = await fetch(`${FN_URL}/create-gift-card-checkout`, {
    method: 'POST',
    headers: FN_HEADERS,
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || 'Failed to create checkout session');
  }
  return body as CreateGiftCardCheckoutResult;
}

export async function lookupGiftCardByCode(
  code: string,
): Promise<GiftCardLookupResult | null> {
  const { data, error } = await supabase.rpc('lookup_gift_card_by_code', {
    p_code: code,
  });
  if (error) throw error;
  const rows = (data as GiftCardLookupResult[] | null) ?? [];
  return rows[0] ?? null;
}

export interface GiftCardConfirmation {
  status: string;
  delivery_type: GiftCardDeliveryType;
  amount_cents: number;
  recipient_first_name: string | null;
  purchaser_first_name: string | null;
  code?: string; // only included when delivery_type === 'self'
}

export async function getGiftCardConfirmation(
  sessionId: string,
): Promise<GiftCardConfirmation | null> {
  const url = new URL(`${FN_URL}/get-gift-card-confirmation`);
  url.searchParams.set('session_id', sessionId);
  const res = await fetch(url.toString(), { headers: FN_HEADERS });
  if (res.status === 404) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to load confirmation');
  return body as GiftCardConfirmation;
}

// ----- Admin-only helpers (use authenticated admin session) -----

export async function listGiftCards(options?: {
  status?: string;
  search?: string;
}): Promise<GiftCard[]> {
  let q = supabase
    .from('gift_cards')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (options?.status && options.status !== 'all') {
    q = q.eq('status', options.status);
  }
  if (options?.search) {
    const s = options.search.trim();
    if (s) {
      q = q.or(
        `code.ilike.%${s}%,purchaser_email.ilike.%${s}%,recipient_email.ilike.%${s}%,purchaser_name.ilike.%${s}%,recipient_name.ilike.%${s}%`,
      );
    }
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as GiftCard[]) ?? [];
}

export async function getGiftCard(id: string): Promise<GiftCard | null> {
  const { data, error } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as GiftCard | null) ?? null;
}

export async function getGiftCardByCode(code: string): Promise<GiftCard | null> {
  const { data, error } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as GiftCard | null) ?? null;
}

export async function listRedemptionsForCard(
  giftCardId: string,
): Promise<GiftCardRedemption[]> {
  const { data, error } = await supabase
    .from('gift_card_redemptions')
    .select('*')
    .eq('gift_card_id', giftCardId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as GiftCardRedemption[]) ?? [];
}

export interface RedeemGiftCardParams {
  gift_card_id: string;
  amount_cents: number;
  job_id?: string | null;
  invoice_id?: string | null;
  redeemed_by_name?: string | null;
  redeemed_by_email?: string | null;
  notes?: string | null;
}

export async function redeemGiftCard(params: RedeemGiftCardParams) {
  // Redemption moves money, so it goes through the admin-checked function on the
  // server with the signed-in staff member's own token. The database routine is
  // no longer callable from the browser.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('You need to be signed in to redeem a gift card.');

  const res = await fetch(`${FN_URL}/redeem-gift-card`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gift_card_id: params.gift_card_id,
      amount_cents: params.amount_cents,
      job_id: params.job_id ?? null,
      invoice_id: params.invoice_id ?? null,
      notes: params.notes ?? null,
    }),
  });

  const row = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(row?.error || 'Failed to redeem gift card');
  return row as {
    redemption_id: string;
    new_remaining_cents: number;
    new_status: string;
  };
}

export async function voidGiftCard(id: string) {
  const { error } = await supabase
    .from('gift_cards')
    .update({ status: 'voided', remaining_amount_cents: 0 })
    .eq('id', id);
  if (error) throw error;
}

export async function resendGiftCardEmail(giftCardId: string) {
  // Resending is a staff action and the mail carries the redemption code, so it
  // travels with the signed-in staff member's own token, not the public key.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('You need to be signed in to resend this email.');

  const res = await fetch(`${FN_URL}/send-gift-card-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gift_card_id: giftCardId, resend: true }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to resend email');
  return body;
}
