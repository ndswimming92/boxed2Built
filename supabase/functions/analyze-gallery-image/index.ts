import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { image, mediaType } = await req.json();

    if (!image || !mediaType) {
      return new Response(
        JSON.stringify({ error: "Missing image or mediaType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: image,
                },
              },
              {
                type: "text",
                text: `You are analyzing an image for a furniture assembly business called Boxed2Built. They assemble flat-pack furniture (IKEA, Wayfair, Amazon, etc.) for customers in the Spring Hill, TN area.

Analyze this image and provide:
1. A concise, SEO-friendly title (max 60 chars) describing the assembled furniture or work shown
2. A detailed description (2-3 sentences) suitable for SEO that mentions the type of furniture, brand if identifiable, and quality of assembly
3. Alt text (max 125 chars) for accessibility that describes what is visually shown

Respond ONLY with valid JSON in this exact format:
{
  "title": "...",
  "description": "...",
  "alt": "..."
}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Claude API error:", response.status, errorBody);
      return new Response(
        JSON.stringify({ error: `AI analysis failed (${response.status})`, details: errorBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const textContent = result.content?.find(
      (block: { type: string }) => block.type === "text"
    );

    if (!textContent?.text) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(jsonText);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-gallery-image error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
