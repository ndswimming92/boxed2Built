import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Every outbound send in this codebase sets this as reply_to, so it's the
// address customer replies actually land on. team@boxed2built.com itself
// cannot receive mail — it hard-bounces, because the root domain's real MX
// is Google Workspace, not Resend. This lives on reply.boxed2built.com, a
// dedicated receiving-only subdomain, so it doesn't fight Workspace for the
// root domain's mail. Forward mail addressed here.
const TEAM_INBOX = "replies@reply.boxed2built.com";
// Where forwarded replies actually get read. Also excluded as a forward
// source below, so a forwarded copy can never trigger forwarding itself.
const FORWARD_TO = "nicholas.davidson@boxed2built.com";

function includesAddress(list: unknown, address: string): boolean {
  if (!Array.isArray(list)) return false;
  const target = address.toLowerCase();
  return list.some((entry) => typeof entry === "string" && entry.toLowerCase() === target);
}

interface ReceivedEmail {
  from: string;
  subject: string;
  text: string | null;
  html: string | null;
  attachments: { filename: string | null }[];
}

async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Resend receiving fetch failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function forwardReceivedEmail(received: ReceivedEmail, emailId: string): Promise<{ id: string }> {
  const subject = received.subject?.toLowerCase().startsWith("fwd:")
    ? received.subject
    : `Fwd: ${received.subject || "(no subject)"}`;

  const attachmentNote = received.attachments?.length
    ? `\n\n(${received.attachments.length} attachment${received.attachments.length === 1 ? "" : "s"} on the original message — view it in the Resend dashboard to download.)`
    : "";

  const header = `———— Forwarded message ————\nFrom: ${received.from}\nTo: ${TEAM_INBOX}\nSubject: ${received.subject || "(no subject)"}\n\n`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `fwd-${emailId}`,
    },
    body: JSON.stringify({
      from: `Boxed2Built <${TEAM_INBOX}>`,
      to: [FORWARD_TO],
      subject,
      text: `${header}${received.text || ""}${attachmentNote}`,
      ...(received.html
        ? { html: `<p style="color:#888;font-size:12px">Forwarded message from ${received.from}</p>${received.html}` }
        : {}),
      reply_to: received.from,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend forward send failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

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

    const emailId: string | undefined = payload.data?.email_id;
    const isForLoopTarget =
      includesAddress(payload.data?.to, FORWARD_TO) || includesAddress(payload.data?.received_for, FORWARD_TO);
    const isForTeamInbox =
      includesAddress(payload.data?.to, TEAM_INBOX) || includesAddress(payload.data?.received_for, TEAM_INBOX);

    if (eventType === "email.received" && emailId && isForTeamInbox && !isForLoopTarget) {
      try {
        const received = await fetchReceivedEmail(emailId);
        const forwarded = await forwardReceivedEmail(received, emailId);

        await supabase.from("email_events").insert({
          resend_event_id: `fwd-${emailId}`,
          message_id: forwarded.id,
          event_type: "email.forwarded",
          recipient: FORWARD_TO,
          subject: received.subject ?? null,
          from_address: received.from ?? null,
          occurred_at: new Date().toISOString(),
          payload: { forwarded_from_email_id: emailId },
        });
      } catch (forwardErr) {
        console.error("resend-webhook forward error:", forwardErr);
      }
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
