import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET =
  Deno.env.get('STRIPE_GIFT_CARD_WEBHOOK_SECRET') ||
  Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  appInfo: { name: 'Boxed2Built Gift Cards', version: '1.0.0' },
});
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('No signature', { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'verification failed';
      console.error('gift-card-webhook signature error:', msg);
      return new Response(`Bad signature: ${msg}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));
    return Response.json({ received: true });
  } catch (error) {
    console.error('gift-card-webhook error:', error);
    const msg = error instanceof Error ? error.message : 'unknown';
    return Response.json({ error: msg }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const obj = event.data.object as Record<string, unknown>;
  const metadata = (obj?.metadata as Record<string, string> | undefined) ?? {};
  if (metadata.kind !== 'gift_card') {
    // Not our event — ignore.
    return;
  }

  const giftCardId = metadata.gift_card_id;
  if (!giftCardId) return;

  if (event.type === 'checkout.session.completed') {
    const session = obj as unknown as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') {
      console.info(`Gift card session ${session.id} not paid yet`);
      return;
    }

    // Idempotency: only activate if still pending
    const { data: card } = await supabase
      .from('gift_cards')
      .select('id, status, activated_at')
      .eq('id', giftCardId)
      .maybeSingle();
    if (!card) {
      console.warn(`Gift card ${giftCardId} not found for webhook`);
      return;
    }
    if (card.status === 'active' || card.status === 'partially_redeemed' || card.status === 'redeemed') {
      console.info(`Gift card ${giftCardId} already activated`);
      return;
    }

    const { error: updErr } = await supabase
      .from('gift_cards')
      .update({
        status: 'active',
        activated_at: new Date().toISOString(),
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null,
      })
      .eq('id', giftCardId);
    if (updErr) {
      console.error('Failed to activate gift card:', updErr);
      return;
    }

    // Dispatch the email (non-blocking by design; log failures)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-gift-card-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gift_card_id: giftCardId }),
      });
      if (!res.ok) {
        console.error('send-gift-card-email failed:', await res.text());
      }
    } catch (e) {
      console.error('Error invoking send-gift-card-email:', e);
    }
  } else if (
    event.type === 'checkout.session.expired' ||
    event.type === 'payment_intent.payment_failed'
  ) {
    await supabase
      .from('gift_cards')
      .update({ status: 'failed' })
      .eq('id', giftCardId)
      .eq('status', 'pending');
  }
}
