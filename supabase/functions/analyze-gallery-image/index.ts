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

    const apiKey = Deno.env.get("Claude_Gallery_Image_Creation");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { image, mediaType, productUrl, location, category, customPrompt } = await req.json();

    if (!image || !mediaType) {
      return new Response(
        JSON.stringify({ error: "Missing image or mediaType" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userContent: unknown[] = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: image,
        },
      },
    ];

    let textPrompt =
  `City: ${location || "Spring Hill, TN"}\n` +
  `Category: ${category || "Completed Work"}\n`;

if (productUrl) {
  textPrompt +=
    `Product link: ${productUrl}\n` +
    `Use web search to confirm the brand, product name, materials, and notable ` +
    `features, then fold accurate details into the description.\n`;
}

if (customPrompt && typeof customPrompt === "string" && customPrompt.trim()) {
  textPrompt +=
    `\nAdmin notes for this photo (use as guidance, but stay true to what's ` +
    `actually visible and keep following the format/voice rules above):\n` +
    `"${customPrompt.trim().slice(0, 1000)}"\n`;
}

textPrompt +=
  `\nBased on the photo, write the gallery entry now. Respond with ONLY the ` +
  `JSON object described in the system prompt.`;

    userContent.push({ type: "text", text: textPrompt });

    const tools = productUrl
      ? [{ type: "web_search_20250305", name: "web_search" }]
      : [];

    const body: Record<string, unknown> = {
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        `You write gallery captions for Boxed2Built, a labor-only furniture assembly and
TV/wall-mounting service based in Spring Hill, TN, serving Franklin, Brentwood,
Thompson's Station, Nolensville, and Columbia. Boxed2Built does NOT sell
furniture — customers buy their own pieces (IKEA, Wayfair, Amazon, Target, and
similar) and Boxed2Built provides the labor to assemble or mount them. Never
imply the company sold the item; always frame it as assembled or mounted by
Boxed2Built.

Voice: a dependable neighbor who takes pride in their work — friendly, honest,
family-focused, professional. No hype or salesy language. NEVER use emojis.

You are given a photo of a finished job, the job's CITY and CATEGORY, and
sometimes a product link to look up. Write an SEO-friendly gallery entry:

- title: max 60 characters. Name the item plainly and include the city
  (e.g. "IKEA Hemnes Dresser Assembly in Franklin"). No period at the end.
- description: 2-3 sentences. Say what was assembled or mounted and the comfort
  or time it gave the family. Work in ONE natural local keyword (furniture
  assembly, TV mounting, IKEA assembly, nursery setup, patio furniture) plus the
  city — never keyword-stuff. Mention "Boxed2Built" by name once, naturally
  (e.g. "assembled by Boxed2Built"), for brand SEO. Stay true to the photo.
- alt: max 125 characters, one plain sentence describing what is visible (item
  type + setting) for accessibility and SEO. Do not begin with "image of".
- hashtags: 5-8 relevant hashtags for posting this photo to Facebook and
  Instagram, each starting with "#" and using PascalCase for multi-word tags
  (e.g. "#FurnitureAssembly"). Always include "#Boxed2Built" as one of them.
  Mix: the specific item/brand if identifiable, the service type (furniture
  assembly, TV mounting, IKEA assembly, nursery setup, patio furniture, etc.),
  and the city. Avoid generic filler tags and never repeat the same concept
  twice.

Let CATEGORY set the framing: "Completed Work" = the finished result;
"Before and After" = the transformation; "Process" = assembly in progress;
"Time-Lapse" = a start-to-finish build.

Describe only what you can see. If a product link is provided, use verified
brand/product details from the lookup, but never invent specs.

Never use a literal straight double-quote character (") anywhere in title,
description, or alt — not for inches, not for quoting a phrase. Spell inches
out instead (e.g. "72-inch" not 72"). An unescaped quote breaks the JSON
output below.

Respond with ONLY valid JSON, no markdown or backticks:
{"title": "...", "description": "...", "alt": "...", "hashtags": ["...", "..."]}`,
      messages: [{ role: "user", content: userContent }],
    };

    if (tools.length > 0) {
      body.tools = tools;
    }

    const maxAttempts = 2;
    let lastError: { status: number; message: string; details?: string } | null = null;
    let parsed: Record<string, unknown> | null = null;

    for (let attempt = 0; attempt < maxAttempts && !parsed; attempt++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Claude API error:", response.status, errorBody);
        lastError = { status: 502, message: `AI analysis failed (${response.status})`, details: errorBody };
        continue;
      }

      const result = await response.json();

      // Find the last text block (web search adds intermediate blocks before the final answer)
      const textBlocks = result.content?.filter(
        (block: { type: string }) => block.type === "text"
      );
      const lastTextBlock = textBlocks?.[textBlocks.length - 1];

      if (!lastTextBlock?.text) {
        lastError = { status: 502, message: "No response from AI" };
        continue;
      }

      let jsonText = lastTextBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/^```(?:json)?\s*/, "")
          .replace(/\s*```$/, "");
      }
      // The model occasionally wraps the JSON in a sentence or two. Extract the
      // object so a stray preamble doesn't blow up JSON.parse.
      const objStart = jsonText.indexOf("{");
      const objEnd = jsonText.lastIndexOf("}");
      if (objStart !== -1 && objEnd > objStart) {
        jsonText = jsonText.slice(objStart, objEnd + 1);
      }

      try {
        parsed = JSON.parse(jsonText);
      } catch (_parseErr) {
        console.error(`Failed to parse AI response as JSON (attempt ${attempt + 1}):`, lastTextBlock.text);
        lastError = {
          status: 502,
          message: "AI returned an unexpected format. Please try again.",
          details: lastTextBlock.text.slice(0, 500),
        };
      }
    }

    if (!parsed) {
      return new Response(
        JSON.stringify({ error: lastError!.message, details: lastError!.details }),
        {
          status: lastError!.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const hashtags: string[] = Array.isArray(parsed.hashtags) ? parsed.hashtags as string[] : [];
    const hasRequiredTag = hashtags.some(
      (tag: string) => typeof tag === "string" && tag.toLowerCase() === "#boxed2built"
    );
    if (!hasRequiredTag) {
      hashtags.push("#Boxed2Built");
    }
    parsed.hashtags = hashtags;

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-gallery-image error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
