export type ShopOrderStatus =
  | 'pending'
  | 'paid'
  | 'in_production'
  | 'shipped'
  | 'completed'
  | 'canceled'
  | 'refunded'
  | 'failed';

export type ShopFulfillmentMethod = 'shipping' | 'pickup';

export interface ShopProduct {
  id: string;
  business_id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  category: string;
  material: string | null;
  color: string | null;
  lead_time_days: number;
  image_url: string | null;
  image_urls: string[];
  track_inventory: boolean;
  stock_quantity: number;
  max_per_order: number;
  requires_shipping: boolean;
  allow_local_pickup: boolean;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ShopSettings {
  id: string;
  business_id: string;
  organization_id: string | null;
  announcement: string | null;
  shipping_enabled: boolean;
  flat_shipping_cents: number;
  free_shipping_threshold_cents: number | null;
  local_pickup_enabled: boolean;
  pickup_instructions: string | null;
  tax_rate_percent: number;
  created_at: string;
  updated_at: string;
}

export interface ShopOrder {
  id: string;
  business_id: string | null;
  organization_id: string | null;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  fulfillment_method: ShopFulfillmentMethod;
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  customer_note: string | null;
  admin_notes: string | null;
  status: ShopOrderStatus;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  tracking_carrier: string | null;
  tracking_number: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_options: string | null;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  created_at: string;
}

export interface ShopOrderWithItems extends ShopOrder {
  items: ShopOrderItem[];
}

/** A line in the shopper's cart. Persisted to localStorage. */
export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
  maxPerOrder: number;
  requiresShipping: boolean;
}

export type ProductDraft = Omit<
  ShopProduct,
  'id' | 'business_id' | 'organization_id' | 'created_at' | 'updated_at'
>;
