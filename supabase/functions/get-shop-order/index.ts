import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { markShopOrderPaid } from '../_shared/shopOrder.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function firstName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.trim().split(' ')[0] || null;
}

async function getStripeClient(admin: ReturnType<typeof createClient>): Promise<Stripe> {
  const { data } = await admin
    .from('stripe_settings')
    .select('stripe_mode')
    .limit(1)
    .maybeSingle();
  const mode = data?.stripe_mode ?? 'live';
  const key =
    mode === 'test'
      ? Deno.env.get('Stripe_Sandbox_Secret_Key') ?? Deno.env.get('Stripe_Live_Secret_Key')!
      : Deno.env.get('Stripe_Live_Secret_Key')!;
  return new Stripe(key);
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const sessionId = new URL(req.url).searchParams.get('session_id');
    if (!sessionId) return json({ error: 'session_id required' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error } = await admin
      .from('shop_orders')
      .select(
        'id, order_number, status, customer_name, fulfillment_method, subtotal_cents, shipping_cents, tax_cents, total_cents',
      )
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();

    if (error) {
      console.error('Shop order lookup failed:', error);
      return json({ error: 'Lookup failed' }, 500);
    }
    if (!order) return json({ error: 'Not found' }, 404);

    // Webhook fallback: if the order is still pending, ask Stripe directly.
    if (order.status === 'pending') {
      try {
        const stripe = await getStripeClient(admin);
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid') {
          await markShopOrderPaid(admin, {
            orderId: order.id,
            sessionId,
            paymentIntentId:
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
          });
          order.status = 'paid';
        }
      } catch (stripeError) {
        console.error('Stripe session check failed (non-fatal):', stripeError);
      }
    }

    const { data: items } = await admin
      .from('shop_order_items')
      .select('product_name, quantity, line_total_cents, product_id')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    // Longest lead time across the ordered products sets the "ready by" note.
    const productIds = (items ?? [])
      .map((item) => item.product_id)
      .filter((id): id is string => !!id);

    let leadTimeDays = 0;
    if (productIds.length > 0) {
      const { data: products } = await admin
        .from('shop_products')
        .select('lead_time_days')
        .in('id', productIds);
      leadTimeDays = (products ?? []).reduce(
        (max, product) => Math.max(max, product.lead_time_days ?? 0),
        0,
      );
    }

    return json({
      order_number: order.order_number,
      status: order.status,
      customer_first_name: firstName(order.customer_name),
      fulfillment_method: order.fulfillment_method,
      subtotal_cents: order.subtotal_cents,
      shipping_cents: order.shipping_cents,
      tax_cents: order.tax_cents,
      total_cents: order.total_cents,
      lead_time_days: leadTimeDays,
      items: (items ?? []).map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        line_total_cents: item.line_total_cents,
      })),
    });
  } catch (error) {
    console.error('get-shop-order error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
