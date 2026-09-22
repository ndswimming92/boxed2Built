// Hands a customer a Boxed2Built coupon as an Apple Wallet pass.
//
// Public on purpose: the point is that the link in a Facebook promo post opens
// straight into Wallet. Protection comes from lookup_coupon_by_code, which is
// IP-throttled at 20 lookups per 15 minutes and only returns a coupon that is
// active and inside its window — so this endpoint cannot be used to enumerate
// codes or to resurrect an expired one.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildPkpass, certificatesFromEnv, type PassFiles } from '../_shared/pkpass.ts';
import { buildCouponPass, type CouponPassRow } from '../_shared/couponPass.ts';
import { PASS_ASSETS } from '../_shared/pass-assets/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://boxed2built.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const rawCode = url.searchParams.get('code')
      ?? (req.method === 'POST' ? (await req.json().catch(() => ({})))?.code : null);

    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    if (!code) return json({ error: 'A coupon code is required.' }, 400);

    // Resolved before the lookup: if the pass cannot be signed, there is no
    // point spending a rate-limited lookup to find that out.
    let certificates;
    try {
      if (!Deno.env.get('APPLE_PASS_TYPE_ID') || !Deno.env.get('APPLE_TEAM_ID')) {
        throw new Error('Apple Wallet is not configured: missing APPLE_PASS_TYPE_ID, APPLE_TEAM_ID.');
      }
      certificates = certificatesFromEnv();
    } catch (configError) {
      console.error('generate-coupon-pass not configured:', configError);
      return json({ error: 'Apple Wallet is not set up for this site yet.' }, 503);
    }

    // Called with the anon key, not the service role, so the definer function
    // applies its own rate limit and window check exactly as it does for the
    // contact form. Forwarding the caller's address keeps that limit per-client
    // instead of lumping every visitor into this function's own bucket.
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: {
            'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '',
          },
        },
      },
    );

    const { data, error } = await anonClient.rpc('lookup_coupon_by_code', { p_code: code });

    if (error) {
      // P0001 is the rate limiter in lookup_coupon_by_code.
      const throttled = error.code === 'P0001';
      return json(
        { error: throttled ? 'Too many lookups. Please try again shortly.' : 'Could not look up that code.' },
        throttled ? 429 : 500,
      );
    }

    const coupon = (Array.isArray(data) ? data[0] : data) as CouponPassRow | undefined;
    if (!coupon) {
      // Indistinguishable from "expired" or "switched off" on purpose — the
      // function should not confirm which codes exist.
      return json({ error: 'That code is not available.' }, 404);
    }

    const files: PassFiles = {
      ...PASS_ASSETS,
      'pass.json': new TextEncoder().encode(
        JSON.stringify(
          buildCouponPass(coupon, {
            passTypeIdentifier: Deno.env.get('APPLE_PASS_TYPE_ID')!,
            teamIdentifier: Deno.env.get('APPLE_TEAM_ID')!,
            siteUrl: SITE_URL,
          }),
        ),
      ),
    };

    const pkpass = buildPkpass(files, certificates);

    return new Response(pkpass, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="boxed2built-${coupon.code}.pkpass"`,
        // Coupons change rarely, but never serve a stale one past its expiry.
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('generate-coupon-pass error:', message);
    return json({ error: 'Could not build that pass.' }, 500);
  }
});
