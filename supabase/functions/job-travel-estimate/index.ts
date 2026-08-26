import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { authorizeAdminOrService } from "../_shared/authorize.ts";

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

// The token is a Mapbox *secret* token (sk.*), which is why every Mapbox call
// happens here rather than in the browser. Deno env lookups are case-sensitive
// and secret names get typed by hand, so the common spellings are all accepted
// rather than failing with an empty-looking map.
const MAPBOX_TOKEN =
  Deno.env.get("MapBox") ||
  Deno.env.get("MAPBOX") ||
  Deno.env.get("Mapbox") ||
  Deno.env.get("MAPBOX_SECRET_KEY") ||
  Deno.env.get("MAPBOX_ACCESS_TOKEN") ||
  Deno.env.get("MAPBOX_TOKEN");

/** Re-fetch anything older than this. Also keeps cached geocodes inside Mapbox's temporary-geocoding terms. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Mapbox rejects static image requests over ~8192 characters. */
const STATIC_URL_LIMIT = 8000;

const MAP_WIDTH = 600;
const MAP_HEIGHT = 300;

type TravelStatus = "ok" | "not_found" | "no_route" | "no_address" | "origin_not_found";

interface Coordinates {
  lng: number;
  lat: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * The cache key. Addresses are typed by hand in several places, so trim, collapse
 * runs of whitespace and lowercase before comparing — "163 Bess Blvd" and
 * "163  bess blvd " are the same trip. The stored columns hold this normalized
 * form; display text comes from the job and settings rows, not from here.
 */
function normalizeAddress(address: string | null | undefined): string | null {
  const trimmed = address?.trim().replace(/\s+/g, " ").toLowerCase();
  return trimmed ? trimmed : null;
}

/** Mirrors resolveWorkAddress() in src/utils/jobAddress.ts: a null service address means "same as the client's". */
function resolveWorkAddress(job: { client_address: string | null; service_address: string | null }): string | null {
  const service = job.service_address?.trim();
  if (service) return service;
  const client = job.client_address?.trim();
  return client ? client : null;
}

async function geocode(address: string, near: Coordinates | null): Promise<Coordinates | null> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", address);
  url.searchParams.set("country", "us");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", MAPBOX_TOKEN!);
  // Bias toward the service area so a bare "123 Main St" resolves to the Main St
  // half an hour away rather than one in another state.
  if (near) url.searchParams.set("proximity", `${near.lng},${near.lat}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mapbox geocoding failed (${response.status})`);
  }

  const body = await response.json();
  const coordinates = body?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  return { lng: Number(coordinates[0]), lat: Number(coordinates[1]) };
}

interface RouteResult {
  durationSeconds: number;
  distanceMeters: number;
  geometry: string;
}

async function fetchRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult | null> {
  const coordinatePair = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinatePair}`);
  // "simplified" keeps the encoded polyline short enough to survive as a static
  // image overlay; the full geometry is far more detail than a thumbnail shows.
  url.searchParams.set("overview", "simplified");
  url.searchParams.set("geometries", "polyline");
  url.searchParams.set("access_token", MAPBOX_TOKEN!);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mapbox directions failed (${response.status})`);
  }

  const body = await response.json();
  const route = body?.routes?.[0];
  if (!route || typeof route.duration !== "number" || typeof route.distance !== "number") {
    return null;
  }

  return {
    durationSeconds: Math.round(route.duration),
    distanceMeters: route.distance,
    geometry: typeof route.geometry === "string" ? route.geometry : "",
  };
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
): Promise<string | null> {
  // Lettered pins rather than Maki icon names: an icon name Mapbox does not
  // recognize 422s the whole request, and A/B reads like a directions app anyway.
  const originPin = `pin-s-a+334155(${origin.lng},${origin.lat})`;
  const destinationPin = `pin-s-b+059669(${destination.lng},${destination.lat})`;

  const buildUrl = (overlays: string[]) =>
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays.join(",")}` +
    `/auto/${MAP_WIDTH}x${MAP_HEIGHT}@2x?padding=40&access_token=${encodeURIComponent(MAPBOX_TOKEN!)}`;

  let url = buildUrl([originPin, destinationPin]);
  if (geometry) {
    const withPath = buildUrl([`path-4+059669-0.9(${encodeURIComponent(geometry)})`, originPin, destinationPin]);
    // An over-long route would 414 and leave the card with no map at all, so a
    // pins-only image is the fallback rather than a broken one.
    if (withPath.length <= STATIC_URL_LIMIT) url = withPath;
  }

  const response = await fetch(url);
  if (!response.ok) return null;

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  // btoa needs a binary string; chunked so a large image cannot blow the call stack.
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }

  return `data:image/png;base64,${btoa(binary)}`;
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

    if (!MAPBOX_TOKEN) {
      return json(
        {
          error:
            "Mapbox token not configured. Add the secret token to this project's " +
            "edge function secrets as MapBox (or MAPBOX_SECRET_KEY).",
        },
        500,
      );
    }

    const { jobId } = await req.json().catch(() => ({ jobId: null }));
    if (!jobId || typeof jobId !== "string") {
      return json({ error: "Missing jobId" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // The address is resolved here rather than trusted from the caller, so the
    // cache key can never be poisoned with an address the job does not have.
    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id, organization_id, client_address, service_address")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) return json({ error: "Job not found" }, 404);

    const destinationDisplay = resolveWorkAddress(job);
    const destinationKey = normalizeAddress(destinationDisplay);

    const { data: settings } = await admin
      .from("travel_settings")
      .select("id, origin_address, origin_latitude, origin_longitude")
      .eq("organization_id", job.organization_id)
      .eq("is_active", true)
      .maybeSingle();

    const originDisplay = settings?.origin_address?.trim() || null;
    const originKey = normalizeAddress(originDisplay);

    if (!destinationKey || !originKey) {
      return json({
        status: "no_address" satisfies TravelStatus,
        originAddress: originDisplay,
        destinationAddress: destinationDisplay,
        durationSeconds: null,
        distanceMeters: null,
        mapImage: null,
        cached: false,
        refreshedAt: null,
      });
    }

    const { data: cached } = await admin
      .from("job_travel_estimates")
      .select("*")
      .eq("organization_id", job.organization_id)
      .eq("origin_address", originKey)
      .eq("destination_address", destinationKey)
      .maybeSingle();

    const isFresh = cached && Date.now() - new Date(cached.refreshed_at).getTime() < CACHE_TTL_MS;

    let originCoordinates: Coordinates | null =
      settings?.origin_latitude != null && settings?.origin_longitude != null
        ? { lat: Number(settings.origin_latitude), lng: Number(settings.origin_longitude) }
        : null;

    const cachedHasCoordinates =
      cached?.destination_latitude != null && cached?.destination_longitude != null;

    // Redrawing the map needs both ends, and Number(null) is 0 — an "ok" row
    // missing coordinates would place the pin off West Africa, so treat it as a
    // miss and re-fetch rather than serving a nonsense map.
    if (cached && isFresh && originCoordinates && (cached.status !== "ok" || cachedHasCoordinates)) {
      if (cached.status !== "ok") {
        return json({
          status: cached.status as TravelStatus,
          originAddress: originDisplay,
          destinationAddress: destinationDisplay,
          durationSeconds: null,
          distanceMeters: null,
          mapImage: null,
          cached: true,
          refreshedAt: cached.refreshed_at,
        });
      }

      const mapImage = await renderStaticMap(
        originCoordinates,
        { lat: Number(cached.destination_latitude), lng: Number(cached.destination_longitude) },
        cached.route_geometry || "",
      );

      return json({
        status: "ok" satisfies TravelStatus,
        originAddress: originDisplay,
        destinationAddress: destinationDisplay,
        durationSeconds: cached.duration_seconds,
        distanceMeters: cached.distance_meters == null ? null : Number(cached.distance_meters),
        mapImage,
        cached: true,
        refreshedAt: cached.refreshed_at,
      });
    }

    // Geocoded once and written back, so the origin costs a lookup only when it changes.
    if (!originCoordinates) {
      originCoordinates = await geocode(originDisplay!, null);
      if (originCoordinates && settings?.id) {
        await admin
          .from("travel_settings")
          .update({
            origin_latitude: originCoordinates.lat,
            origin_longitude: originCoordinates.lng,
            updated_at: new Date().toISOString(),
          })
          .eq("id", settings.id);
      }
    }

    const persist = async (row: Record<string, unknown>) => {
      const payload = {
        organization_id: job.organization_id,
        origin_address: originKey,
        destination_address: destinationKey,
        refreshed_at: new Date().toISOString(),
        ...row,
      };
      // The unique index is on lower(...) expressions, which upsert cannot target,
      // so the existing row is updated by id instead.
      if (cached?.id) {
        await admin.from("job_travel_estimates").update(payload).eq("id", cached.id);
      } else {
        await admin.from("job_travel_estimates").insert(payload);
      }
    };

    // Deliberately not cached: this is the saved trip origin failing to geocode,
    // not the job's address. Writing a not_found row here would blame the
    // customer's address and would repeat for every job until the TTL expired.
    if (!originCoordinates) {
      return json({
        status: "origin_not_found" satisfies TravelStatus,
        originAddress: originDisplay,
        destinationAddress: destinationDisplay,
        durationSeconds: null,
        distanceMeters: null,
        mapImage: null,
        cached: false,
        refreshedAt: null,
      });
    }

    const destinationCoordinates = await geocode(destinationDisplay!, originCoordinates);
    if (!destinationCoordinates) {
      await persist({ status: "not_found", duration_seconds: null, distance_meters: null, route_geometry: null });
      return json({
        status: "not_found" satisfies TravelStatus,
        originAddress: originDisplay,
        destinationAddress: destinationDisplay,
        durationSeconds: null,
        distanceMeters: null,
        mapImage: null,
        cached: false,
        refreshedAt: new Date().toISOString(),
      });
    }

    const route = await fetchRoute(originCoordinates, destinationCoordinates);
    if (!route) {
      await persist({
        status: "no_route",
        destination_latitude: destinationCoordinates.lat,
        destination_longitude: destinationCoordinates.lng,
        duration_seconds: null,
        distance_meters: null,
        route_geometry: null,
      });
      return json({
        status: "no_route" satisfies TravelStatus,
        originAddress: originDisplay,
        destinationAddress: destinationDisplay,
        durationSeconds: null,
        distanceMeters: null,
        mapImage: null,
        cached: false,
        refreshedAt: new Date().toISOString(),
      });
    }

    await persist({
      status: "ok",
      destination_latitude: destinationCoordinates.lat,
      destination_longitude: destinationCoordinates.lng,
      duration_seconds: route.durationSeconds,
      distance_meters: route.distanceMeters,
      route_geometry: route.geometry,
    });

    const mapImage = await renderStaticMap(originCoordinates, destinationCoordinates, route.geometry);

    return json({
      status: "ok" satisfies TravelStatus,
      originAddress: originDisplay,
      destinationAddress: destinationDisplay,
      durationSeconds: route.durationSeconds,
      distanceMeters: route.distanceMeters,
      mapImage,
      cached: false,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("job-travel-estimate failed", error);
    return json({ error: error instanceof Error ? error.message : "Drive time lookup failed" }, 500);
  }
});
