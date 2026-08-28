import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import { postTextToFacebook, type FacebookTokens } from '../_shared/socialPublish.ts';
import { buildFallbackPromoMessage, type CouponPromoRow } from '../_shared/couponPromo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://boxed2built.com';

const COUPON_COLUMNS =
  'id, code, description, discount_type, discount_value, starts_at, ends_at, is_active, ' +
  'promote, promo_post_at, promo_message, promo_reminder_sent_at, promo_reminder_for, ' +
  'facebook_post_id, facebook_posted_at, facebook_post_error';

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

    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) return json({ error: auth.error ?? 'Unauthorized' }, auth.status ?? 401);

    const body = await req.json().catch(() => ({}));
    const couponId = body?.coupon_id as string | undefined;
    if (!couponId) return json({ error: 'coupon_id is required' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: coupon, error: couponErr } = await admin
      .from('coupons')
      .select(COUPON_COLUMNS)
      .eq('id', couponId)
      .maybeSingle<CouponPromoRow>();
    if (couponErr || !coupon) return json({ error: 'Coupon not found' }, 404);

    // Announcing a code the form will refuse sends every reader who acts on it
    // to a "not a coupon code" message, so it is worth stopping here.
    if (!coupon.is_active) {
      return json({ error: `${coupon.code} is switched off — turn it on before posting it.` }, 400);
    }
    if (coupon.ends_at && new Date(coupon.ends_at) <= new Date()) {
      return json({ error: `${coupon.code} has expired — extend its last day before posting it.` }, 400);
    }

    // An edit made in the box but not yet saved still posts; the box is what
    // the admin just read, so it wins over the stored copy.
    const override = typeof body?.message === 'string' ? body.message.trim() : '';
    const message = override || coupon.promo_message?.trim() || buildFallbackPromoMessage(coupon, SITE_URL);

    const { data: connection, error: connErr } = await admin
      .from('integration_connections')
      .select('vault_secret_name')
      .eq('provider', 'facebook')
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (connErr || !connection?.vault_secret_name) {
      return json({ error: 'Facebook is not connected. Connect it under Admin → Connections first.' }, 400);
    }

    const { data: secretJson, error: secretErr } = await admin.rpc('read_vault_secret', {
      p_name: connection.vault_secret_name,
    });
    if (secretErr || !secretJson) {
      return json({ error: 'Could not load the stored Facebook credentials. Try reconnecting.' }, 500);
    }
    const tokens = JSON.parse(secretJson) as FacebookTokens;

    const result = await postTextToFacebook(tokens, message);

    const { error: saveErr } = await admin
      .from('coupons')
      .update({
        // Keep what was actually posted, not what happened to be stored: the
        // reminder email and the card both quote this field afterwards.
        promo_message: message,
        facebook_post_id: result.success ? result.post_id : null,
        facebook_posted_at: result.success ? new Date().toISOString() : null,
        facebook_post_error: result.success ? null : result.error,
      })
      .eq('id', couponId);
    if (saveErr) console.error('publish-coupon-promo: failed to record the result', saveErr);

    return json({ facebook: result, message });
  } catch (error) {
    console.error('publish-coupon-promo error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
