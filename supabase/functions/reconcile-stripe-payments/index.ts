import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";
import { authorizeAdminOrService } from "../_shared/authorize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // F18: reconciliation writes payment records, so it is reachable only by the
  // scheduled job (service role) or signed-in staff.
  const auth = await authorizeAdminOrService(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error ?? "Unauthorized" }), {
      status: auth.status ?? 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: settings } = await supabase
    .from("stripe_settings")
    .select("stripe_mode")
    .limit(1)
    .maybeSingle();
  const stripeMode = settings?.stripe_mode ?? "live";
  const stripeKey = stripeMode === "test"
    ? (Deno.env.get("Stripe_Sandbox_Secret_Key") ?? Deno.env.get("Stripe_Live_Secret_Key")!)
    : Deno.env.get("Stripe_Live_Secret_Key")!;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, stripe_session_id, stripe_payment_intent_id")
    .in("status", ["sent", "partially_paid", "overdue"])
    .not("stripe_session_id", "is", null)
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let updated = 0;

  for (const invoice of invoices || []) {
    try {
      const session = await stripe.checkout.sessions.retrieve(invoice.stripe_session_id);
      const paymentIntentId = (typeof session.payment_intent === "string" ? session.payment_intent : invoice.stripe_payment_intent_id) || null;

      if (session.payment_status === "paid") {
        const amount = (session.amount_total || 0) / 100;
        const { data: existing } = await supabase
          .from("invoice_payments")
          .select("id")
          .eq("invoice_id", invoice.id)
          .eq("payment_reference", paymentIntentId || session.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from("invoice_payments").insert({
            invoice_id: invoice.id,
            payment_date: new Date().toISOString().split("T")[0],
            payment_amount: amount,
            payment_method: "Stripe",
            payment_reference: paymentIntentId || session.id,
            notes: "Reconciled payment from Stripe checkout session",
            source: "stripe_reconciliation",
          });
        }

        await supabase.from("invoices").update({
          stripe_payment_status: session.payment_status,
          stripe_payment_intent_id: paymentIntentId,
          stripe_last_webhook_at: new Date().toISOString(),
        }).eq("id", invoice.id);
        updated += 1;
      }
    } catch (reconcileError) {
      console.error("Failed to reconcile invoice", invoice.id, reconcileError);
      await supabase.from("payment_webhook_events").insert({
        provider: "stripe",
        provider_event_id: `reconcile-${invoice.id}-${Date.now()}`,
        event_type: "reconciliation.error",
        payload: { invoiceId: invoice.id, error: String(reconcileError) },
        processing_status: "failed",
      });
    }
  }

  return new Response(JSON.stringify({ reconciled: updated }), {
    headers: { "Content-Type": "application/json" },
  });
});
