import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK");
  if (!webhookSecret) return false;

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const secretBytes = Uint8Array.from(atob(webhookSecret.replace("whsec_", "")), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign));
  const computedSig = `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  const expectedSigs = svixSignature.split(" ");
  return expectedSigs.some((sig) => sig === computedSig);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();

    const isValid = await verifySignature(req, rawBody);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);

    const eventType: string = payload.type ?? "unknown";
    const eventId: string | undefined = payload.id ?? payload.data?.email_id;
    const messageId: string | undefined = payload.data?.email_id;
    const recipient: string | undefined =
      Array.isArray(payload.data?.to) ? payload.data.to[0] : payload.data?.to;
    const subject: string | undefined = payload.data?.subject;
    const fromAddress: string | undefined = payload.data?.from;
    const occurredAt: string | undefined = payload.created_at ?? payload.data?.created_at;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("email_events").insert({
      resend_event_id: eventId,
      message_id: messageId,
      event_type: eventType,
      recipient: recipient ?? null,
      subject: subject ?? null,
      from_address: fromAddress ?? null,
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
      payload,
    });

    if (error) {
      if (error.code === "23505") {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("resend-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
