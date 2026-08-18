/*
  # Print Shop System

  Adds a small storefront for 3D printed goods. Products are managed from the
  admin portal (`/admin/store`) and shown publicly at `/store`. Checkout reuses
  the existing Stripe credentials and the unified `stripe-webhook` endpoint —
  no new Stripe products, prices, webhooks, or environment variables.

  1. New Tables
    - `shop_products` — one row per item for sale
      - `id` (uuid, pk)
      - `business_id` (uuid, references business_info)
      - `organization_id` (uuid, references organizations)
      - `name`, `slug` (text) — slug is unique and drives deep links
      - `short_description`, `description` (text)
      - `price_cents` (integer) — sale price
      - `compare_at_price_cents` (integer, nullable) — struck-through "was" price
      - `category` (text) — free-form grouping used for the store filter chips
      - `material`, `color` (text, nullable) — e.g. "PLA", "Matte black"
      - `lead_time_days` (integer) — how long before it ships/is ready
      - `image_url` (text) — primary image
      - `image_urls` (jsonb) — additional images, array of text
      - `track_inventory` (boolean) — false means made-to-order (never sells out)
      - `stock_quantity` (integer) — only meaningful when `track_inventory`
      - `max_per_order` (integer) — per-line quantity cap
      - `requires_shipping` (boolean) — false for pickup-only items
      - `allow_local_pickup` (boolean)
      - `is_active` (boolean) — hidden from the store when false
      - `is_featured` (boolean), `display_order` (integer)
      - `created_at`, `updated_at` (timestamptz)

    - `shop_settings` — one row per business; store-wide checkout options
      (shipping toggle, flat rate, free-shipping threshold, pickup instructions,
      sales tax rate, storefront announcement).

    - `shop_orders` — one row per checkout attempt
      - contact + fulfillment details, money totals in cents, Stripe ids,
        tracking fields, and a status lifecycle of
        `pending -> paid -> in_production -> shipped -> completed`, plus
        `canceled`, `refunded`, and `failed`.

    - `shop_order_items` — line items, price/name snapshotted at purchase time
      so later product edits never rewrite order history.

  2. Functions
    - `decrement_shop_product_stock(p_product_id uuid, p_quantity integer)`
      (SECURITY DEFINER) — atomically reduces tracked stock, floored at zero.
      Granted to `service_role` only; the Stripe webhook calls it after payment.

  3. Security (RLS)
    - RLS enabled on all four tables.
    - `anon` + `authenticated` may SELECT active products and the settings row
      (both are public storefront data). No public INSERT/UPDATE/DELETE.
    - Orders and order items are admin/organization-member only. Customers
      never read them directly — the `get-shop-order` edge function serves the
      confirmation page with the service role key.
    - Platform admins and org members manage products/settings, matching the
      convention used by the other operational tables.

  4. Storage
    - Public `shop-images` bucket for product photos: world-readable,
      authenticated write/update/delete (same shape as `gallery-images`).
*/

-- ── shop_products ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  short_description text,
  description text,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  compare_at_price_cents integer CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents >= 0),
  category text NOT NULL DEFAULT 'Other',
  material text,
  color text,
  lead_time_days integer NOT NULL DEFAULT 3 CHECK (lead_time_days >= 0),
  image_url text,
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  track_inventory boolean NOT NULL DEFAULT false,
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  max_per_order integer NOT NULL DEFAULT 10 CHECK (max_per_order > 0),
  requires_shipping boolean NOT NULL DEFAULT true,
  allow_local_pickup boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── shop_settings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES business_info(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id),
  announcement text,
  shipping_enabled boolean NOT NULL DEFAULT true,
  flat_shipping_cents integer NOT NULL DEFAULT 700 CHECK (flat_shipping_cents >= 0),
  free_shipping_threshold_cents integer CHECK (free_shipping_threshold_cents IS NULL OR free_shipping_threshold_cents >= 0),
  local_pickup_enabled boolean NOT NULL DEFAULT true,
  pickup_instructions text,
  tax_rate_percent numeric(5, 3) NOT NULL DEFAULT 0 CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── shop_orders ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES business_info(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id),
  order_number text UNIQUE NOT NULL
    DEFAULT ('SP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 5))),
  customer_name text NOT NULL DEFAULT '',
  customer_email text NOT NULL DEFAULT '',
  customer_phone text,
  fulfillment_method text NOT NULL DEFAULT 'shipping'
    CHECK (fulfillment_method IN ('shipping', 'pickup')),
  shipping_line1 text,
  shipping_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_postal_code text,
  customer_note text,
  admin_notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'in_production', 'shipped', 'completed', 'canceled', 'refunded', 'failed')),
  subtotal_cents integer NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  shipping_cents integer NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  tax_cents integer NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  tracking_carrier text,
  tracking_number text,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── shop_order_items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES shop_products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_options text,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total_cents integer NOT NULL CHECK (line_total_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Default organization_id (fallback so inserts that omit it don't fail) ─────
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'boxed2built' LIMIT 1;
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations LIMIT 1;
  END IF;

  IF v_org_id IS NOT NULL THEN
    EXECUTE format('ALTER TABLE shop_products ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
    EXECUTE format('ALTER TABLE shop_settings ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
    EXECUTE format('ALTER TABLE shop_orders ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;
END $$;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shop_products_business_id ON shop_products(business_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_organization_id ON shop_products(organization_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_active_order ON shop_products(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_shop_settings_organization_id ON shop_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_business_id ON shop_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_organization_id ON shop_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_created_at ON shop_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_orders_customer_email ON shop_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order_id ON shop_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_product_id ON shop_order_items(product_id);

-- ── updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_shop_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_products_updated_at ON shop_products;
CREATE TRIGGER shop_products_updated_at
  BEFORE UPDATE ON shop_products
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_updated_at();

DROP TRIGGER IF EXISTS shop_settings_updated_at ON shop_settings;
CREATE TRIGGER shop_settings_updated_at
  BEFORE UPDATE ON shop_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_updated_at();

DROP TRIGGER IF EXISTS shop_orders_updated_at ON shop_orders;
CREATE TRIGGER shop_orders_updated_at
  BEFORE UPDATE ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_updated_at();

-- ── Stock decrement (called by the Stripe webhook after payment) ─────────────
CREATE OR REPLACE FUNCTION decrement_shop_product_stock(p_product_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE shop_products
  SET stock_quantity = GREATEST(stock_quantity - GREATEST(p_quantity, 0), 0)
  WHERE id = p_product_id
    AND track_inventory = true;
END;
$$;

REVOKE ALL ON FUNCTION decrement_shop_product_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION decrement_shop_product_stock(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION decrement_shop_product_stock(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION decrement_shop_product_stock(uuid, integer) TO service_role;

-- ── RLS: shop_products ───────────────────────────────────────────────────────
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active shop products" ON shop_products;
CREATE POLICY "Public can view active shop products"
  ON shop_products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Platform admins have full access to shop products" ON shop_products;
CREATE POLICY "Platform admins have full access to shop products"
  ON shop_products FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Organization members can manage shop products" ON shop_products;
CREATE POLICY "Organization members can manage shop products"
  ON shop_products FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- ── RLS: shop_settings ───────────────────────────────────────────────────────
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view shop settings" ON shop_settings;
CREATE POLICY "Public can view shop settings"
  ON shop_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Platform admins have full access to shop settings" ON shop_settings;
CREATE POLICY "Platform admins have full access to shop settings"
  ON shop_settings FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Organization members can manage shop settings" ON shop_settings;
CREATE POLICY "Organization members can manage shop settings"
  ON shop_settings FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- ── RLS: shop_orders ─────────────────────────────────────────────────────────
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins have full access to shop orders" ON shop_orders;
CREATE POLICY "Platform admins have full access to shop orders"
  ON shop_orders FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Organization members can view their shop orders" ON shop_orders;
CREATE POLICY "Organization members can view their shop orders"
  ON shop_orders FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

DROP POLICY IF EXISTS "Organization members can manage shop orders" ON shop_orders;
CREATE POLICY "Organization members can manage shop orders"
  ON shop_orders FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- ── RLS: shop_order_items ────────────────────────────────────────────────────
ALTER TABLE shop_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins have full access to shop order items" ON shop_order_items;
CREATE POLICY "Platform admins have full access to shop order items"
  ON shop_order_items FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Organization members can view their shop order items" ON shop_order_items;
CREATE POLICY "Organization members can view their shop order items"
  ON shop_order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shop_orders o
      WHERE o.id = shop_order_items.order_id
        AND can_view_org_data(o.organization_id)
    )
  );

DROP POLICY IF EXISTS "Organization members can manage shop order items" ON shop_order_items;
CREATE POLICY "Organization members can manage shop order items"
  ON shop_order_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shop_orders o
      WHERE o.id = shop_order_items.order_id
        AND has_org_permission(o.organization_id, 'member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shop_orders o
      WHERE o.id = shop_order_items.order_id
        AND has_org_permission(o.organization_id, 'member')
    )
  );

-- ── Table privileges ─────────────────────────────────────────────────────────
-- New tables inherit Supabase's blanket grants to anon/authenticated, so RLS is
-- the only gate by default. Orders are never read by the public (the
-- confirmation page goes through an edge function on the service role key), so
-- drop anon's grants entirely rather than relying on the absence of a policy.
REVOKE ALL ON shop_orders FROM anon;
REVOKE ALL ON shop_order_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON shop_products FROM anon;
REVOKE INSERT, UPDATE, DELETE ON shop_settings FROM anon;

-- ── Storage bucket for product photos ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Public can read shop images'
  ) THEN
    CREATE POLICY "Public can read shop images"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'shop-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload shop images'
  ) THEN
    CREATE POLICY "Authenticated users can upload shop images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'shop-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Authenticated users can update shop images'
  ) THEN
    CREATE POLICY "Authenticated users can update shop images"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'shop-images')
      WITH CHECK (bucket_id = 'shop-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Authenticated users can delete shop images'
  ) THEN
    CREATE POLICY "Authenticated users can delete shop images"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'shop-images');
  END IF;
END $$;

-- ── Seed the settings row for the active business ────────────────────────────
INSERT INTO shop_settings (business_id, pickup_instructions)
SELECT id, 'Local pickup in Spring Hill, TN — we will email you to arrange a time.'
FROM business_info
WHERE is_active = true
ON CONFLICT (business_id) DO NOTHING;
