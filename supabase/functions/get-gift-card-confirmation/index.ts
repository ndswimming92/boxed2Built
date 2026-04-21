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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function firstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.trim().split(' ');
  return parts[0] || null;
}

async function getStripeClient(admin: ReturnType<typeof createClient>): Promise<Stripe> {
  const { data } = await admin
    .from('stripe_settings')
    .select('stripe_mode')
    .limit(1)
    .maybeSingle();
  const mode = data?.stripe_mode ?? 'live';
  const key = mode === 'test'
    ? (Deno.env.get('Stripe_Sandbox_Secret_Key') ?? Deno.env.get('Stripe_Live_Secret_Key')!)
    : Deno.env.get('Stripe_Live_Secret_Key')!;
  return new Stripe(key);
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');
    if (!sessionId) return json({ error: 'session_id required' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: card, error } = await admin
      .from('gift_cards')
      .select('id, status, delivery_type, initial_amount_cents, recipient_name, purchaser_name, code')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();

    if (error) return json({ error: 'Lookup failed' }, 500);
    if (!card) return json({ error: 'Not found' }, 404);

    // If still pending, check Stripe directly as a webhook fallback
    if (card.status === 'pending') {
      try {
        const stripe = await getStripeClient(admin);
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid') {
          await admin
            .from('gift_cards')
            .update({
              status: 'active',
              activated_at: new Date().toISOString(),
              stripe_payment_intent_id:
                typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : null,
            })
            .eq('id', card.id)
            .eq('status', 'pending');
          card.status = 'active';

          // Fire off the email in the background
          try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/send-gift-card-email`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ gift_card_id: card.id }),
            });
            if (!res.ok) {
              console.error('send-gift-card-email failed:', await res.text());
            }
          } catch (e) {
            console.error('Error invoking send-gift-card-email:', e);
          }
        }
      } catch (stripeErr) {
        console.error('Stripe session check failed (non-fatal):', stripeErr);
      }
    }

    const response: Record<string, unknown> = {
      status: card.status,
      delivery_type: card.delivery_type,
      amount_cents: card.initial_amount_cents,
      recipient_first_name: firstName(card.recipient_name),
      purchaser_first_name: firstName(card.purchaser_name),
    };
    if (card.delivery_type === 'self' && (card.status === 'active' || card.status === 'partially_redeemed' || card.status === 'redeemed')) {
      response.code = card.code;
    }

    return json(response);
  } catch (error) {
    console.error('get-gift-card-confirmation error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
