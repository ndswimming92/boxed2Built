import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Receives webhook events from Sent (sent.dm): message delivery status,
 * inbound replies, STOP/START/HELP keywords, channel (10DLC / WhatsApp)
 * registration updates, and template reviews.
 *
 * Runs with verify_jwt = false: Sent sends no Supabase token. Every request is
 * authenticated by Sent's HMAC signature instead, using SENT_WEBHOOK_SECRET
 * (the whsec_... value from the webhook's page in the Sent dashboard).
 *
 * Signature: x-webhook-signature = "v1," + base64(HMAC-SHA256(
 *   base64decode(secret without "whsec_"),
 *   `${x-webhook-id}.${x-webhook-timestamp}.${rawBody}`))
 *
 * Every event is stored once in sent_events, keyed on x-webhook-event-id
 * (identical on each retry). contact.opt_out / contact.opt_in also update
 * sms_contact_status, ignoring signals older than the stored one.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_AGE_SECONDS = 300;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get("SENT_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[sent-webhook] SENT_WEBHOOK_SECRET is not set");
    return false;
  }

  const webhookId = req.headers.get("x-webhook-id");
  const timestamp = req.headers.get("x-webhook-timestamp");
  const signature = req.headers.get("x-webhook-signature");
  if (!webhookId || !timestamp || !signature) return false;

  // Reject stale or far-future deliveries so a captured request can't be replayed.
  // Sent signs each retry when it is sent, so retries still pass this window.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > MAX_AGE_SECONDS) return false;

  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = Uint8Array.from(atob(secret.trim().replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  } catch {
    console.error("[sent-webhook] SENT_WEBHOOK_SECRET is not valid base64 after the whsec_ prefix");
    return false;
  }

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${webhookId}.${timestamp}.${rawBody}`),
  );
  const expected = `v1,${btoa(String.fromCharCode(...new Uint8Array(mac)))}`;

  // Allow a space-separated list, as Svix-style senders do during secret rotation.
  return signature.split(" ").some((sig) => timingSafeEqual(sig.trim(), expected));
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function toIso(v: unknown): string {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    if (!(await verifySignature(req, rawBody))) return json({ error: "Invalid signature" }, 401);

    let event: Record<string, any>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const p: Record<string, any> = event.payload ?? {};
    const field = str(event.field) ?? "unknown";
    // Template events for statuses Sent has no sub-type for omit `event`.
    const eventType = str(event.event) ?? str(req.headers.get("x-webhook-event-type")) ?? field;
    const eventId =
      str(req.headers.get("x-webhook-event-id")) ?? `${eventType}:${str(p.message_id) ?? ""}:${str(event.timestamp) ?? ""}`;
    const occurredAt = toIso(event.timestamp);

    // Who's who differs by family: message.received names the customer as
    // inbound_number; outbound status events name them as outbound_number;
    // contact events use from (customer) / to (our number).
    let contactPhone: string | null = null;
    let ourNumber: string | null = null;
    let body: string | null = null;
    let status: string | null = null;

    if (field === "message" && eventType === "message.received") {
      contactPhone = str(p.inbound_number);
      ourNumber = str(p.outbound_number);
      body = str(p.text);
      status = "RECEIVED";
    } else if (field === "message") {
      contactPhone = str(p.outbound_number);
      body = str(p.body);
      status = str(p.message_status);
    } else if (field === "contact") {
      contactPhone = str(p.from);
      ourNumber = str(p.to);
      body = str(p.text);
      status = typeof p.opt_out === "boolean" ? (p.opt_out ? "OPTED_OUT" : "OPTED_IN") : null;
    } else if (field === "channel") {
      ourNumber = str(p.sender_value);
      status = str(p.status);
    } else if (field === "templates") {
      status = str(p.status);
    } else if (field === "call") {
      ourNumber = str(p.number);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: insertError } = await admin.from("sent_events").insert({
      sent_event_id: eventId,
      field,
      event_type: eventType,
      message_id: str(p.message_id),
      contact_phone: contactPhone,
      our_number: ourNumber,
      channel: str(p.channel),
      status,
      body,
      reason_code: str(p.reason_code),
      reason: str(p.reason),
      occurred_at: occurredAt,
      attempt: Number(req.headers.get("x-webhook-attempt")) || null,
      payload: event,
    });

    // 23505: already stored by an earlier attempt. Carry on rather than returning,
    // so a consent update that failed on that attempt still lands on this one
    // (the update below is idempotent).
    const duplicate = insertError?.code === "23505";
    if (insertError && !duplicate) throw insertError;

    // Keep current texting consent in sync with STOP / START.
    if ((eventType === "contact.opt_out" || eventType === "contact.opt_in") && contactPhone) {
      const { error: consentError } = await admin.rpc("apply_sms_consent_signal", {
        p_phone: contactPhone,
        p_opted_out: eventType === "contact.opt_out",
        p_event: eventType,
        p_keyword: str(p.text),
        p_signal_at: occurredAt,
      });
      if (consentError) throw consentError;
    }

    if (!duplicate && (eventType === "channel.rejected" || eventType === "channel.changes_requested")) {
      console.warn(`[sent-webhook] ${eventType} for ${str(p.channel)}: ${str(p.reason) ?? "no reason given"}`);
    }

    return json(duplicate ? { ok: true, duplicate: true } : { ok: true });
  } catch (err) {
    console.error("[sent-webhook] error:", err);
    // Non-2xx makes Sent retry with backoff.
    return json({ error: "Internal server error" }, 500);
  }
});
