import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const stripe = new Stripe(Deno.env.get("Stripe_Live_Secret_Key")!, {
  apiVersion: "2024-04-10",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function recordWebhookEvent(event: Stripe.Event) {
  await supabase.from("payment_webhook_events").upsert({
    provider: "stripe",
    provider_event_id: event.id,
    event_type: event.type,
    payload: event,
    processed_at: new Date().toISOString(),
    processing_status: "processed",
  }, { onConflict: "provider,provider_event_id" });
}

async function createPortalReceipt(invoice: {
  id: string;
  organization_id: string | null;
  customer_id: string | null;
  invoice_number: string;
  business_id: string | null;
}, paymentReference: string, amount: number, status: string) {
  if (!invoice.customer_id || !invoice.organization_id) return;

  const fileName = `receipt-${invoice.invoice_number}-${paymentReference}.json`;
  const storagePath = `${invoice.customer_id}/receipts/${fileName}`;

  const receiptPayload = {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    paymentReference,
    amount,
    status,
    issuedAt: new Date().toISOString(),
    provider: "stripe",
  };

  await supabase.storage
    .from("portal-document-vault")
    .upload(storagePath, new Blob([JSON.stringify(receiptPayload, null, 2)], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
    });

  await supabase.from("portal_documents").upsert({
    organization_id: invoice.organization_id,
    owner_customer_id: invoice.customer_id,
    document_type: "receipt",
    display_name: `Receipt ${invoice.invoice_number}`,
    storage_bucket: "portal-document-vault",
    storage_path: storagePath,
    related_invoice_id: invoice.id,
    is_visible_to_customer: true,
    metadata: {
      provider: "stripe",
      payment_reference: paymentReference,
      amount,
      status,
    },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) return;

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, organization_id, customer_id, amount_due, invoice_number")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return;

  const paymentReference = session.payment_intent?.toString() || session.id;
  const amountPaid = (session.amount_total || 0) / 100;

  const { data: existingPayment } = await supabase
    .from("invoice_payments")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("payment_reference", paymentReference)
    .maybeSingle();

  if (!existingPayment) {
    await supabase.from("invoice_payments").insert({
      organization_id: invoice.organization_id,
      invoice_id: invoiceId,
      payment_date: new Date().toISOString().split("T")[0],
      payment_amount: amountPaid,
      payment_method: "Stripe",
      payment_reference: paymentReference,
      notes: `Online payment via Stripe. Session: ${session.id}`,
      recorded_by: null,
      source: "stripe_webhook",
    });
  }

  await supabase
    .from("invoices")
    .update({
      stripe_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      stripe_payment_status: session.payment_status || "paid",
      stripe_last_webhook_at: new Date().toISOString(),
      stripe_payment_failure_reason: null,
    })
    .eq("id", invoiceId);

  await createPortalReceipt(invoice, paymentReference, amountPaid, "paid");
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, amount_paid, total_amount")
    .eq("stripe_payment_intent_id", intent.id)
    .maybeSingle();

  if (!invoice) return;

  const fallbackStatus = (invoice.amount_paid || 0) > 0 ? "partially_paid" : "sent";

  await supabase
    .from("invoices")
    .update({
      status: fallbackStatus,
      stripe_payment_status: intent.status,
      stripe_payment_failure_reason: intent.last_payment_error?.message || "Payment failed",
      stripe_last_webhook_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentReference = charge.payment_intent?.toString() || charge.id;

  const { data: payment } = await supabase
    .from("invoice_payments")
    .select("invoice_id")
    .eq("payment_reference", paymentReference)
    .maybeSingle();

  if (!payment) return;

  const refundedAmount = (charge.amount_refunded || 0) / 100;

  await supabase
    .from("invoices")
    .update({
      status: "sent",
      stripe_payment_status: charge.refunded ? "refunded" : "partially_refunded",
      stripe_refunded_amount: refundedAmount,
      stripe_last_webhook_at: new Date().toISOString(),
    })
    .eq("id", payment.invoice_id);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "payment_intent.payment_failed") {
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
    } else if (event.type === "charge.refunded") {
      await handleChargeRefunded(event.data.object as Stripe.Charge);
    }

    await recordWebhookEvent(event);

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
