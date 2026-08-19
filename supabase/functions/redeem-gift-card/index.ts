import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface Payload {
  gift_card_id?: string;
  code?: string;
  amount_cents: number;
  job_id?: string | null;
  invoice_id?: string | null;
  notes?: string | null;
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
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    // Authenticate the caller as a platform admin
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    const appMeta = (userData.user.app_metadata || {}) as Record<string, unknown>;
    if (appMeta.is_platform_admin !== true && appMeta.is_platform_admin !== 'true') {
      return json({ error: 'Forbidden' }, 403);
    }

    const body = (await req.json()) as Payload;
    if (!body.amount_cents || body.amount_cents <= 0) {
      return json({ error: 'amount_cents must be positive' }, 400);
    }
    if (!body.gift_card_id && !body.code) {
      return json({ error: 'gift_card_id or code is required' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let giftCardId = body.gift_card_id || '';
    if (!giftCardId && body.code) {
      const { data: card, error } = await admin
        .from('gift_cards')
        .select('id')
        .eq('code', body.code.toUpperCase())
        .maybeSingle();
      if (error || !card) return json({ error: 'Gift card not found' }, 404);
      giftCardId = card.id;
    }

    const { data, error } = await admin.rpc('redeem_gift_card', {
      p_gift_card_id: giftCardId,
      p_amount_cents: body.amount_cents,
      p_job_id: body.job_id ?? null,
      p_invoice_id: body.invoice_id ?? null,
      p_redeemed_by_name: userData.user.user_metadata?.full_name || null,
      p_redeemed_by_email: userData.user.email || null,
      p_notes: body.notes ?? null,
    });

    if (error) {
      // F23: log the database detail server-side, return a generic message.
      console.error('redeem-gift-card rpc error:', error);
      return json({ error: 'This gift card could not be redeemed.' }, 400);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return json({ success: true, ...row });
  } catch (error) {
    console.error('redeem-gift-card error:', error);
    return json({ error: 'Something went wrong redeeming this gift card.' }, 500);
  }
});
