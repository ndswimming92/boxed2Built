import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface BusinessContactPhone { raw: string | null; display: string | null; telHref: string | null; }

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return normalized.length === 10 ? `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}` : phone;
}

function toTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, '');
  const digits = normalized.replace(/\D/g, '');
  if (normalized.startsWith('+')) return normalized;
  return digits.length === 10 ? `+1${digits}` : digits;
}

export async function getBusinessContactPhone(supabase: SupabaseClient, businessId?: string | null): Promise<BusinessContactPhone> {
  let query = supabase.from('business_info').select('phone').limit(1);
  query = businessId ? query.eq('id', businessId) : query.order('created_at', { ascending: true });
  const { data } = await query.maybeSingle();
  const raw = data?.phone?.trim() || null;
  if (!raw) return { raw: null, display: null, telHref: null };
  return { raw, display: formatPhoneDisplay(raw), telHref: toTelHref(raw) };
}
