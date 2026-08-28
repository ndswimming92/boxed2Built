import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { authorizeAdminOrService } from '../_shared/authorize.ts';
import {
  buildFallbackPromoMessage,
  draftPromoMessage,
  type CouponPromoRow,
} from '../_shared/couponPromo.ts';

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

    // Drafting spends money on every call, so it is admin-only — same bar as
    // the gallery caption writer.
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

    const apiKey =
      Deno.env.get('Claude_Coupon_Promo') ?? Deno.env.get('Claude_Gallery_Image_Creation');
    if (!apiKey) return json({ error: 'Claude API key not configured' }, 500);

    const { message, error } = await draftPromoMessage(coupon, apiKey, SITE_URL);

    // A failed draft still leaves the admin with something to post rather than
    // an empty box, but it is reported as a fallback so the difference is
    // visible on screen.
    const resolved = message ?? buildFallbackPromoMessage(coupon, SITE_URL);

    const { error: saveErr } = await admin
      .from('coupons')
      .update({ promo_message: resolved })
      .eq('id', couponId);
    if (saveErr) {
      console.error('draft-coupon-promo: failed to save the draft', saveErr);
      return json({ error: 'Drafted the post but could not save it. Try again.' }, 500);
    }

    if (error) console.error(`draft-coupon-promo ${coupon.code}: ${error}`);

    return json({ message: resolved, drafted_by_claude: message !== null, error });
  } catch (error) {
    console.error('draft-coupon-promo error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
