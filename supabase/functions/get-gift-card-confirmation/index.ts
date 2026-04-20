import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
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
      .select('status, delivery_type, initial_amount_cents, recipient_name, purchaser_name, code')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();

    if (error) return json({ error: 'Lookup failed' }, 500);
    if (!card) return json({ error: 'Not found' }, 404);

    const response: Record<string, unknown> = {
      status: card.status,
      delivery_type: card.delivery_type,
      amount_cents: card.initial_amount_cents,
      recipient_first_name: firstName(card.recipient_name),
      purchaser_first_name: firstName(card.purchaser_name),
    };
    // Only expose the code to the purchaser flow (self-delivery)
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
