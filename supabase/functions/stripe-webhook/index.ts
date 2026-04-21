import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const liveWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const testWebhookSecret = Deno.env.get('STRIPE_TEST_WEBHOOK_SECRET') ?? '';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function createStripeClient(isTestMode: boolean): Stripe {
  const key = isTestMode
    ? (Deno.env.get('Stripe_Sandbox_Secret_Key') ?? Deno.env.get('Stripe_Live_Secret_Key')!)
    : Deno.env.get('Stripe_Live_Secret_Key')!;
  return new Stripe(key, {
    appInfo: { name: 'Bolt Integration', version: '1.0.0' },
  });
}

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
      return new Response('No signature found', { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;
    let isTestMode = false;

    // Try live webhook secret first, then fall back to test
    const liveStripe = createStripeClient(false);
    try {
      event = await liveStripe.webhooks.constructEventAsync(body, signature, liveWebhookSecret);
    } catch {
      if (!testWebhookSecret) {
        return new Response('Webhook signature verification failed', { status: 400 });
      }
      try {
        const testStripe = createStripeClient(true);
        event = await testStripe.webhooks.constructEventAsync(body, signature, testWebhookSecret);
        isTestMode = true;
      } catch (testError: any) {
        console.error(`Webhook signature verification failed for both live and test: ${testError.message}`);
        return new Response(`Webhook signature verification failed: ${testError.message}`, { status: 400 });
      }
    }

    const stripe = isTestMode ? createStripeClient(true) : liveStripe;

    EdgeRuntime.waitUntil(handleEvent(event, stripe));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event, stripe: Stripe) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  const metadata =
    ((stripeData as Record<string, unknown>).metadata as Record<string, string> | undefined) ?? {};
  if (metadata.kind === 'gift_card') {
    await handleGiftCardEvent(event);
    return;
  }

  if (!('customer' in stripeData)) {
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event
  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId, stripe);
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
        } = stripeData as Stripe.Checkout.Session;

        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed',
        });

        if (orderError) {
          console.error('Error inserting order:', orderError);
          return;
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
    }
  }
}

async function handleGiftCardEvent(event: Stripe.Event) {
  const obj = event.data.object as Record<string, unknown>;
  const metadata = (obj?.metadata as Record<string, string> | undefined) ?? {};
  const giftCardId = metadata.gift_card_id;
  if (!giftCardId) return;

  if (event.type === 'checkout.session.completed') {
    const session = obj as unknown as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') {
      console.info(`Gift card session ${session.id} not paid yet`);
      return;
    }

    const { data: card } = await supabase
      .from('gift_cards')
      .select('id, status')
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

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-gift-card-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
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

async function syncCustomerFromStripe(customerId: string, stripe: Stripe) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
    }

    const subscription = subscriptions.data[0];

    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}
