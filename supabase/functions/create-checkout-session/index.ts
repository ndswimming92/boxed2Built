import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { invoiceId } = await req.json();

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

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, invoice_line_items(*)")
      .eq("id", invoiceId)
      .eq("is_active", true)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Invoice is not payable" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: bizData } = await supabase
      .from("business_info")
      .select("business_name, logo_url")
      .eq("id", invoice.business_id)
      .maybeSingle();

    const stripe = new Stripe(Deno.env.get("Stripe_Sandbox_Secret_Key")!, {
      apiVersion: "2024-04-10",
    });

    const amountDueCents = Math.round((invoice.amount_due || 0) * 100);

    if (amountDueCents < 50) {
      return new Response(JSON.stringify({ error: "Amount due is too small to process" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = req.headers.get("origin") || "https://www.boxed2built.com";

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
      },
      success_url: `${appUrl}/pay/${invoiceId}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pay/${invoiceId}`,
    });

    await supabase
      .from("invoices")
      .update({ stripe_session_id: session.id })
      .eq("id", invoiceId);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
