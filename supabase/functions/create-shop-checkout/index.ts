import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = 'https://www.boxed2built.com';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LINES = 20;

interface PayloadItem {
  product_id: string;
  quantity: number;
}

interface Payload {
  items: PayloadItem[];
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  fulfillment_method: 'shipping' | 'pickup';
  shipping_line1?: string;
  shipping_line2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postal_code?: string;
  customer_note?: string;
}

interface ProductRow {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
  short_description: string | null;
  track_inventory: boolean;
  stock_quantity: number;
  max_per_order: number;
  requires_shipping: boolean;
  allow_local_pickup: boolean;
  is_active: boolean;
  lead_time_days: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getStripeSecretKey(
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data } = await supabase
    .from('stripe_settings')
    .select('stripe_mode')
    .limit(1)
    .maybeSingle();
  const mode = data?.stripe_mode ?? 'live';
  return mode === 'test'
    ? Deno.env.get('Stripe_Sandbox_Secret_Key') ?? null
    : Deno.env.get('Stripe_Live_Secret_Key') ?? null;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const payload = (await req.json()) as Payload;

    // ── Validate the shape of the request ────────────────────────────────────
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return json({ error: 'Your cart is empty' }, 400);
    }
    if (payload.items.length > MAX_LINES) {
      return json({ error: 'Too many items in one order' }, 400);
    }
    if (!payload.customer_name?.trim()) {
      return json({ error: 'Name is required' }, 400);
    }
    if (!EMAIL_RE.test(payload.customer_email || '')) {
      return json({ error: 'A valid email is required' }, 400);
    }
    if (payload.fulfillment_method !== 'shipping' && payload.fulfillment_method !== 'pickup') {
      return json({ error: 'Choose shipping or pickup' }, 400);
    }
    if (payload.fulfillment_method === 'shipping') {
      if (
        !payload.shipping_line1?.trim() ||
        !payload.shipping_city?.trim() ||
        !payload.shipping_state?.trim() ||
        !payload.shipping_postal_code?.trim()
      ) {
        return json({ error: 'A complete shipping address is required' }, 400);
      }
    }

    const quantities = new Map<string, number>();
    for (const item of payload.items) {
      if (typeof item?.product_id !== 'string' || !item.product_id) {
        return json({ error: 'Invalid item in cart' }, 400);
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return json({ error: 'Invalid quantity in cart' }, 400);
      }
      quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + quantity);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Re-read prices and stock from the database ───────────────────────────
    // The browser only sends ids and quantities; everything that affects the
    // charge is looked up here so a tampered cart cannot set its own prices.
    const { data: productRows, error: productError } = await supabase
      .from('shop_products')
      .select(
        'id, name, price_cents, image_url, short_description, track_inventory, stock_quantity, max_per_order, requires_shipping, allow_local_pickup, is_active, lead_time_days',
      )
      .in('id', [...quantities.keys()]);

    if (productError) {
      console.error('Failed to load products:', productError);
      return json({ error: 'Could not load those products' }, 500);
    }

    const products = (productRows ?? []) as ProductRow[];
    if (products.length !== quantities.size) {
      return json({ error: 'One of those items is no longer available' }, 400);
    }

    const lines: Array<{ product: ProductRow; quantity: number; lineTotal: number }> = [];
    for (const product of products) {
      const quantity = quantities.get(product.id) ?? 0;

      if (!product.is_active) {
        return json({ error: `${product.name} is no longer for sale` }, 400);
      }
      if (quantity > product.max_per_order) {
        return json({ error: `Limit ${product.max_per_order} per order for ${product.name}` }, 400);
      }
      if (product.track_inventory && quantity > product.stock_quantity) {
        return json(
          {
            error:
              product.stock_quantity === 0
                ? `${product.name} just sold out`
                : `Only ${product.stock_quantity} left of ${product.name}`,
          },
          400,
        );
      }
      if (payload.fulfillment_method === 'shipping' && !product.requires_shipping) {
        return json({ error: `${product.name} is local pickup only` }, 400);
      }
      if (payload.fulfillment_method === 'pickup' && !product.allow_local_pickup) {
        return json({ error: `${product.name} cannot be picked up locally` }, 400);
      }

      lines.push({ product, quantity, lineTotal: product.price_cents * quantity });
    }

    // ── Store-wide settings drive shipping and tax ───────────────────────────
    const { data: settings } = await supabase
      .from('shop_settings')
      .select(
        'business_id, shipping_enabled, flat_shipping_cents, free_shipping_threshold_cents, local_pickup_enabled, tax_rate_percent',
      )
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (payload.fulfillment_method === 'shipping' && settings && !settings.shipping_enabled) {
      return json({ error: 'Shipping is turned off right now — choose local pickup' }, 400);
    }
    if (payload.fulfillment_method === 'pickup' && settings && !settings.local_pickup_enabled) {
      return json({ error: 'Local pickup is unavailable right now' }, 400);
    }

    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const threshold = settings?.free_shipping_threshold_cents ?? null;
    const qualifiesFreeShipping = threshold !== null && subtotalCents >= threshold;
    const shippingCents =
      payload.fulfillment_method === 'shipping' && !qualifiesFreeShipping
        ? settings?.flat_shipping_cents ?? 0
        : 0;
    const taxCents = Math.round((subtotalCents * Number(settings?.tax_rate_percent ?? 0)) / 100);
    const totalCents = subtotalCents + shippingCents + taxCents;

    if (totalCents <= 0) {
      return json({ error: 'That order total is invalid' }, 400);
    }

    const stripeKey = await getStripeSecretKey(supabase);
    if (!stripeKey) {
      return json({ error: 'Stripe is not configured' }, 500);
    }
    const stripe = new Stripe(stripeKey, {
      appInfo: { name: 'Boxed2Built Print Shop', version: '1.0.0' },
    });

    // ── Reserve the order before sending the customer to Stripe ──────────────
    const shipping = payload.fulfillment_method === 'shipping';
    const { data: order, error: orderError } = await supabase
      .from('shop_orders')
      .insert({
        business_id: settings?.business_id ?? null,
        customer_name: payload.customer_name.trim(),
        customer_email: payload.customer_email.trim().toLowerCase(),
        customer_phone: payload.customer_phone?.trim() || null,
        fulfillment_method: payload.fulfillment_method,
        shipping_line1: shipping ? payload.shipping_line1!.trim() : null,
        shipping_line2: shipping ? payload.shipping_line2?.trim() || null : null,
        shipping_city: shipping ? payload.shipping_city!.trim() : null,
        shipping_state: shipping ? payload.shipping_state!.trim().toUpperCase() : null,
        shipping_postal_code: shipping ? payload.shipping_postal_code!.trim() : null,
        customer_note: payload.customer_note?.trim() || null,
        status: 'pending',
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        tax_cents: taxCents,
        total_cents: totalCents,
      })
      .select('id, order_number')
      .single();

    if (orderError || !order) {
      console.error('Failed to create shop order:', orderError);
      return json({ error: 'Could not start that order' }, 500);
    }

    const { error: itemsError } = await supabase.from('shop_order_items').insert(
      lines.map((line) => ({
        order_id: order.id,
        product_id: line.product.id,
        product_name: line.product.name,
        unit_price_cents: line.product.price_cents,
        quantity: line.quantity,
        line_total_cents: line.lineTotal,
      })),
    );

    if (itemsError) {
      console.error('Failed to create shop order items:', itemsError);
      await supabase.from('shop_orders').delete().eq('id', order.id);
      return json({ error: 'Could not start that order' }, 500);
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: line.product.price_cents,
        product_data: {
          name: line.product.name,
          ...(line.product.short_description
            ? { description: line.product.short_description.slice(0, 500) }
            : {}),
          ...(line.product.image_url && /^https:\/\//.test(line.product.image_url)
            ? { images: [line.product.image_url] }
            : {}),
        },
      },
    }));

    if (shippingCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: shippingCents,
          product_data: { name: 'Shipping' },
        },
      });
    }

    if (taxCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: taxCents,
          product_data: { name: 'Sales tax' },
        },
      });
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: payload.customer_email.trim().toLowerCase(),
        line_items: lineItems,
        success_url: `${APP_URL}/store/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/store?canceled=1`,
        metadata: {
          kind: 'shop_order',
          shop_order_id: order.id,
          order_number: order.order_number,
          fulfillment_method: payload.fulfillment_method,
        },
        payment_intent_data: {
          metadata: {
            kind: 'shop_order',
            shop_order_id: order.id,
            order_number: order.order_number,
          },
        },
      });
    } catch (stripeError) {
      console.error('Stripe session create failed:', stripeError);
      await supabase.from('shop_orders').delete().eq('id', order.id);
      const message = stripeError instanceof Error ? stripeError.message : 'Stripe error';
      return json({ error: message }, 500);
    }

    await supabase
      .from('shop_orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id);

    return json({ url: session.url, order_id: order.id, order_number: order.order_number });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('create-shop-checkout error:', error);
    return json({ error: message }, 500);
  }
});
