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

async function getStripeSecretKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
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

const ALLOWED_AMOUNTS_CENTS = new Set([2500, 5000, 10000, 20000]);
// Bounds for customer-entered custom amounts. Keep in sync with
// src/constants/giftCards.ts (GIFT_CARD_MIN_CENTS / GIFT_CARD_MAX_CENTS).
const CUSTOM_MIN_CENTS = 1000; // $10
const CUSTOM_MAX_CENTS = 100000; // $1,000

function isValidAmountCents(cents: unknown): cents is number {
  if (typeof cents !== 'number' || !Number.isInteger(cents)) return false;
  if (ALLOWED_AMOUNTS_CENTS.has(cents)) return true;
  // Custom amounts: whole dollars within bounds.
  return cents % 100 === 0 && cents >= CUSTOM_MIN_CENTS && cents <= CUSTOM_MAX_CENTS;
}

interface Payload {
  amount_cents: number;
  purchaser_name: string;
  purchaser_email: string;
  delivery_type: 'self' | 'recipient';
  recipient_name?: string;
  recipient_email?: string;
  personal_message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Characters exclude 0/O, 1/I/L, etc.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars: string[] = [];
  for (let i = 0; i < 8; i++) {
    chars.push(CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]);
  }
  return `B2B-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

    // Validate
    if (!isValidAmountCents(payload.amount_cents)) {
      return json({ error: 'Invalid gift card amount' }, 400);
    }
    if (!payload.purchaser_name?.trim()) {
      return json({ error: 'Purchaser name is required' }, 400);
    }
    if (!EMAIL_RE.test(payload.purchaser_email || '')) {
      return json({ error: 'A valid purchaser email is required' }, 400);
    }
    if (payload.delivery_type !== 'self' && payload.delivery_type !== 'recipient') {
      return json({ error: 'Invalid delivery type' }, 400);
    }
    if (payload.delivery_type === 'recipient') {
      if (!payload.recipient_name?.trim()) {
        return json({ error: 'Recipient name is required' }, 400);
      }
      if (!EMAIL_RE.test(payload.recipient_email || '')) {
        return json({ error: 'A valid recipient email is required' }, 400);
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const stripeKey = await getStripeSecretKey(supabase);
    if (!stripeKey) {
      return json({ error: 'Stripe is not configured' }, 500);
    }
    const stripe = new Stripe(stripeKey, {
      appInfo: { name: 'Boxed2Built Gift Cards', version: '1.0.0' },
    });

    // Insert pending gift card (retry a couple times on unlikely code collision)
    let giftCardId = '';
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCode();
      const { data, error } = await supabase
        .from('gift_cards')
        .insert({
          code: candidate,
          initial_amount_cents: payload.amount_cents,
          remaining_amount_cents: payload.amount_cents,
          status: 'pending',
          purchaser_name: payload.purchaser_name.trim(),
          purchaser_email: payload.purchaser_email.trim().toLowerCase(),
          delivery_type: payload.delivery_type,
          recipient_name:
            payload.delivery_type === 'recipient'
              ? (payload.recipient_name || '').trim()
              : null,
          recipient_email:
            payload.delivery_type === 'recipient'
              ? (payload.recipient_email || '').trim().toLowerCase()
              : null,
          personal_message: payload.personal_message?.trim() || null,
        })
        .select('id, code')
        .maybeSingle();

      if (!error && data) {
        giftCardId = data.id;
        code = data.code;
        break;
      }
      if (error && !/unique/i.test(error.message)) {
        console.error('Failed to insert gift card:', error);
        return json({ error: 'Failed to create gift card' }, 500);
      }
    }
    if (!giftCardId) {
      return json({ error: 'Could not generate unique gift card code' }, 500);
    }

    const successUrl = `${APP_URL}/gift-cards/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${APP_URL}/gift-cards?canceled=1`;

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: payload.purchaser_email.trim().toLowerCase(),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: payload.amount_cents,
              product_data: {
                name: `Boxed2Built Gift Card — $${payload.amount_cents / 100}`,
                description:
                  'Service credit for Boxed2Built furniture assembly. Balance never expires and rolls over across jobs.',
              },
            },
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          kind: 'gift_card',
          gift_card_id: giftCardId,
          gift_card_code: code,
          amount_cents: String(payload.amount_cents),
          delivery_type: payload.delivery_type,
        },
        payment_intent_data: {
          metadata: {
            kind: 'gift_card',
            gift_card_id: giftCardId,
            gift_card_code: code,
          },
        },
      });
    } catch (e) {
      console.error('Stripe session create failed', e);
      // Roll back the pending row
      await supabase.from('gift_cards').delete().eq('id', giftCardId);
      // Upstream detail stays in the logs; the browser gets a generic message.
      return json({ error: 'We could not start checkout. Please try again.' }, 500);
    }

    await supabase
      .from('gift_cards')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', giftCardId);

    return json({ url: session.url, gift_card_id: giftCardId });
  } catch (error) {
    console.error('create-gift-card-checkout error:', error);
    return json({ error: 'We could not start checkout. Please try again.' }, 500);
  }
});
