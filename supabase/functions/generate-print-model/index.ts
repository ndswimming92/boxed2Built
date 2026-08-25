import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeAdminOrService } from "../_shared/authorize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // x-correlation-id / x-session-correlation-id are added to every request by the
  // Supabase client's fetch wrapper in src/lib/supabase.ts. A preflight that does
  // not allow them is rejected by the browser before the POST is ever sent.
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Claude writes the CAD source; the browser compiles it. This prompt is the
 * whole product — it is what makes the difference between source that compiles
 * into something printable and source that compiles into something that warps
 * off the plate. It is deliberately byte-stable so `cache_control` keeps paying
 * out across every refine and repair turn.
 */
const OPENSCAD_SYSTEM_PROMPT = `You are a mechanical designer who writes OpenSCAD for FDM 3D printing.

You produce parametric CAD source. You do not produce meshes, prose, markdown, or
code fences. The \`scad_source\` field must contain OpenSCAD and nothing else.

## Hard requirements

- Millimetres throughout. Never centimetres, never inches.
- The result must be ONE manifold solid sitting on the Z=0 plane, in the +Z half
  space. Never leave geometry below the bed.
- Never use \`import()\`, \`include <...>\`, \`use <...>\`, \`surface()\`, or \`import_stl()\`.
  The compiler runs in a sandbox with an empty filesystem; any file reference is a
  hard failure.
- The only font available is "DejaVu Sans". If you use \`text()\`, you must pass
  \`font = "DejaVu Sans"\` explicitly.
- Use \`$fn\` deliberately: 64 or 96 on visible curved surfaces, 24-32 on small
  internal features like screw bores. Never set a global \`$fn\` above 128 — it
  makes compiles slow and STLs enormous for no visible gain.

## Parameters

Declare EVERY tunable dimension as a top-level assignment in a parameter block at
the very top of the file, annotated for the OpenSCAD Customizer, because those
annotations drive the slider UI:

/* [Dimensions] */
// Outside width of the body
body_width = 120;   // [40:1:250]
// Wall thickness - keep at or above 2x nozzle diameter
wall = 2.4;         // [1.2:0.2:6]

/* [Features] */
// Round the vertical corners
rounded_corners = true;

Rules: the comment ABOVE a variable is its human label; the \`[min:step:max]\`
comment AFTER it defines the slider range; \`/* [Section] */\` opens a group.
Booleans render as checkboxes. A quoted string with a \`// [a, b, c]\` comment
renders as a dropdown. Put every parameter above the first module definition, and
never reference an undeclared variable.

Derive everything else from those parameters. A model where changing one number
breaks the geometry is a failed model.

## Printability rules — these are not suggestions

- Minimum wall thickness is 2x the nozzle diameter (0.8 mm at a 0.4 mm nozzle).
  Default walls to 2.4 mm (3 perimeters) unless the user asks for thinner.
- No unsupported overhang steeper than 45 degrees from vertical. If the design
  needs one, add a chamfer instead, or state it in \`supports_required\`.
- Chamfer bottom edges (0.4-0.8 mm at 45 degrees) rather than filleting them.
  A bottom fillet is an overhang; a chamfer prints clean.
- Never bridge more than 10 mm unsupported.
- Horizontal holes above 8 mm diameter get a teardrop top, not a circle.
- Fit clearances: 0.2 mm for a press fit, 0.4 mm for a sliding fit, 0.5 mm for a
  loose/removable fit. Never model mating parts at nominal size.
- Screw clearance holes: M3 = 3.4 mm, M4 = 4.5 mm, M5 = 5.5 mm. Countersinks are
  90 degrees included angle.
- Embossed text must stand at least 0.6 mm proud with a stroke at least 1 mm wide.
  Engraved text must be at least 0.6 mm deep. Anything finer disappears at 0.4 mm
  nozzle width.
- Keep the footprint inside the stated build volume, with 5 mm of margin.

## Keep it economical

Generation is bounded by a hard timeout, so length is a correctness concern, not
a style preference. Build the simplest geometry that satisfies the request:

- Do not add features the user did not ask for. A request for a four-bay tray is
  a four-bay tray, not a tray with a rib lattice, a label slot and a lid.
- Prefer a short parametric module called in a loop over long unrolled geometry.
- Aim for under 120 lines of source. If a design genuinely cannot fit, build the
  core of it well and say what you left out in \`print_notes\`.
- Ten well-chosen parameters beat thirty exhaustive ones.

## Boolean hygiene

Every cutting tool passed to \`difference()\` must overshoot the surface it cuts by
at least 0.01 mm on both ends. Coincident coplanar faces are the single most
common cause of a non-manifold STL, and a mesh that fails to compile is worth
nothing to the user.

Model solids with \`hull()\` and \`minkowski()\` sparingly — \`minkowski()\` in
particular is extremely slow. Prefer explicit chamfer/fillet geometry.

## Output

Return the fields defined by the schema. Do NOT restate the parameters as a
separate list - they are read directly from the annotations in your source, so
repeating them only makes the response slower. \`summary\` is one sentence describing what
the object is. \`print_notes\` covers orientation, supports, and anything the user
should know before slicing. \`estimated_bbox_mm\` is your own calculation of the
bounding box at default parameter values.`;

const MODEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "summary",
    "scad_source",
    "print_notes",
    "recommended_orientation",
    "supports_required",
    "estimated_bbox_mm",
  ],
  properties: {
    name: { type: "string", description: "Short product-style name, 2-5 words." },
    summary: { type: "string", description: "One sentence describing the object." },
    scad_source: { type: "string", description: "Complete OpenSCAD source. No markdown fences." },
    print_notes: { type: "string" },
    recommended_orientation: { type: "string" },
    supports_required: { type: "boolean" },
    estimated_bbox_mm: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y", "z"],
      properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } },
    },
  },
} as const;

/**
 * Supabase terminates the worker at 150s of wall clock with a bare 546 and no
 * response body. Stopping short of that lets the admin see a real explanation
 * instead of a dead connection.
 */
const DEADLINE_MS = 130_000;

interface ClaudeResult {
  text: string;
  stopReason: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

/**
 * Assembles a streamed Claude response. Streaming is not decoration here: a
 * non-streaming call for a whole CAD program routinely ran past the worker's
 * wall clock, and streaming also lets the deadline above abort cleanly.
 */
async function readClaudeStream(response: Response): Promise<ClaudeResult> {
  const body = response.body;
  if (!body) throw new Error("Claude returned an empty stream");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const result: ClaudeResult = {
    text: "",
    stopReason: null,
    model: "claude-opus-5",
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are newline delimited; keep the trailing partial line.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;

      let event: Record<string, unknown> & {
        type?: string;
        message?: { model?: string; usage?: Record<string, number> };
        delta?: { type?: string; text?: string; stop_reason?: string };
        usage?: Record<string, number>;
        error?: { message?: string };
      };
      try {
        event = JSON.parse(raw);
      } catch {
        continue;
      }

      if (event.type === "message_start") {
        result.model = event.message?.model ?? result.model;
        result.inputTokens = event.message?.usage?.input_tokens ?? 0;
        result.cacheReadTokens = event.message?.usage?.cache_read_input_tokens ?? 0;
      } else if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta"
      ) {
        result.text += event.delta.text;
      } else if (event.type === "message_delta") {
        result.outputTokens = event.usage?.output_tokens ?? result.outputTokens;
        result.stopReason = event.delta?.stop_reason ?? result.stopReason;
      } else if (event.type === "error") {
        throw new Error(event.error?.message ?? "Claude stream error");
      }
    }
  }

  return result;
}

interface Payload {
  mode?: "create" | "refine" | "repair";
  prompt?: string;
  scadSource?: string;
  compileError?: string;
  printProfile?: {
    printer?: string;
    bedX?: number;
    bedY?: number;
    bedZ?: number;
    nozzleMm?: number;
    layerHeightMm?: number;
    material?: string;
    supportsAllowed?: boolean;
  };
}

function buildUserMessage(body: Payload): string {
  const p = body.printProfile ?? {};
  const constraints = [
    `Printer: ${p.printer ?? "Bambu Lab P2S"}`,
    `Build volume: ${p.bedX ?? 256} x ${p.bedY ?? 256} x ${p.bedZ ?? 256} mm`,
    `Nozzle: ${p.nozzleMm ?? 0.4} mm`,
    `Layer height: ${p.layerHeightMm ?? 0.2} mm`,
    `Material: ${p.material ?? "PLA"}`,
    `Supports allowed: ${p.supportsAllowed ? "yes" : "no - design to print support-free"}`,
  ].join("\n");

  if (body.mode === "repair") {
    return `The OpenSCAD source below failed to compile. Fix it.

Return the COMPLETE corrected source, not a patch or a description of the change.
Keep the original design intent and every parameter name that still applies.

--- compiler output ---
${body.compileError ?? "(no compiler output captured)"}

--- source that failed ---
${body.scadSource ?? ""}

--- constraints ---
${constraints}`;
  }

  if (body.mode === "refine") {
    return `Revise the OpenSCAD model below.

Change requested: ${body.prompt ?? ""}

Return the COMPLETE revised source. Preserve parameter names that still apply so
saved slider values keep working, and keep everything the user did not ask you to
change.

--- current source ---
${body.scadSource ?? ""}

--- constraints ---
${constraints}`;
  }

  return `Design this for 3D printing:

${body.prompt ?? ""}

--- constraints ---
${constraints}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  // Generating a model costs real money on every call, so this is restricted to
  // signed-in platform admins. The published anon key is itself a valid JWT, so
  // the bearer token must be resolved to a real user rather than merely present.
  const auth = await authorizeAdminOrService(req);
  if (!auth.ok) {
    return json({ success: false, error: auth.error }, auth.status ?? 401);
  }

  const apiKey =
    Deno.env.get("Claude_Print_Model_Studio") ??
    Deno.env.get("Claude_Gallery_Image_Creation");
  if (!apiKey) {
    return json({ success: false, error: "API key not configured" }, 500);
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const mode = body.mode ?? "create";
  if (mode === "create" && !body.prompt?.trim()) {
    return json({ success: false, error: "A prompt is required" }, 400);
  }
  if ((mode === "refine" || mode === "repair") && !body.scadSource?.trim()) {
    return json({ success: false, error: "scadSource is required to refine or repair" }, 400);
  }
  if (mode === "refine" && !body.prompt?.trim()) {
    return json({ success: false, error: "A change request is required to refine" }, 400);
  }

  const requestBody = (useSchema: boolean) => ({
    model: "claude-opus-5",
    // Do not use this as a latency control. It is a guillotine, not a budget:
    // an 8k ceiling cut a response off mid-string after paying for every token,
    // and the JSON was then unparseable. Runtime is bounded by DEADLINE_MS; the
    // prompt keeps output small.
    max_tokens: 16000,
    stream: true,
    system: [
      {
        type: "text",
        text: OPENSCAD_SYSTEM_PROMPT,
        // The prompt is long and never changes, so caching it pays for itself
        // across the refine and repair turns that follow every generation.
        cache_control: { type: "ephemeral" },
      },
    ],
    thinking: { type: "adaptive" },
    // "high" pushed a single generation past 150s and the worker was killed
    // mid-flight. "medium" comfortably fits the budget, and the compile-repair
    // loop below is the real guard on geometry correctness.
    output_config: useSchema
      ? { effort: "medium", format: { type: "json_schema", schema: MODEL_SCHEMA } }
      : { effort: "medium" },
    messages: [{ role: "user", content: buildUserMessage(body) }],
  });

  const startedAt = Date.now();
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), DEADLINE_MS);

  const callClaude = (useSchema: boolean) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody(useSchema)),
      signal: controller.signal,
    });

  try {
    let response = await callClaude(true);

    // Structured output can be rejected for reasons unrelated to the payload;
    // retry once plainly rather than failing the admin's generation outright.
    if (response.status === 400) {
      const errorBody = await response.text();
      if (/output_config|json_schema|format|schema/i.test(errorBody)) {
        console.warn("Structured output rejected, retrying without a schema:", errorBody.slice(0, 300));
        response = await callClaude(false);
      } else {
        console.error("Claude request failed:", errorBody.slice(0, 500));
        return json({ success: false, error: "Model generation failed" }, 502);
      }
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Claude responded ${response.status}:`, errorBody.slice(0, 500));
      return json(
        { success: false, error: `Model generation failed (${response.status})` },
        502,
      );
    }

    const claude = await readClaudeStream(response);
    const raw = claude.text;
    // Timing is logged on every call because the failure mode this endpoint
    // actually hits is the worker's wall clock, not a bad response.
    console.log(
      `generate-print-model: mode=${mode} ${Date.now() - startedAt}ms in=${claude.inputTokens} out=${claude.outputTokens} cached=${claude.cacheReadTokens} stop=${claude.stopReason}`,
    );

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Without the schema Claude may wrap the object in a fence or add a
      // sentence around it; recover the outermost object rather than giving up.
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const candidate = fenced?.[1] ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      try {
        parsed = JSON.parse(candidate);
      } catch {
        parsed = null;
      }
    }

    // A truncated response is a length problem, not a bad model - saying so
    // points at the fix instead of implying the generation was nonsense.
    if (claude.stopReason === "max_tokens") {
      console.error(`generate-print-model truncated at ${claude.outputTokens} output tokens`);
      return json(
        {
          success: false,
          error:
            "The design grew too large to finish in one pass. Ask for something more focused - fewer features, or one part rather than an assembly.",
        },
        502,
      );
    }

    if (!parsed || typeof parsed.scad_source !== "string" || !parsed.scad_source.trim()) {
      console.error("Could not extract model source from response:", raw.slice(0, 400));
      return json({ success: false, error: "Model did not return usable CAD source" }, 502);
    }

    // Claude is told not to fence the source, but a stray fence would be a
    // compile error rather than a warning, so strip one if it slipped through.
    const source = String(parsed.scad_source)
      .replace(/^\s*```(?:openscad|scad)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    return json({
      success: true,
      model: {
        name: parsed.name ?? "Untitled model",
        summary: parsed.summary ?? "",
        scadSource: source,
        printNotes: parsed.print_notes ?? "",
        recommendedOrientation: parsed.recommended_orientation ?? "",
        supportsRequired: parsed.supports_required === true,
        estimatedBboxMm: parsed.estimated_bbox_mm ?? null,
      },
      usage: {
        claudeModel: claude.model,
        inputTokens: claude.inputTokens,
        outputTokens: claude.outputTokens,
        cacheReadTokens: claude.cacheReadTokens,
      },
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      console.error(
        `generate-print-model exceeded its deadline after ${Date.now() - startedAt}ms`,
      );
      return json(
        {
          success: false,
          error:
            "The model took too long to generate and was stopped. Try a simpler or more specific description - very open-ended prompts take the longest.",
        },
        504,
      );
    }
    console.error("generate-print-model failed:", error);
    return json({ success: false, error: "Model generation failed" }, 500);
  } finally {
    clearTimeout(deadline);
  }
});
