import { supabase } from '../lib/supabase';
import {
  generateUniqueFileName,
  normalizeImageFile,
  optimizeImage,
  snapshotFileToMemory,
} from '../utils/imageOptimizationUpload';
import type {
  CartLine,
  ProductDraft,
  ShopFulfillmentMethod,
  ShopOrder,
  ShopOrderItem,
  ShopOrderStatus,
  ShopOrderWithItems,
  ShopProduct,
  ShopSettings,
} from '../types/shop';

const BUCKET_NAME = 'shop-images';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const FN_HEADERS: Record<string, string> = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

/** jsonb text arrays come back as unknown; keep only the strings. */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Rows come back with `image_urls` as jsonb; normalize it to a string array. */
function normalizeProduct(row: Record<string, unknown>): ShopProduct {
  return { ...(row as unknown as ShopProduct), image_urls: toStringArray(row.image_urls) };
}

function normalizeSettings(row: Record<string, unknown>): ShopSettings {
  return {
    ...(row as unknown as ShopSettings),
    material_options: toStringArray(row.material_options),
    color_options: toStringArray(row.color_options),
  };
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format((cents || 0) / 100);
}

/** Whole dollars or dollars-and-cents ("24", "24.50") to integer cents. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** True when a shopper can add this product to the cart right now. */
export function isProductAvailable(product: ShopProduct): boolean {
  if (!product.is_active) return false;
  return !product.track_inventory || product.stock_quantity > 0;
}

/** Quantity cap for one cart line, respecting tracked stock. */
export function maxQuantityFor(product: ShopProduct): number {
  if (!product.track_inventory) return product.max_per_order;
  return Math.max(0, Math.min(product.max_per_order, product.stock_quantity));
}

// ───────────────────────── Public storefront reads ─────────────────────────

export async function listActiveProducts(): Promise<ShopProduct[]> {
  const { data, error } = await supabase
    .from('shop_products')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeProduct);
}

export async function getShopSettings(): Promise<ShopSettings | null> {
  const { data, error } = await supabase
    .from('shop_settings')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeSettings(data) : null;
}

// ───────────────────────────── Admin: products ─────────────────────────────

export async function listAllProducts(): Promise<ShopProduct[]> {
  const { data, error } = await supabase
    .from('shop_products')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeProduct);
}

export async function createProduct(
  businessId: string,
  draft: ProductDraft,
): Promise<ShopProduct> {
  const { data, error } = await supabase
    .from('shop_products')
    .insert({ ...draft, business_id: businessId })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeProduct(data);
}

export async function updateProduct(
  id: string,
  patch: Partial<ProductDraft>,
): Promise<ShopProduct> {
  const { data, error } = await supabase
    .from('shop_products')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeProduct(data);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('shop_products').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Optimizes and uploads a product photo, returning its public URL.
 *
 * Mirrors the gallery upload path: snapshot the bytes first (mobile pickers
 * hand back files that can go stale), convert HEIC, then downscale to WebP.
 */
export async function uploadProductImage(file: File, businessId: string): Promise<string> {
  const snapshot = await snapshotFileToMemory(file);
  const normalized = await normalizeImageFile(snapshot);
  const optimized = await optimizeImage(normalized, {
    maxWidth: 1400,
    maxHeight: 1400,
    quality: 0.85,
  });

  const filePath = `${businessId}/${generateUniqueFileName(optimized.file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, optimized.file, {
      contentType: optimized.file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  return data.publicUrl;
}

/** Best-effort cleanup of an uploaded photo that is no longer referenced. */
export async function deleteProductImage(publicUrl: string): Promise<void> {
  const match = publicUrl.match(new RegExp(`/${BUCKET_NAME}/(.+)$`));
  if (!match) return;
  await supabase.storage.from(BUCKET_NAME).remove([match[1]]);
}

// ───────────────────────────── Admin: settings ─────────────────────────────

export async function saveShopSettings(
  businessId: string,
  patch: Partial<Omit<ShopSettings, 'id' | 'business_id' | 'organization_id' | 'created_at' | 'updated_at'>>,
): Promise<ShopSettings> {
  const { data, error } = await supabase
    .from('shop_settings')
    .upsert({ business_id: businessId, ...patch }, { onConflict: 'business_id' })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeSettings(data);
}

/**
 * Appends a filament material or color to the shop's option list.
 *
 * Lets the product form add a new spool on the spot instead of sending the
 * owner to Store settings mid-edit. Comparison is case-insensitive so "petg"
 * doesn't land next to "PETG".
 */
export async function addFilamentOption(
  businessId: string,
  kind: 'material' | 'color',
  value: string,
  current: string[],
): Promise<ShopSettings | null> {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (current.some((option) => option.toLowerCase() === trimmed.toLowerCase())) return null;

  const key = kind === 'material' ? 'material_options' : 'color_options';
  return saveShopSettings(businessId, { [key]: [...current, trimmed] });
}

// ────────────────────────────── Admin: orders ──────────────────────────────

export async function listOrders(options?: {
  status?: ShopOrderStatus | 'all';
  search?: string;
}): Promise<ShopOrder[]> {
  let query = supabase
    .from('shop_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  const search = options?.search?.trim();
  if (search) {
    query = query.or(
      `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ShopOrder[]) ?? [];
}

export async function getOrderWithItems(orderId: string): Promise<ShopOrderWithItems | null> {
  const { data: order, error } = await supabase
    .from('shop_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) return null;

  const { data: items, error: itemsError } = await supabase
    .from('shop_order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (itemsError) throw itemsError;
  return { ...(order as ShopOrder), items: (items as ShopOrderItem[]) ?? [] };
}

export async function listOrderItems(orderIds: string[]): Promise<Record<string, ShopOrderItem[]>> {
  if (orderIds.length === 0) return {};

  const { data, error } = await supabase
    .from('shop_order_items')
    .select('*')
    .in('order_id', orderIds)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data as ShopOrderItem[]) ?? []).reduce<Record<string, ShopOrderItem[]>>((acc, item) => {
    (acc[item.order_id] ||= []).push(item);
    return acc;
  }, {});
}

export async function updateOrder(
  id: string,
  patch: Partial<
    Pick<
      ShopOrder,
      'status' | 'admin_notes' | 'tracking_carrier' | 'tracking_number' | 'fulfilled_at'
    >
  >,
): Promise<ShopOrder> {
  const { data, error } = await supabase
    .from('shop_orders')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as ShopOrder;
}

// ──────────────────────────────── Checkout ────────────────────────────────

export interface ShopCheckoutPayload {
  items: Array<{ product_id: string; quantity: number }>;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  fulfillment_method: ShopFulfillmentMethod;
  shipping_line1?: string;
  shipping_line2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postal_code?: string;
  customer_note?: string;
}

export interface ShopCheckoutResult {
  url: string;
  order_id: string;
  order_number: string;
}

export async function createShopCheckout(
  payload: ShopCheckoutPayload,
): Promise<ShopCheckoutResult> {
  const res = await fetch(`${FN_URL}/create-shop-checkout`, {
    method: 'POST',
    headers: FN_HEADERS,
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to start checkout');
  return body as ShopCheckoutResult;
}

export interface ShopOrderConfirmation {
  order_number: string;
  status: ShopOrderStatus;
  customer_first_name: string | null;
  fulfillment_method: ShopFulfillmentMethod;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  lead_time_days: number;
  items: Array<{ product_name: string; quantity: number; line_total_cents: number }>;
}

export async function getShopOrderConfirmation(
  sessionId: string,
): Promise<ShopOrderConfirmation | null> {
  const url = new URL(`${FN_URL}/get-shop-order`);
  url.searchParams.set('session_id', sessionId);

  const res = await fetch(url.toString(), { headers: FN_HEADERS });
  if (res.status === 404) return null;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to load your order');
  return body as ShopOrderConfirmation;
}

// ─────────────────────────── Cart math (shared) ───────────────────────────

export interface CartTotals {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  freeShippingRemainingCents: number | null;
}

/**
 * Mirrors the totals the `create-shop-checkout` function recomputes server-side.
 * Displayed totals are a preview only — Stripe always charges what the edge
 * function calculates from database prices.
 */
export function calculateCartTotals(
  lines: CartLine[],
  settings: ShopSettings | null,
  fulfillment: ShopFulfillmentMethod,
): CartTotals {
  const subtotalCents = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);

  const needsShipping = fulfillment === 'shipping' && lines.some((line) => line.requiresShipping);
  const flatShipping = settings?.flat_shipping_cents ?? 0;
  const threshold = settings?.free_shipping_threshold_cents ?? null;
  const qualifiesFree = threshold !== null && subtotalCents >= threshold;

  const shippingCents = needsShipping && !qualifiesFree ? flatShipping : 0;
  const taxCents = Math.round((subtotalCents * Number(settings?.tax_rate_percent ?? 0)) / 100);

  return {
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents: subtotalCents + shippingCents + taxCents,
    freeShippingRemainingCents:
      threshold !== null && !qualifiesFree && needsShipping ? threshold - subtotalCents : null,
  };
}
