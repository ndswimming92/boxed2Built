// DEPRECATED: gift card events are now handled by supabase/functions/stripe-webhook
// using the existing STRIPE_WEBHOOK_SECRET and Stripe endpoint. This file is kept
// only so the deployed function (if any) does not error out — it responds with a
// hint pointing operators at the unified webhook.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      deprecated: true,
      message:
        'Gift card events are now handled by the unified stripe-webhook endpoint. Update Stripe to point at /functions/v1/stripe-webhook.',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
