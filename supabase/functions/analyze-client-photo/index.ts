import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  // x-correlation-id / x-session-correlation-id are added to every request by the
  // Supabase client's fetch wrapper in src/lib/supabase.ts. Callers that reach this
  // function through supabase.functions.invoke() send them, and a preflight that
  // does not allow them is rejected by the browser before the POST is ever sent.
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// The extracted shape is pinned with a JSON schema so the model can't drift into
// prose, markdown fences, or renamed keys. Every field is required and nullable:
// "required" makes the model consider each one, null is how it says "not in the
// photo" instead of inventing a value.
const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: ["string", "null"],
      description: "Full name of the person or business, as written.",
    },
    email: {
      type: ["string", "null"],
      description: "Email address, lowercase, no surrounding text.",
    },
    phone: {
      type: ["string", "null"],
      description: "Phone number with digits only, e.g. 6155551234.",
    },
    address: {
      type: ["string", "null"],
      description: "Street address on one line: street, city, state ZIP.",
    },
    source: {
      type: ["string", "null"],
      description:
        "How this client found the business, only if the photo says so " +
        "(Facebook, Instagram, Website, Family, Friend, Google, Yelp, Referral).",
    },
    notes: {
      type: ["string", "null"],
      description:
        "Anything else worth keeping: the work requested, items to assemble, " +
        "dates, access instructions. One or two short sentences, or null.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "How legible the photo was overall.",
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description:
        "Short notes about anything ambiguous or partially unreadable, so the " +
        "admin knows which fields to double-check. Empty when everything was clear.",
    },
  },
  required: ["name", "email", "phone", "address", "source", "notes", "confidence", "warnings"],
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  `You read a photo an admin took and pull out the contact details for a new
client record in Boxed2Built's admin portal. Boxed2Built is a furniture assembly
and TV-mounting service in Spring Hill, TN.

The photo could be a business card, a handwritten note, a whiteboard, a work
order, a printed invoice, a screenshot of a text message or email, or a phone
contact card. Read whatever is there.

Rules:
- Transcribe only what is actually legible in the image. Never guess, complete,
  or invent a value — if a field is not in the photo, return null for it.
- Return the client's details, not Boxed2Built's own. If the photo is a
  Boxed2Built invoice or work order, the client is the "bill to" / customer, not
  the business issuing it.
- name: the person's full name as written. If only a business name is present,
  use the business name.
- email: lowercase, no "mailto:" and no trailing punctuation.
- phone: digits only, no spaces, dashes, parentheses, or country code for US
  numbers (6155551234, not +1 (615) 555-1234).
- address: one line, "street, city, state ZIP" where those parts are present.
- source: only when the photo explicitly says how they found the business.
  Otherwise null.
- notes: a short summary of any job details, requests, or scheduling info in the
  photo. Do not repeat the contact fields here. Null when there is nothing else.
- warnings: flag partially readable digits, ambiguous handwriting, two possible
  readings, or more than one person appearing in the photo. Keep each under 15
  words. Return an empty array when the photo was clean.

Set confidence to low when the photo is blurry, badly cropped, or mostly
handwriting you had to work at; medium when some fields were a struggle; high
only when everything you returned was plainly legible.

Respond with ONLY the JSON object, no prose and no markdown fences:
{"name": ..., "email": ..., "phone": ..., "address": ..., "source": ...,
 "notes": ..., "confidence": "high" | "medium" | "low", "warnings": [...]}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // This endpoint spends money on every call, so it is restricted to signed-in
    // platform admins. The published anon key is a valid JWT, so it must be
    // resolved to a real user rather than merely being present.
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!bearer) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appMeta = (userData.user.app_metadata || {}) as Record<string, unknown>;
    if (appMeta.is_platform_admin !== true && appMeta.is_platform_admin !== "true") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Falls back to the gallery key so this function works on projects that
    // haven't set a dedicated secret for it yet.
    const apiKey =
      Deno.env.get("Claude_Client_Photo_Import") ||
      Deno.env.get("Claude_Gallery_Image_Creation");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { image, mediaType, hint } = await req.json();

    if (!image || !mediaType) {
      return new Response(JSON.stringify({ error: "Missing image or mediaType" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let textPrompt = "Pull the client's contact details out of this photo.";
    if (hint && typeof hint === "string" && hint.trim()) {
      textPrompt +=
        `\n\nContext from the admin (use it to interpret the photo, but never as ` +
        `a substitute for what is actually written there):\n` +
        `"${hint.trim().slice(0, 500)}"`;
    }

    const requestBody = (useSchema: boolean) => ({
      model: "claude-opus-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      // Transcription is a shallow task — low effort keeps the admin's wait short
      // without costing accuracy.
      output_config: useSchema
        ? { effort: "low", format: { type: "json_schema", schema: EXTRACTION_SCHEMA } }
        : { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: image },
            },
            { type: "text", text: textPrompt },
          ],
        },
      ],
    });

    const callClaude = (useSchema: boolean) =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(requestBody(useSchema)),
      });

    let response = await callClaude(true);

    // The schema pins the response shape, but if this account's API rejects the
    // structured-output field the extraction still works from the system prompt
    // alone — retry once plainly rather than failing the admin's scan.
    if (response.status === 400) {
      const errorBody = await response.text();
      if (/output_config|json_schema|format|schema/i.test(errorBody)) {
        console.warn("Structured output rejected, retrying without a schema:", errorBody.slice(0, 300));
        response = await callClaude(false);
      } else {
        console.error("Claude API error:", response.status, errorBody);
        return new Response(
          JSON.stringify({
            error: "Photo scan failed (400)",
            details: errorBody.slice(0, 500),
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Claude API error:", response.status, errorBody);
      return new Response(
        JSON.stringify({
          error: `Photo scan failed (${response.status})`,
          details: errorBody.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await response.json();

    if (result.stop_reason === "refusal") {
      return new Response(
        JSON.stringify({
          error: "The photo could not be processed. Enter the client's details manually.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Thinking blocks come first on this model, so take the last text block.
    const textBlocks = (result.content || []).filter(
      (block: { type: string }) => block.type === "text",
    );
    const lastTextBlock = textBlocks[textBlocks.length - 1];

    if (!lastTextBlock?.text) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Schema-constrained responses are bare JSON; the fallback path can arrive
    // fenced or with a sentence in front of it, so pull out the object either way.
    let jsonText = lastTextBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const objStart = jsonText.indexOf("{");
    const objEnd = jsonText.lastIndexOf("}");
    if (objStart !== -1 && objEnd > objStart) {
      jsonText = jsonText.slice(objStart, objEnd + 1);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch (_parseErr) {
      console.error("Failed to parse AI response as JSON:", lastTextBlock.text.slice(0, 500));
      return new Response(
        JSON.stringify({
          error: "AI returned an unexpected format. Please try again.",
          details: lastTextBlock.text.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const asText = (value: unknown): string | null => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };

    return new Response(
      JSON.stringify({
        name: asText(parsed.name),
        email: asText(parsed.email)?.toLowerCase() ?? null,
        phone: asText(parsed.phone),
        address: asText(parsed.address),
        source: asText(parsed.source),
        notes: asText(parsed.notes),
        confidence: ["high", "medium", "low"].includes(parsed.confidence as string)
          ? parsed.confidence
          : "low",
        warnings: Array.isArray(parsed.warnings)
          ? (parsed.warnings as unknown[]).filter((w): w is string => typeof w === "string")
          : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("analyze-client-photo error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
