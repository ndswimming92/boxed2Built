// Lists recent succeeded Stripe payments that are not yet recorded against any
// invoice, so the admin can attach one to the invoice it belongs to.
//
// This exists because Tap to Pay on iPhone runs in the Stripe Dashboard app,
// which knows nothing about this system: a tap taken at the job site lands in
// Stripe with no invoice metadata, leaving the invoice sitting at "sent" and
// clients.total_revenue untouched. Everything here is read-only — the linking
// write happens from the admin client against invoice_payments.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { authorizeAdminOrService } from "../_shared/authorize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 120;
const STRIPE_PAGE_LIMIT = 100;

interface UnlinkedPayment {
  id: string;
  amount: number;
  currency: string;
  created: string;
  description: string | null;
  /** "Tap to Pay", "Apple Pay", "Visa ending 4242", … — what the admin recognises. */
  methodLabel: string;
  /** True for a contactless charge taken on a phone or reader, i.e. in person. */
  inPerson: boolean;
  receiptEmail: string | null;
}

function describeCharge(charge: Stripe.Charge | null): { label: string; inPerson: boolean } {
  const details = charge?.payment_method_details;
  if (!details) return { label: "Card", inPerson: false };

  if (details.type === "card_present") {
    const present = details.card_present;
    const brand = present?.brand ? present.brand.toUpperCase() : "Card";
    const last4 = present?.last4 ? ` ····${present.last4}` : "";
    return { label: `Tap to Pay · ${brand}${last4}`, inPerson: true };
  }

  if (details.type === "card") {
    const card = details.card;
    const wallet = card?.wallet?.type;
    const brand = card?.brand ? card.brand.toUpperCase() : "Card";
    const last4 = card?.last4 ? ` ····${card.last4}` : "";
    if (wallet === "apple_pay") return { label: `Apple Pay · ${brand}${last4}`, inPerson: false };
    if (wallet === "google_pay") return { label: `Google Pay · ${brand}${last4}`, inPerson: false };
    return { label: `${brand}${last4}`, inPerson: false };
  }

  return { label: details.type.replace(/_/g, " "), inPerson: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Reads live payment data across the whole account, so staff only.
  const auth = await authorizeAdminOrService(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error ?? "Unauthorized" }), {
      status: auth.status ?? 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let lookbackDays = DEFAULT_LOOKBACK_DAYS;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const requested = Number(body?.lookbackDays);
      if (Number.isFinite(requested) && requested > 0) {
        lookbackDays = Math.min(Math.floor(requested), MAX_LOOKBACK_DAYS);
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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
    const stripe = new Stripe(stripeKey);

    const since = Math.floor(Date.now() / 1000) - lookbackDays * 24 * 60 * 60;

    const intents = await stripe.paymentIntents.list({
      limit: STRIPE_PAGE_LIMIT,
      created: { gte: since },
      expand: ["data.latest_charge"],
    });

    const succeeded = intents.data.filter((intent) => intent.status === "succeeded");

    if (succeeded.length === 0) {
      return new Response(JSON.stringify({ payments: [], stripeMode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // One round trip rather than a query per intent. Anything already sitting in
    // invoice_payments — settled by the webhook, the reconciler, or a previous
    // link — is spent and must not be offered again.
    const { data: linkedRows } = await supabase
      .from("invoice_payments")
      .select("payment_reference")
      .in("payment_reference", succeeded.map((intent) => intent.id));

    const linked = new Set((linkedRows ?? []).map((row) => row.payment_reference));

    const payments: UnlinkedPayment[] = succeeded
      .filter((intent) => !linked.has(intent.id))
      .map((intent) => {
        const charge = (intent.latest_charge ?? null) as Stripe.Charge | null;
        const { label, inPerson } = describeCharge(charge);
        return {
          id: intent.id,
          amount: (intent.amount_received || intent.amount || 0) / 100,
          currency: intent.currency,
          created: new Date(intent.created * 1000).toISOString(),
          description: intent.description ?? null,
          methodLabel: label,
          inPerson,
          receiptEmail: intent.receipt_email ?? null,
        };
      });

    return new Response(JSON.stringify({ payments, stripeMode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("list-unlinked-stripe-payments error:", message);
    return new Response(JSON.stringify({ error: message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
