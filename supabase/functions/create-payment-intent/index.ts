// Creates a PaymentIntent for an invoice so the pay page can render Stripe's
// Express Checkout Element (Apple Pay / Google Pay) inline, instead of
// redirecting to checkout.stripe.com.
//
// Authorization mirrors create-checkout-session exactly: a public payment link
// proves itself with the invoice's payment_access_token, a portal payer proves
// itself with a Supabase session mapped to customers.auth_user_id. Keep the two
// functions in step — they guard the same money.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { invoiceLabels } from "../_shared/invoiceLabels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// The publishable key travels back to the browser with the client secret so the
// two can never disagree about mode. Reading the mode in two places is how you
// end up initialising Stripe.js with a live key against a test intent.
async function getStripeKeys(
  supabase: ReturnType<typeof createClient>,
): Promise<{ secretKey: string; publishableKey: string; mode: string }> {
  const { data } = await supabase
    .from("stripe_settings")
    .select("stripe_mode")
    .limit(1)
    .maybeSingle();
  const mode = data?.stripe_mode ?? "live";

  if (mode === "test") {
    return {
      secretKey: Deno.env.get("Stripe_Sandbox_Secret_Key") ?? Deno.env.get("Stripe_Live_Secret_Key")!,
      publishableKey:
        Deno.env.get("Stripe_Sandbox_Publishable_Key") ?? Deno.env.get("Stripe_Live_Publishable_Key") ?? "",
      mode,
    };
  }

  return {
    secretKey: Deno.env.get("Stripe_Live_Secret_Key")!,
    publishableKey: Deno.env.get("Stripe_Live_Publishable_Key") ?? "",
    mode,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { invoiceId, paymentToken, source } = await req.json();

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

    let authenticatedCustomerId: string | null = null;
    if (token) {
      const { data: userData } = await supabase.auth.getUser(token);
      const authUserId = userData.user?.id ?? null;
      if (authUserId) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", authUserId)
          .maybeSingle();
        authenticatedCustomerId = customer?.id ?? null;
      }
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        "id, customer_id, business_id, invoice_number, invoice_type, client_name, client_email, amount_due, status, payment_access_token, stripe_payment_intent_id",
      )
      .eq("id", invoiceId)
      .eq("is_active", true)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (source !== "portal") {
      if (!paymentToken || paymentToken !== invoice.payment_access_token) {
        return new Response(JSON.stringify({ error: "Invalid payment link" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (source === "portal") {
      if (!authenticatedCustomerId || invoice.customer_id !== authenticatedCustomerId) {
        return new Response(JSON.stringify({ error: "Unauthorized invoice access" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Invoice is not payable" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: bizData } = await supabase
      .from("business_info")
      .select("business_name")
      .eq("id", invoice.business_id)
      .maybeSingle();

    const { secretKey, publishableKey } = await getStripeKeys(supabase);

    if (!publishableKey) {
      return new Response(
        JSON.stringify({ error: "Stripe publishable key is not configured for this mode" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(secretKey);

    const amountDueCents = Math.round((invoice.amount_due || 0) * 100);

    if (amountDueCents < 50) {
      return new Response(JSON.stringify({ error: "Amount due is too small to process" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const businessName = bizData?.business_name || "Boxed2Built";
    const metadata = {
      invoice_id: invoiceId,
      invoice_number: invoice.invoice_number,
      client_name: invoice.client_name,
      checkout_source: source === "portal" ? "portal_express" : "public_express",
      customer_id: invoice.customer_id || "",
    };

    // Reuse the invoice's existing intent where we still can, so a customer who
    // reloads the pay page does not leave a trail of abandoned PaymentIntents.
    // Only a still-open intent for the exact current balance qualifies: a
    // part-payment recorded elsewhere changes amount_due, and a stale intent
    // would quietly charge the old figure.
    let intent: Stripe.PaymentIntent | null = null;
    if (invoice.stripe_payment_intent_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id);
        const reusable =
          existing.amount === amountDueCents &&
          existing.currency === "usd" &&
          ["requires_payment_method", "requires_confirmation"].includes(existing.status);
        if (reusable) {
          intent = await stripe.paymentIntents.update(existing.id, { metadata });
        }
      } catch (_err) {
        // Intent belongs to the other Stripe mode, or was cancelled. Make a new one.
        intent = null;
      }
    }

    if (!intent) {
      intent = await stripe.paymentIntents.create({
        amount: amountDueCents,
        currency: "usd",
        // Lets the dashboard decide which wallets and cards are offered.
        automatic_payment_methods: { enabled: true },
        description: `${invoiceLabels(invoice.invoice_type).type} ${invoice.invoice_number} — ${businessName}`,
        receipt_email: invoice.client_email || undefined,
        metadata,
      });
    }

    await supabase
      .from("invoices")
      .update({
        stripe_payment_intent_id: intent.id,
        stripe_payment_status: intent.status,
      })
      .eq("id", invoiceId);

    return new Response(
      JSON.stringify({
        clientSecret: intent.client_secret,
        publishableKey,
        amount: amountDueCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("create-payment-intent error:", message);
    return new Response(JSON.stringify({ error: message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
