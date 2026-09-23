/**
 * Drive times, and the leave-by time they exist to produce.
 *
 * Three callers need the same answer from different angles: the admin card asks
 * live and wants a map with it, the schedule email asks once and may pay for a
 * fresh Mapbox call, and the subscribed calendar feed is polled hourly by every
 * calendar app and must never call Mapbox at all. They share this module so a
 * "45 min" on the card and a "leave by 10:45 AM" in the invite can never be
 * computed two different ways.
 *
 * Everything here works in the job's own wall clock. Job times are stored as
 * bare local times against the business timezone, and a leave-by is just that
 * clock read backwards, so no zone conversion is needed or wanted: subtracting
 * minutes from 11:30 gives the time to walk out the door, whatever zone the
 * person reading it happens to be in.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { normalizeScheduleTime } from './scheduleLabels.ts';

/** Re-fetch anything older than this. Also keeps cached geocodes inside Mapbox's temporary-geocoding terms. */
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Used when an organization has no travel_settings row of its own. */
export const DEFAULT_DEPARTURE_BUFFER_MINUTES = 15;

/** Matches the CHECK on travel_settings.departure_buffer_minutes. */
export const MAX_DEPARTURE_BUFFER_MINUTES = 240;

/**
 * `not_cached` never reaches the browser: only a cache-only caller (the calendar
 * feed) can produce it, and it means "no answer on hand", not "bad address".
 */
export type TravelStatus =
  | 'ok'
  | 'not_found'
  | 'no_route'
  | 'no_address'
  | 'origin_not_found'
  | 'not_cached';

export interface Coordinates {
  lng: number;
  lat: number;
}

/**
 * The token is a Mapbox *secret* token (sk.*), which is why every Mapbox call
 * happens server-side. Deno env lookups are case-sensitive and secret names get
 * typed by hand, so the common spellings are all accepted rather than failing
 * with an empty-looking map.
 */
export function getMapboxToken(): string | undefined {
  return (
    Deno.env.get('MapBox') ||
    Deno.env.get('MAPBOX') ||
    Deno.env.get('Mapbox') ||
    Deno.env.get('MAPBOX_SECRET_KEY') ||
    Deno.env.get('MAPBOX_ACCESS_TOKEN') ||
    Deno.env.get('MAPBOX_TOKEN')
  );
}

/**
 * The cache key. Addresses are typed by hand in several places, so trim, collapse
 * runs of whitespace and lowercase before comparing — "163 Bess Blvd" and
 * "163  bess blvd " are the same trip. The stored columns hold this normalized
 * form; display text comes from the job and settings rows, not from here.
 */
export function normalizeAddress(address: string | null | undefined): string | null {
  const trimmed = address?.trim().replace(/\s+/g, ' ').toLowerCase();
  return trimmed ? trimmed : null;
}

/** Mirrors resolveWorkAddress() in src/utils/jobAddress.ts: a null service address means "same as the client's". */
export function resolveWorkAddress(job: {
  client_address?: string | null;
  service_address?: string | null;
}): string | null {
  const service = job.service_address?.trim();
  if (service) return service;
  const client = job.client_address?.trim();
  return client ? client : null;
}

/**
 * Mapbox explains its own refusals in the response body, so a bare status code
 * throws away the answer. A 403 in particular is never a bad address — it is the
 * token: either URL restrictions on it (a server sends no Referer, so a
 * restricted token is rejected every time) or a missing scope or account issue.
 */
export async function mapboxFailure(response: Response, label: string): Promise<Error> {
  let detail = '';

  try {
    const text = (await response.text()).trim();
    if (text) {
      let message: unknown;
      try {
        message = (JSON.parse(text) as { message?: unknown }).message;
      } catch {
        // Not JSON — Mapbox sometimes answers with a bare string.
      }
      detail = typeof message === 'string' && message ? message : text.slice(0, 200);
    }
  } catch {
    // Unreadable body; the status alone still says something useful.
  }

  const hint = response.status === 403
    ? '. This is a token problem, not an address problem — check the Mapbox token ' +
      'has no URL restrictions (server requests send no Referer, so a restricted ' +
      'token always fails), that its scopes are enabled, and that the account has ' +
      'a payment method on file'
    : '';

  return new Error(`Mapbox ${label} failed (${response.status})${detail ? `: ${detail}` : ''}${hint}`);
}

export async function geocode(
  address: string,
  near: Coordinates | null,
  token: string,
): Promise<Coordinates | null> {
  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  url.searchParams.set('q', address);
  url.searchParams.set('country', 'us');
  url.searchParams.set('limit', '1');
  url.searchParams.set('access_token', token);
  // Bias toward the service area so a bare "123 Main St" resolves to the Main St
  // half an hour away rather than one in another state.
  if (near) url.searchParams.set('proximity', `${near.lng},${near.lat}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw await mapboxFailure(response, 'geocoding');
  }

  const body = await response.json();
  const coordinates = body?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  return { lng: Number(coordinates[0]), lat: Number(coordinates[1]) };
}

export interface RouteResult {
  durationSeconds: number;
  distanceMeters: number;
  geometry: string;
}

export async function fetchRoute(
  origin: Coordinates,
  destination: Coordinates,
  token: string,
): Promise<RouteResult | null> {
  const coordinatePair = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinatePair}`);
  // "simplified" keeps the encoded polyline short enough to survive as a static
  // image overlay; the full geometry is far more detail than a thumbnail shows.
  url.searchParams.set('overview', 'simplified');
  url.searchParams.set('geometries', 'polyline');
  url.searchParams.set('access_token', token);

  const response = await fetch(url);
  if (!response.ok) {
    throw await mapboxFailure(response, 'directions');
  }

  const body = await response.json();
  const route = body?.routes?.[0];
  if (!route || typeof route.duration !== 'number' || typeof route.distance !== 'number') {
    return null;
  }

  return {
    durationSeconds: Math.round(route.duration),
    distanceMeters: route.distance,
    geometry: typeof route.geometry === 'string' ? route.geometry : '',
  };
}

// ── Leave-by ────────────────────────────────────────────────────────────────

/**
 * Drive seconds as the minutes a human is shown. Mirrors formatTravelDuration()
 * in src/services/jobTravelService.ts — a card reading "45 min" next to a
 * leave-by computed from 44 would look like an arithmetic bug.
 */
export function travelMinutes(seconds: number | null | undefined): number {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * A buffer read from settings, clamped to the range the column accepts.
 *
 * Null and undefined both mean "no setting", not "no buffer" — Number(null) is
 * 0, so an absent travel_settings row would otherwise quietly drop the cushion
 * instead of falling back to the default.
 */
export function normalizeBufferMinutes(value: unknown): number {
  if (value == null || value === '') return DEFAULT_DEPARTURE_BUFFER_MINUTES;
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) return DEFAULT_DEPARTURE_BUFFER_MINUTES;
  return Math.min(MAX_DEPARTURE_BUFFER_MINUTES, Math.round(minutes));
}

export interface LeaveBy {
  /** HH:MM, on the same wall clock as the job's scheduled_start_time. */
  time: string;
  /**
   * Whole days before the job's date. Normally 0; a long enough drive can put
   * the departure the night before, and saying "10:00 PM" with no qualifier
   * then reads as four hours *after* the job.
   */
  daysEarlier: number;
  /** Rounded drive time, as shown to the user. */
  driveMinutes: number;
  bufferMinutes: number;
  /** driveMinutes + bufferMinutes: how far ahead of the start to walk out the door. */
  leadMinutes: number;
}

/** HH:MM[:SS] -> minutes past midnight, or null when unreadable. */
function toMinutes(time: string | null | undefined): number | null {
  const normalized = normalizeScheduleTime(time);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * When to leave: the job's start, less the drive, less the buffer.
 *
 * Null when the job has no readable start time — an all-day job starts at
 * midnight as far as a calendar is concerned, and "leave by 11:15 PM the night
 * before" for a job with no agreed hour would be worse than saying nothing.
 */
export function computeLeaveBy(
  startTime: string | null | undefined,
  travelSeconds: number | null | undefined,
  bufferMinutes: number = DEFAULT_DEPARTURE_BUFFER_MINUTES,
): LeaveBy | null {
  const startMinutes = toMinutes(startTime);
  if (startMinutes === null) return null;
  if (travelSeconds == null || !Number.isFinite(travelSeconds) || travelSeconds < 0) return null;

  const driveMinutes = travelMinutes(travelSeconds);
  const buffer = normalizeBufferMinutes(bufferMinutes);
  const leadMinutes = driveMinutes + buffer;

  // A lead longer than the time elapsed since midnight rolls into the previous
  // day; the modulo keeps the clock reading right and daysEarlier carries the rest.
  const raw = startMinutes - leadMinutes;
  const daysEarlier = Math.ceil(-raw / MINUTES_PER_DAY);
  const leaveMinutes = raw + Math.max(0, daysEarlier) * MINUTES_PER_DAY;

  const hours = Math.floor(leaveMinutes / 60);
  const minutes = leaveMinutes % 60;

  return {
    time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    daysEarlier: Math.max(0, daysEarlier),
    driveMinutes,
    bufferMinutes: buffer,
    leadMinutes,
  };
}

// ── Cached estimates ────────────────────────────────────────────────────────

export interface TravelOrigin {
  id: string | null;
  address: string | null;
  coordinates: Coordinates | null;
  bufferMinutes: number;
}

/** The address trips are measured from, plus the departure padding that goes with it. */
export async function loadTravelOrigin(
  admin: SupabaseClient,
  organizationId: string,
): Promise<TravelOrigin> {
  // select('*') rather than naming departure_buffer_minutes: functions and
  // migrations deploy through separate pipelines, and a select naming a column
  // that has not been added yet fails outright — which would take the existing
  // drive-time card down with it, not just the new leave-by. With '*' an
  // un-migrated database simply reads as "no buffer configured".
  const { data } = await admin
    .from('travel_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  return {
    id: data?.id ?? null,
    address: data?.origin_address?.trim() || null,
    coordinates:
      data?.origin_latitude != null && data?.origin_longitude != null
        ? { lat: Number(data.origin_latitude), lng: Number(data.origin_longitude) }
        : null,
    bufferMinutes: normalizeBufferMinutes(data?.departure_buffer_minutes),
  };
}

export interface TravelEstimate {
  status: TravelStatus;
  originAddress: string | null;
  destinationAddress: string | null;
  originCoordinates: Coordinates | null;
  destinationCoordinates: Coordinates | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  routeGeometry: string;
  bufferMinutes: number;
  cached: boolean;
  refreshedAt: string | null;
}

function emptyEstimate(
  status: TravelStatus,
  origin: TravelOrigin,
  destinationAddress: string | null,
): TravelEstimate {
  return {
    status,
    originAddress: origin.address,
    destinationAddress,
    originCoordinates: origin.coordinates,
    destinationCoordinates: null,
    durationSeconds: null,
    distanceMeters: null,
    routeGeometry: '',
    bufferMinutes: origin.bufferMinutes,
    cached: false,
    refreshedAt: null,
  };
}

export interface ResolveTravelOptions {
  /**
   * False reads the cache and stops there. The calendar feed sets this: it is
   * polled hourly by every subscribed calendar, and a cold cache would otherwise
   * bill a geocode plus a directions call per job, per poll, per subscriber.
   */
  allowLookup: boolean;
}

/**
 * The cached drive time for a trip, refreshing it from Mapbox when allowed.
 *
 * The destination is passed as display text and normalized here, so every caller
 * shares one cache key and none of them can invent a different one.
 */
export async function resolveTravelEstimate(
  admin: SupabaseClient,
  organizationId: string,
  destinationAddress: string | null,
  options: ResolveTravelOptions,
): Promise<TravelEstimate> {
  const origin = await loadTravelOrigin(admin, organizationId);
  const originKey = normalizeAddress(origin.address);
  const destinationKey = normalizeAddress(destinationAddress);

  if (!originKey || !destinationKey) {
    return emptyEstimate('no_address', origin, destinationAddress);
  }

  const { data: cached } = await admin
    .from('job_travel_estimates')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('origin_address', originKey)
    .eq('destination_address', destinationKey)
    .maybeSingle();

  const isFresh = cached && Date.now() - new Date(cached.refreshed_at).getTime() < CACHE_TTL_MS;
  // Redrawing the map needs both ends, and Number(null) is 0 — an "ok" row
  // missing coordinates would place the pin off West Africa, so treat it as a
  // miss and re-fetch rather than serving a nonsense result.
  const cachedIsUsable =
    cached && isFresh &&
    (cached.status !== 'ok' || (cached.destination_latitude != null && cached.destination_longitude != null));

  if (cachedIsUsable && (origin.coordinates || cached.status !== 'ok')) {
    return {
      status: cached.status as TravelStatus,
      originAddress: origin.address,
      destinationAddress,
      originCoordinates: origin.coordinates,
      destinationCoordinates:
        cached.status === 'ok'
          ? { lat: Number(cached.destination_latitude), lng: Number(cached.destination_longitude) }
          : null,
      durationSeconds: cached.status === 'ok' ? cached.duration_seconds : null,
      distanceMeters:
        cached.status === 'ok' && cached.distance_meters != null ? Number(cached.distance_meters) : null,
      routeGeometry: cached.route_geometry || '',
      bufferMinutes: origin.bufferMinutes,
      cached: true,
      refreshedAt: cached.refreshed_at,
    };
  }

  if (!options.allowLookup) {
    // A miss under cache-only rules is not a failure, just an absent answer.
    return emptyEstimate('not_cached', origin, destinationAddress);
  }

  const token = getMapboxToken();
  if (!token) {
    throw new Error(
      'Mapbox token not configured. Add the secret token to this project\'s ' +
        'edge function secrets as MapBox (or MAPBOX_SECRET_KEY).',
    );
  }

  // Geocoded once and written back, so the origin costs a lookup only when it changes.
  let originCoordinates = origin.coordinates;
  if (!originCoordinates) {
    originCoordinates = await geocode(origin.address!, null, token);
    if (originCoordinates && origin.id) {
      await admin
        .from('travel_settings')
        .update({
          origin_latitude: originCoordinates.lat,
          origin_longitude: originCoordinates.lng,
          updated_at: new Date().toISOString(),
        })
        .eq('id', origin.id);
    }
  }

  // Deliberately not cached: this is the saved trip origin failing to geocode,
  // not the job's address. Writing a not_found row here would blame the
  // customer's address and would repeat for every job until the TTL expired.
  if (!originCoordinates) {
    return emptyEstimate('origin_not_found', origin, destinationAddress);
  }

  const persist = async (row: Record<string, unknown>) => {
    const payload = {
      organization_id: organizationId,
      origin_address: originKey,
      destination_address: destinationKey,
      refreshed_at: new Date().toISOString(),
      ...row,
    };
    // The unique index is on lower(...) expressions, which upsert cannot target,
    // so the existing row is updated by id instead.
    if (cached?.id) {
      await admin.from('job_travel_estimates').update(payload).eq('id', cached.id);
    } else {
      await admin.from('job_travel_estimates').insert(payload);
    }
  };

  const destinationCoordinates = await geocode(destinationAddress!, originCoordinates, token);
  if (!destinationCoordinates) {
    await persist({ status: 'not_found', duration_seconds: null, distance_meters: null, route_geometry: null });
    return {
      ...emptyEstimate('not_found', origin, destinationAddress),
      originCoordinates,
      refreshedAt: new Date().toISOString(),
    };
  }

  const route = await fetchRoute(originCoordinates, destinationCoordinates, token);
  if (!route) {
    await persist({
      status: 'no_route',
      destination_latitude: destinationCoordinates.lat,
      destination_longitude: destinationCoordinates.lng,
      duration_seconds: null,
      distance_meters: null,
      route_geometry: null,
    });
    return {
      ...emptyEstimate('no_route', origin, destinationAddress),
      originCoordinates,
      refreshedAt: new Date().toISOString(),
    };
  }

  await persist({
    status: 'ok',
    destination_latitude: destinationCoordinates.lat,
    destination_longitude: destinationCoordinates.lng,
    duration_seconds: route.durationSeconds,
    distance_meters: route.distanceMeters,
    route_geometry: route.geometry,
  });

  return {
    status: 'ok',
    originAddress: origin.address,
    destinationAddress,
    originCoordinates,
    destinationCoordinates,
    durationSeconds: route.durationSeconds,
    distanceMeters: route.distanceMeters,
    routeGeometry: route.geometry,
    bufferMinutes: origin.bufferMinutes,
    cached: false,
    refreshedAt: new Date().toISOString(),
  };
}

/**
 * The leave-by time for one scheduled job, or null when there isn't one to give.
 *
 * Null covers every ordinary gap — an all-day job with no start hour, no trip
 * origin configured yet, an address Mapbox cannot place, a cold cache under
 * cache-only rules — and a Mapbox outage besides. A calendar invite is worth
 * more than the drive time on it, so nothing in here is allowed to throw: the
 * invite goes out without a leave-by rather than not at all.
 */
export async function resolveLeaveBy(
  admin: SupabaseClient,
  organizationId: string | null,
  destinationAddress: string | null,
  startTime: string | null | undefined,
  options: ResolveTravelOptions,
): Promise<LeaveBy | null> {
  if (!organizationId || !destinationAddress) return null;
  // Cheap guard first: an all-day job can never have a leave-by, so it should
  // not cost a settings read, let alone a Mapbox call.
  if (!normalizeScheduleTime(startTime)) return null;

  try {
    const estimate = await resolveTravelEstimate(admin, organizationId, destinationAddress, options);
    if (estimate.status !== 'ok') return null;
    return computeLeaveBy(startTime, estimate.durationSeconds, estimate.bufferMinutes);
  } catch (error) {
    console.error('resolveLeaveBy: drive time lookup failed', error);
    return null;
  }
}

/**
 * Every usable cached drive time for one origin, keyed by normalized destination.
 *
 * The calendar feed needs a drive time per job but is polled hourly by every
 * subscribed calendar, so it reads the whole cache once rather than asking per
 * job: two queries for the feed instead of two per event, and still no Mapbox
 * call. Stale and failed rows are left out — an absent key and a bad address
 * lead to the same place, an invite with no leave-by on it.
 */
export async function loadCachedTravelSeconds(
  admin: SupabaseClient,
  organizationId: string,
  originAddress: string | null,
): Promise<Map<string, number>> {
  const originKey = normalizeAddress(originAddress);
  const seconds = new Map<string, number>();
  if (!originKey) return seconds;

  const freshSince = new Date(Date.now() - CACHE_TTL_MS).toISOString();

  const { data, error } = await admin
    .from('job_travel_estimates')
    .select('destination_address, duration_seconds')
    .eq('organization_id', organizationId)
    .eq('origin_address', originKey)
    .eq('status', 'ok')
    .gte('refreshed_at', freshSince);

  if (error) {
    console.error('loadCachedTravelSeconds: cache read failed', error);
    return seconds;
  }

  for (const row of data ?? []) {
    if (typeof row.duration_seconds === 'number') {
      seconds.set(row.destination_address, row.duration_seconds);
    }
  }

  return seconds;
}
