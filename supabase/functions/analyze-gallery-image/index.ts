import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, *",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
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

    const { image, mediaType, productUrl } = await req.json();

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
      "Based off the image uploaded, create a Gallery post for my website that includes a title, description of the item, and alt text. The items are going to be furniture that people bought and had assembled by Boxed2Built in Spring Hill, TN.";

    if (productUrl) {
      textPrompt += `\n\nProduct URL: ${productUrl}\nUse web search to look up this product for additional details like brand, product name, materials, and features to create a richer description.`;
    }

    textPrompt += `\n\nRespond ONLY with valid JSON in this exact format:\n{\n  "title": "concise SEO-friendly title, max 60 chars",\n  "description": "detailed 2-3 sentence SEO description mentioning furniture type, brand if known, and assembly quality",\n  "alt": "accessibility alt text describing what is shown, max 125 chars"\n}`;

    userContent.push({ type: "text", text: textPrompt });

    const tools = productUrl
      ? [{ type: "web_search_20250305", name: "web_search" }]
      : [];

    const body: Record<string, unknown> = {
      model: "claude-opus-4-7",
      max_tokens: 4096,
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
  city — never keyword-stuff. Stay true to the photo.
- alt: max 125 characters, one plain sentence describing what is visible (item
  type + setting) for accessibility and SEO. Do not begin with "image of".

Let CATEGORY set the framing: "Completed Work" = the finished result;
"Before and After" = the transformation; "Process" = assembly in progress;
"Time-Lapse" = a start-to-finish build.

Describe only what you can see. If a product link is provided, use verified
brand/product details from the lookup, but never invent specs.

Respond with ONLY valid JSON, no markdown or backticks:
{"title": "...", "description": "...", "alt": "..."}`,
      messages: [{ role: "user", content: userContent }],
    };

    if (tools.length > 0) {
      body.tools = tools;
    }

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
      return new Response(
        JSON.stringify({
          error: `AI analysis failed (${response.status})`,
          details: errorBody,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();

    // Find the last text block (web search adds intermediate blocks before the final answer)
    const textBlocks = result.content?.filter(
      (block: { type: string }) => block.type === "text"
    );
    const lastTextBlock = textBlocks?.[textBlocks.length - 1];

    if (!lastTextBlock?.text) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let jsonText = lastTextBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(jsonText);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-gallery-image error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
