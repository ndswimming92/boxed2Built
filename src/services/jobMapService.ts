import { supabase, type Job } from '../lib/supabase';
import { mapAddressKey, type AddressLocation } from '../utils/jobMap';

/** Matches CACHE_TTL_MS in supabase/functions/_shared/travel.ts. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface EstimateRow {
  origin_address: string;
  destination_address: string;
  destination_latitude: number | string | null;
  destination_longitude: number | string | null;
  duration_seconds: number | null;
  distance_meters: number | string | null;
  status: string;
  refreshed_at: string;
}

export interface JobMapOrigin {
  latitude: number;
  longitude: number;
}

export interface JobMapData {
  jobs: Job[];
  /** Keyed by mapAddressKey(). Only addresses Mapbox could place. */
  locations: Map<string, AddressLocation>;
  /** Address keys Mapbox was asked about and could not place. */
  notFound: Set<string>;
  /** Address keys whose cached result is past the 30-day refresh window. */
  stale: Set<string>;
  /** Where trips start from (Mileage Settings). Null until it has been geocoded. */
  origin: JobMapOrigin | null;
  /** False when no trip origin is saved, so no address can be located at all. */
  hasOriginAddress: boolean;
  /** Vehicle cost per mile from Mileage Settings: the newest rate already in effect. */
  ratePerMile: number;
}

/** Rows per request, and a ceiling on requests so a bad response cannot loop forever. */
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

/**
 * Reads every row of a query in ordered pages. A single request stops at the
 * API's row cap without saying so, which would quietly drop jobs from the map.
 */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let request = 0; request < MAX_PAGES; request += 1) {
    const { data, error } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load ${what}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Used when Mileage Settings holds no rate yet. */
const DEFAULT_RATE_PER_MILE = 0.7;

/**
 * Jobs plus the coordinates already on file for their addresses.
 *
 * Coordinates come from `job_travel_estimates`, the cache the drive-time card on
 * the Jobs page fills. Reading it here costs nothing; addresses it does not hold
 * yet are looked up one at a time with locateJobAddress().
 */
export async function getJobMapData(): Promise<JobMapData> {
  const { data: business, error: businessError } = await supabase
    .from('business_info')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  if (businessError) throw new Error(`Failed to load the business: ${businessError.message}`);
  if (!business) {
    return {
      jobs: [],
      locations: new Map(),
      notFound: new Set(),
      stale: new Set(),
      origin: null,
      hasOriginAddress: false,
      ratePerMile: DEFAULT_RATE_PER_MILE,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const [jobs, originResult, estimates, mileageResult] = await Promise.all([
    fetchAllRows<Job>(
      (from, to) =>
        supabase.from('jobs').select('*').eq('business_id', business.id).eq('is_active', true).order('id').range(from, to),
      'jobs',
    ),
    supabase
      .from('travel_settings')
      .select('origin_address, origin_latitude, origin_longitude')
      .eq('is_active', true)
      .maybeSingle(),
    fetchAllRows<EstimateRow>(
      (from, to) =>
        supabase
          .from('job_travel_estimates')
          .select(
            'origin_address, destination_address, destination_latitude, destination_longitude, duration_seconds, distance_meters, status, refreshed_at',
          )
          .order('id')
          .range(from, to),
      'job locations',
    ),
    supabase
      .from('mileage_settings')
      .select('rate_per_mile')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .lte('effective_date', today)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const originRow = originResult.data;
  const originKey = mapAddressKey(originRow?.origin_address);
  const locations = new Map<string, AddressLocation>();
  const notFound = new Set<string>();
  const stale = new Set<string>();
  const now = Date.now();

  for (const row of estimates) {
    // Rows measured from an older trip origin still hold the right coordinates,
    // but their drive times are from somewhere else, so they are refreshed.
    const fromCurrentOrigin = !originKey || row.origin_address === originKey;
    const isStale = !fromCurrentOrigin || now - new Date(row.refreshed_at).getTime() > CACHE_TTL_MS;
    const key = row.destination_address;

    if (row.destination_latitude == null || row.destination_longitude == null) {
      if (row.status === 'not_found' && !isStale) notFound.add(key);
      continue;
    }
    if (locations.has(key) && !fromCurrentOrigin) continue;

    locations.set(key, {
      latitude: Number(row.destination_latitude),
      longitude: Number(row.destination_longitude),
      durationSeconds: fromCurrentOrigin && row.status === 'ok' ? row.duration_seconds : null,
      distanceMeters:
        fromCurrentOrigin && row.status === 'ok' && row.distance_meters != null ? Number(row.distance_meters) : null,
      refreshedAt: row.refreshed_at,
    });
    if (isStale) stale.add(key);
    else stale.delete(key);
  }

  return {
    jobs,
    locations,
    notFound,
    stale,
    origin:
      originRow?.origin_latitude != null && originRow?.origin_longitude != null
        ? { latitude: Number(originRow.origin_latitude), longitude: Number(originRow.origin_longitude) }
        : null,
    hasOriginAddress: !!originKey,
    // A missing or unreadable rate must not blank the page, so it falls back.
    ratePerMile: Number(mileageResult.data?.rate_per_mile) > 0 ? Number(mileageResult.data!.rate_per_mile) : DEFAULT_RATE_PER_MILE,
  };
}

/**
 * Asks Mapbox where a job's address is and caches the answer, the same lookup
 * the drive-time card makes. `map: false` skips rendering the route picture,
 * which this page never shows. Returns the lookup's status.
 */
export async function locateJobAddress(jobId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('job-travel-estimate', {
    body: { jobId, map: false },
  });

  if (error) {
    let message = error.message || 'Address lookup failed';
    try {
      const body = await (error as { context?: Response }).context?.json?.();
      if (body?.error) message = body.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }

  return typeof data?.status === 'string' ? data.status : 'not_found';
}
