import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { authorizeAdminOrService } from "../_shared/authorize.ts";
import { formatLeaveByLabel } from "../_shared/scheduleLabels.ts";
import {
  computeLeaveBy,
  getMapboxToken,
  mapboxFailure,
  resolveTravelEstimate,
  resolveWorkAddress,
  type Coordinates,
  type LeaveBy,
} from "../_shared/travel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  // x-correlation-id / x-session-correlation-id are added to every request by the
  // Supabase client's fetch wrapper in src/lib/supabase.ts. A preflight that does
  // not allow them is rejected by the browser before the POST is ever sent.
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Correlation-Id, X-Session-Correlation-Id",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Mapbox rejects static image requests over ~8192 characters. */
const STATIC_URL_LIMIT = 8000;

// 3:2, matching the card's aspect-[3/2] container so nothing is cropped or
// letterboxed. Rendered at @2x (1200x800) for retina; Mapbox caps static images
// at 1280x1280, so this is near the usable ceiling.
const MAP_WIDTH = 600;
const MAP_HEIGHT = 400;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Renders the route as a PNG and returns it as a data URI. The browser gets a
 * finished image because an <img> tag cannot send an Authorization header, so
 * any URL it could load directly would have to be public — and this one carries
 * the secret token.
 */
async function renderStaticMap(
  origin: Coordinates,
  destination: Coordinates,
  geometry: string,
  token: string,
): Promise<string | null> {
  // Lettered pins rather than Maki icon names: an icon name Mapbox does not
  // recognize 422s the whole request, and A/B reads like a directions app anyway.
  const originPin = `pin-s-a+334155(${origin.lng},${origin.lat})`;
  const destinationPin = `pin-s-b+059669(${destination.lng},${destination.lat})`;

  const buildUrl = (overlays: string[]) =>
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays.join(",")}` +
    `/auto/${MAP_WIDTH}x${MAP_HEIGHT}@2x?padding=50&access_token=${encodeURIComponent(token)}`;

  let url = buildUrl([originPin, destinationPin]);
  if (geometry) {
    const withPath = buildUrl([`path-4+059669-0.9(${encodeURIComponent(geometry)})`, originPin, destinationPin]);
    // An over-long route would 414 and leave the card with no map at all, so a
    // pins-only image is the fallback rather than a broken one.
    if (withPath.length <= STATIC_URL_LIMIT) url = withPath;
  }

  const response = await fetch(url);
  if (!response.ok) {
    console.error((await mapboxFailure(response, "static map")).message);
    return null;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  // btoa needs a binary string; chunked so a large image cannot blow the call stack.
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }

  return `data:image/png;base64,${btoa(binary)}`;
}

/** The leave-by, plus the one-line rendering of it the card shows. */
function serializeLeaveBy(leaveBy: LeaveBy | null) {
  if (!leaveBy) return null;
  return { ...leaveBy, label: formatLeaveByLabel(leaveBy) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Every miss on this endpoint spends Mapbox quota, so it is admins only. The
    // published anon key is itself a valid JWT and proves nothing on its own.
    const auth = await authorizeAdminOrService(req);
    if (!auth.ok) {
      return json({ error: auth.error || "Unauthorized" }, auth.status || 401);
    }

    const token = getMapboxToken();
    if (!token) {
      return json(
        {
          error:
            "Mapbox token not configured. Add the secret token to this project's " +
            "edge function secrets as MapBox (or MAPBOX_SECRET_KEY).",
        },
        500,
      );
    }

    // A booking is the same question asked of a different row: where is the work,
    // when does it start, and how far is it from home base. Only the lookup
    // differs — the cache is keyed on the address pair, so both kinds share one
    // cached result for the same destination.
    const { jobId, bookingId } = await req.json().catch(() => ({
      jobId: null,
      bookingId: null,
    }));

    const hasJobId = typeof jobId === "string" && jobId.length > 0;
    const hasBookingId = typeof bookingId === "string" && bookingId.length > 0;

    if (!hasJobId && !hasBookingId) {
      return json({ error: "Missing jobId or bookingId" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // The address is resolved here rather than trusted from the caller, so the
    // cache key can never be poisoned with an address the row does not have.
    let organizationId: string | null = null;
    let destinationDisplay: string | null = null;
    let startTime: string | null = null;

    if (hasJobId) {
      const { data: job, error: jobError } = await admin
        .from("jobs")
        .select("id, organization_id, client_address, service_address, scheduled_start_time")
        .eq("id", jobId)
        .maybeSingle();

      if (jobError) throw jobError;
      if (!job) return json({ error: "Job not found" }, 404);

      organizationId = job.organization_id;
      destinationDisplay = resolveWorkAddress(job);
      startTime = job.scheduled_start_time;
    } else {
      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .select("id, organization_id, service_address, start_time")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingError) throw bookingError;
      if (!booking) return json({ error: "Booking not found" }, 404);

      organizationId = booking.organization_id;
      // A booking has one address, the one the customer typed, so there is no
      // client-profile fallback to consider.
      destinationDisplay = resolveWorkAddress({
        service_address: booking.service_address,
        client_address: null,
      });
      startTime = booking.start_time;
    }

    if (!organizationId) {
      return json({ error: "That record has no organization" }, 404);
    }

    const estimate = await resolveTravelEstimate(admin, organizationId, destinationDisplay, {
      // The card is opened by hand, one row at a time, so a miss here is exactly
      // when a fresh Mapbox call is worth paying for.
      allowLookup: true,
    });

    const mapImage =
      estimate.status === "ok" && estimate.originCoordinates && estimate.destinationCoordinates
        ? await renderStaticMap(
            estimate.originCoordinates,
            estimate.destinationCoordinates,
            estimate.routeGeometry,
            token,
          )
        : null;

    return json({
      status: estimate.status,
      originAddress: estimate.originAddress,
      destinationAddress: estimate.destinationAddress,
      durationSeconds: estimate.durationSeconds,
      distanceMeters: estimate.distanceMeters,
      departureBufferMinutes: estimate.bufferMinutes,
      // Null whenever the row has no start hour to count back from — the card
      // shows the drive time on its own in that case.
      leaveBy: serializeLeaveBy(
        estimate.status === "ok"
          ? computeLeaveBy(startTime, estimate.durationSeconds, estimate.bufferMinutes)
          : null,
      ),
      mapImage,
      cached: estimate.cached,
      refreshedAt: estimate.refreshedAt,
    });
  } catch (error) {
    console.error("job-travel-estimate failed", error);
    return json({ error: error instanceof Error ? error.message : "Drive time lookup failed" }, 500);
  }
});
