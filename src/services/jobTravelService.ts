import { supabase } from '../lib/supabase';

/**
 * `no_address`        — no trip origin is configured yet.
 * `not_found`         — Mapbox could not place the job's address (usually a typo).
 * `origin_not_found`  — the saved trip origin itself could not be placed.
 * `no_route`          — both ends exist but nothing drivable connects them.
 */
export type TravelStatus = 'ok' | 'not_found' | 'no_route' | 'no_address' | 'origin_not_found';

/**
 * When to walk out the door: the job's start, less the drive, less the buffer
 * configured on the Mileage Settings page. Computed server-side so the card, the
 * emailed invite and the subscribed calendar feed can never disagree about it.
 */
export interface LeaveBy {
  /** HH:MM on the job's own wall clock. */
  time: string;
  /** Whole days before the job's date; 0 for the same morning. */
  daysEarlier: number;
  driveMinutes: number;
  bufferMinutes: number;
  /** driveMinutes + bufferMinutes — how far ahead of the start to leave. */
  leadMinutes: number;
  /** Ready-to-render, e.g. '10:45 AM (45 min drive + 15 min buffer)'. */
  label: string;
}

export interface JobTravelEstimate {
  status: TravelStatus;
  originAddress: string | null;
  destinationAddress: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  /** Padding added on top of the drive time when working out the leave-by. */
  departureBufferMinutes: number;
  /** Null when the row has no start hour to count back from, or no usable route. */
  leaveBy: LeaveBy | null;
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
 * '10:45 AM', or '10:45 PM the day before' when the drive starts before midnight.
 * Mirrors formatLeaveByTime() in supabase/functions/_shared/scheduleLabels.ts, so
 * the card and the calendar invite word the same moment the same way.
 */
export function formatLeaveByTime(leaveBy: LeaveBy): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(leaveBy.time);
  if (!match) return leaveBy.time;

  const hour = Number(match[1]);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const clock = `${displayHour}:${match[2]} ${period}`;

  if (leaveBy.daysEarlier === 1) return `${clock} the day before`;
  if (leaveBy.daysEarlier > 1) return `${clock}, ${leaveBy.daysEarlier} days before`;
  return clock;
}

/** Absent, partial or malformed leave-by data all mean the same thing: don't show one. */
function parseLeaveBy(value: unknown): LeaveBy | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.time !== 'string' || typeof raw.label !== 'string') return null;

  return {
    time: raw.time,
    daysEarlier: typeof raw.daysEarlier === 'number' ? raw.daysEarlier : 0,
    driveMinutes: typeof raw.driveMinutes === 'number' ? raw.driveMinutes : 0,
    bufferMinutes: typeof raw.bufferMinutes === 'number' ? raw.bufferMinutes : 0,
    leadMinutes: typeof raw.leadMinutes === 'number' ? raw.leadMinutes : 0,
    label: raw.label,
  };
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
    departureBufferMinutes:
      typeof data.departureBufferMinutes === 'number' ? data.departureBufferMinutes : 0,
    leaveBy: parseLeaveBy(data.leaveBy),
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
