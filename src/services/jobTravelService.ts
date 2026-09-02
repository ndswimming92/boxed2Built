import { supabase } from '../lib/supabase';

/**
 * `no_address`        — no trip origin is configured yet.
 * `not_found`         — Mapbox could not place the job's address (usually a typo).
 * `origin_not_found`  — the saved trip origin itself could not be placed.
 * `no_route`          — both ends exist but nothing drivable connects them.
 */
export type TravelStatus = 'ok' | 'not_found' | 'no_route' | 'no_address' | 'origin_not_found';

export interface JobTravelEstimate {
  status: TravelStatus;
  originAddress: string | null;
  destinationAddress: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  /** A data URI. The map is rendered server-side so the Mapbox secret token never reaches the browser. */
  mapImage: string | null;
  cached: boolean;
  refreshedAt: string | null;
}

const METERS_PER_MILE = 1609.344;

/** "45 min", "1 hr 12 min", "1 hr". */
export function formatTravelDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

/** "0.8 mi", "18.3 mi", "124 mi" — decimals stop being useful once the number is big. */
export function formatTravelDistance(meters: number | null): string {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return '—';

  const miles = meters / METERS_PER_MILE;
  return miles >= 100 ? `${Math.round(miles)} mi` : `${miles.toFixed(1)} mi`;
}

/**
 * Drive time, distance and a rendered route map from the private trip origin in
 * `travel_settings`. The destination address is resolved server-side from the id,
 * so only the id is sent and the cache key cannot be poisoned.
 */
async function requestTravelEstimate(
  body: { jobId: string } | { bookingId: string },
): Promise<JobTravelEstimate> {
  const { data, error } = await supabase.functions.invoke('job-travel-estimate', {
    body,
  });

  if (error) {
    // On a non-2xx the Edge Function's JSON body (with a human-readable `error`)
    // is on error.context; surface that instead of the generic
    // "Edge Function returned a non-2xx status code".
    let message = error.message || 'Drive time lookup failed';
    try {
      const errorBody = await (error as { context?: Response }).context?.json?.();
      if (errorBody?.error) message = errorBody.error;
    } catch {
      // fall back to the generic message
    }
    throw new Error(message);
  }

  if (!data) {
    throw new Error('No response from the drive time lookup');
  }

  return {
    status: (['ok', 'not_found', 'no_route', 'no_address', 'origin_not_found'] as const).includes(data.status)
      ? data.status
      : 'not_found',
    originAddress: data.originAddress ?? null,
    destinationAddress: data.destinationAddress ?? null,
    durationSeconds: typeof data.durationSeconds === 'number' ? data.durationSeconds : null,
    distanceMeters: typeof data.distanceMeters === 'number' ? data.distanceMeters : null,
    mapImage: typeof data.mapImage === 'string' ? data.mapImage : null,
    cached: data.cached === true,
    refreshedAt: data.refreshedAt ?? null,
  };
}

export function getJobTravelEstimate(jobId: string): Promise<JobTravelEstimate> {
  return requestTravelEstimate({ jobId });
}

/**
 * The same lookup for a booking. Bookings and jobs share the cache, since it is
 * keyed on the origin/destination pair rather than on the row that asked.
 */
export function getBookingTravelEstimate(bookingId: string): Promise<JobTravelEstimate> {
  return requestTravelEstimate({ bookingId });
}
