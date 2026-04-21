import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getStripeSecretKey(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from("stripe_settings")
    .select("stripe_mode")
    .limit(1)
    .maybeSingle();
  const mode = data?.stripe_mode ?? "live";
  return mode === "test"
    ? (Deno.env.get("Stripe_Sandbox_Secret_Key") ?? Deno.env.get("Stripe_Live_Secret_Key")!)
    : Deno.env.get("Stripe_Live_Secret_Key")!;
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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
      .select("id, customer_id, business_id, invoice_number, client_name, client_email, amount_due, status, payment_access_token")
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

    const stripeKey = await getStripeSecretKey(supabase);
    const stripe = new Stripe(stripeKey);

    const amountDueCents = Math.round((invoice.amount_due || 0) * 100);

    if (amountDueCents < 50) {
      return new Response(JSON.stringify({ error: "Amount due is too small to process" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = "https://www.boxed2built.com";

    const successUrl = source === "portal"
      ? `${appUrl}/portal/invoices?paid=1`
      : `${appUrl}/pay/${invoiceId}/${invoice.payment_access_token}/thank-you?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl = source === "portal"
      ? `${appUrl}/portal/invoices`
      : `${appUrl}/pay/${invoiceId}/${invoice.payment_access_token}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: invoice.client_email || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `Payment for services from ${bizData?.business_name || "Boxed2Built"}`,
            },
            unit_amount: amountDueCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        client_name: invoice.client_name,
        checkout_source: source || "public_payment_link",
        customer_id: invoice.customer_id || "",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    await supabase
      .from("invoices")
      .update({
        stripe_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        stripe_payment_status: session.payment_status || "unpaid",
      })
      .eq("id", invoiceId);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("create-checkout-session error:", message);
    return new Response(JSON.stringify({ error: message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
