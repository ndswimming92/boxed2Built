import type { Job } from '../lib/supabase';

/**
 * Everything the Job Map page works out from jobs and their geocoded addresses.
 * Kept free of React and Supabase so the unit tests can load it directly.
 */

const METERS_PER_MILE = 1609.344;
const MILES_PER_DEGREE_LAT = 69.17;

/** Where one address sits, plus the cached drive to it from the trip origin. */
export interface AddressLocation {
  latitude: number;
  longitude: number;
  durationSeconds: number | null;
  distanceMeters: number | null;
  refreshedAt: string | null;
}

/** One dot on the map: every completed job done at the same address. */
export interface JobSite {
  key: string;
  /** The address as typed on the newest job there. */
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  /** Newest first. */
  jobs: Job[];
  jobCount: number;
  /** Jobs that had a price. Free and unpriced jobs are drawn but left out of the money. */
  pricedCount: number;
  revenue: number;
  /** Null when nothing here was priced. */
  avgPrice: number | null;
  lastDate: string | null;
  driveSeconds: number | null;
  distanceMiles: number | null;
}

export interface UnlocatedAddress {
  key: string;
  address: string;
  jobs: Job[];
}

export interface JobSiteResult {
  sites: JobSite[];
  /** Completed jobs with no street address saved. They cannot be drawn. */
  missingAddress: Job[];
  /** Addresses with no coordinates yet: still to be looked up, or not found. */
  unlocated: UnlocatedAddress[];
  /** Completed jobs considered, mapped or not. */
  totalJobs: number;
}

/**
 * The lookup key for an address. Must match normalizeAddress() in
 * supabase/functions/_shared/travel.ts, because that is the form the geocode
 * cache stores: trimmed, runs of whitespace collapsed, lowercased.
 */
export function mapAddressKey(address: string | null | undefined): string | null {
  const key = address?.trim().replace(/\s+/g, ' ').toLowerCase();
  return key ? key : null;
}

/** Where the work happened: the service address, or the customer's own when there is none. */
export function jobWorkAddress(job: Pick<Job, 'service_address' | 'client_address'>): string | null {
  return job.service_address?.trim() || job.client_address?.trim() || null;
}

/** A job that was really done: completed, not deleted, not a test job. */
export function isDoneJob(job: Job): boolean {
  if (job.is_active === false || job.is_test) return false;
  if (job.job_status === 'lost' || (job.job_status as string) === 'cancelled') return false;
  return job.job_status === 'completed' || !!job.date_completed;
}

/**
 * What the job was charged at: the final price, or the quote when no final price
 * was entered. Free jobs and jobs with no amount return null, so a free job does
 * not drag an area's average down.
 */
export function jobPrice(job: Pick<Job, 'final_price' | 'quoted_price' | 'is_free'>): number | null {
  if (job.is_free) return null;
  const price = Number(job.final_price ?? job.quoted_price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  for (const [value, count] of counts) {
    if (best === null || count > counts.get(best)!) best = value;
  }
  return best;
}

/** Groups completed jobs by address and attaches each address's coordinates. */
export function buildJobSites(jobs: Job[], locations: Map<string, AddressLocation>): JobSiteResult {
  const done = jobs.filter(isDoneJob);
  const missingAddress: Job[] = [];
  const byAddress = new Map<string, Job[]>();

  for (const job of done) {
    const key = mapAddressKey(jobWorkAddress(job));
    if (!key) {
      missingAddress.push(job);
      continue;
    }
    const group = byAddress.get(key);
    if (group) group.push(job);
    else byAddress.set(key, [job]);
  }

  const sites: JobSite[] = [];
  const unlocated: UnlocatedAddress[] = [];

  for (const [key, group] of byAddress) {
    group.sort((a, b) => (b.date_completed ?? '').localeCompare(a.date_completed ?? ''));
    const address = jobWorkAddress(group[0])!;
    const location = locations.get(key);
    if (!location) {
      unlocated.push({ key, address, jobs: group });
      continue;
    }

    const prices = group.map(jobPrice).filter((price): price is number => price !== null);
    const revenue = prices.reduce((sum, price) => sum + price, 0);
    const cities = group.map((job) => job.location_city?.trim()).filter((city): city is string => !!city);

    sites.push({
      key,
      address,
      city: mostCommon(cities) ?? 'Unknown area',
      latitude: location.latitude,
      longitude: location.longitude,
      jobs: group,
      jobCount: group.length,
      pricedCount: prices.length,
      revenue,
      avgPrice: prices.length ? revenue / prices.length : null,
      lastDate: group[0].date_completed ?? null,
      driveSeconds: location.durationSeconds,
      distanceMiles: location.distanceMeters != null ? location.distanceMeters / METERS_PER_MILE : null,
    });
  }

  sites.sort((a, b) => b.revenue - a.revenue || b.jobCount - a.jobCount);
  return { sites, missingAddress, unlocated, totalJobs: done.length };
}

export interface JobMapSummary {
  addresses: number;
  jobs: number;
  pricedJobs: number;
  revenue: number;
  avgPrice: number | null;
  /** Addresses with more than one job. */
  repeatAddresses: number;
  /** Jobs done at those addresses. */
  repeatJobs: number;
  repeatRevenue: number;
  /** Average one-way drive per job, in minutes. Null when no drive times are cached. */
  avgDriveMinutes: number | null;
  /** Revenue per minute of one-way driving, over jobs that have both. */
  revenuePerDriveMinute: number | null;
}

export function summarizeSites(sites: JobSite[]): JobMapSummary {
  const repeat = sites.filter((site) => site.jobCount > 1);
  const jobs = sites.reduce((sum, site) => sum + site.jobCount, 0);
  const pricedJobs = sites.reduce((sum, site) => sum + site.pricedCount, 0);
  const revenue = sites.reduce((sum, site) => sum + site.revenue, 0);

  let driveJobs = 0;
  let driveSeconds = 0;
  let driveRevenue = 0;
  for (const site of sites) {
    if (site.driveSeconds == null) continue;
    driveJobs += site.jobCount;
    driveSeconds += site.driveSeconds * site.jobCount;
    driveRevenue += site.revenue;
  }

  return {
    addresses: sites.length,
    jobs,
    pricedJobs,
    revenue,
    avgPrice: pricedJobs ? revenue / pricedJobs : null,
    repeatAddresses: repeat.length,
    repeatJobs: repeat.reduce((sum, site) => sum + site.jobCount, 0),
    repeatRevenue: repeat.reduce((sum, site) => sum + site.revenue, 0),
    avgDriveMinutes: driveJobs ? driveSeconds / driveJobs / 60 : null,
    revenuePerDriveMinute: driveSeconds > 0 ? driveRevenue / (driveSeconds / 60) : null,
  };
}

export interface GroupStat {
  label: string;
  addresses: number;
  jobs: number;
  pricedJobs: number;
  revenue: number;
  avgPrice: number | null;
}

function groupSites(sites: JobSite[], labelOf: (site: JobSite) => string | null): GroupStat[] {
  const groups = new Map<string, GroupStat>();
  for (const site of sites) {
    const label = labelOf(site);
    if (label === null) continue;
    const group = groups.get(label) ?? { label, addresses: 0, jobs: 0, pricedJobs: 0, revenue: 0, avgPrice: null };
    group.addresses += 1;
    group.jobs += site.jobCount;
    group.pricedJobs += site.pricedCount;
    group.revenue += site.revenue;
    groups.set(label, group);
  }
  for (const group of groups.values()) {
    group.avgPrice = group.pricedJobs ? group.revenue / group.pricedJobs : null;
  }
  return [...groups.values()];
}

/** Jobs, revenue and average price by town, best average first. */
export function areaBreakdown(sites: JobSite[]): GroupStat[] {
  return groupSites(sites, (site) => site.city).sort(
    (a, b) => (b.avgPrice ?? -1) - (a.avgPrice ?? -1) || b.revenue - a.revenue,
  );
}

export const DRIVE_BANDS = [
  { label: 'Under 10 min', maxMinutes: 10 },
  { label: '10 to 20 min', maxMinutes: 20 },
  { label: '20 to 30 min', maxMinutes: 30 },
  { label: 'Over 30 min', maxMinutes: Infinity },
] as const;

/** The same figures by one-way drive time, nearest band first. Empty bands are left out. */
export function driveBreakdown(sites: JobSite[]): GroupStat[] {
  const stats = groupSites(sites, (site) => {
    if (site.driveSeconds == null) return null;
    const minutes = site.driveSeconds / 60;
    return DRIVE_BANDS.find((band) => minutes < band.maxMinutes)!.label;
  });
  const order: string[] = DRIVE_BANDS.map((band) => band.label);
  return stats.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}

/** Plain-sentence takeaways. Money is passed through `money` so privacy mode can mask it. */
export function buildInsights(sites: JobSite[], money: (amount: number) => string): string[] {
  const insights: string[] = [];
  const summary = summarizeSites(sites);
  if (summary.jobs === 0) return insights;

  // One job is an anecdote, not an area's going rate.
  const areas = areaBreakdown(sites).filter((area) => area.pricedJobs >= 2 && area.avgPrice !== null);
  if (areas.length >= 2) {
    const top = areas[0];
    const bottom = areas[areas.length - 1];
    insights.push(
      `${top.label} pays best: ${money(top.avgPrice!)} a job on average over ${top.pricedJobs} jobs, ` +
        `against ${money(bottom.avgPrice!)} in ${bottom.label}.`,
    );
  }

  const busiest = [...groupSites(sites, (site) => site.city)].sort((a, b) => b.revenue - a.revenue)[0];
  if (busiest && summary.revenue > 0) {
    const share = Math.round((busiest.revenue / summary.revenue) * 100);
    insights.push(
      `${busiest.label} brings in the most money overall: ${money(busiest.revenue)} from ${busiest.jobs} ` +
        `job${busiest.jobs === 1 ? '' : 's'}, ${share}% of mapped revenue.`,
    );
  }

  if (summary.repeatAddresses > 0) {
    const share = summary.revenue > 0 ? Math.round((summary.repeatRevenue / summary.revenue) * 100) : 0;
    insights.push(
      `${summary.repeatAddresses} of ${summary.addresses} addresses had you back more than once. ` +
        `Those ${summary.repeatJobs} jobs are ${share}% of mapped revenue.`,
    );
  }

  const bands = driveBreakdown(sites).filter((band) => band.pricedJobs >= 2 && band.avgPrice !== null);
  if (bands.length >= 2) {
    const near = bands[0];
    const far = bands[bands.length - 1];
    const verdict =
      far.avgPrice! > near.avgPrice! * 1.1
        ? 'Longer drives are paying more'
        : far.avgPrice! < near.avgPrice! * 0.9
          ? 'Longer drives are paying less'
          : 'Drive time makes little difference to price';
    insights.push(
      `${verdict}: ${money(near.avgPrice!)} a job ${near.label.toLowerCase()} away, ` +
        `${money(far.avgPrice!)} ${far.label.toLowerCase()} away.`,
    );
  }

  return insights;
}

// ── Map geometry ────────────────────────────────────────────────────────────

/** Straight-line miles between two points. Plenty accurate at service-area scale. */
export function milesBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const milesPerDegreeLng = MILES_PER_DEGREE_LAT * Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
  return Math.hypot((a.latitude - b.latitude) * MILES_PER_DEGREE_LAT, (a.longitude - b.longitude) * milesPerDegreeLng);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface FocusBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * The box the "service area" view zooms to. One far-away job would otherwise
 * shrink every other dot into a single clump, so points more than `maxMiles`
 * from the middle of the pack are left outside the frame.
 */
export function focusBounds(
  points: Array<{ latitude: number; longitude: number }>,
  maxMiles = 60,
  minSpanMiles = 14,
): FocusBounds | null {
  if (points.length === 0) return null;
  const centre = { latitude: median(points.map((p) => p.latitude)), longitude: median(points.map((p) => p.longitude)) };
  const near = points.filter((point) => milesBetween(point, centre) <= maxMiles);
  const used = near.length ? near : points;

  let south = Math.min(...used.map((p) => p.latitude));
  let north = Math.max(...used.map((p) => p.latitude));
  let west = Math.min(...used.map((p) => p.longitude));
  let east = Math.max(...used.map((p) => p.longitude));

  // A single address, or a tight cluster, still needs some map around it.
  const minLat = minSpanMiles / MILES_PER_DEGREE_LAT;
  const minLng = minSpanMiles / (MILES_PER_DEGREE_LAT * Math.cos(centre.latitude * (Math.PI / 180)));
  if (north - south < minLat) {
    const mid = (north + south) / 2;
    south = mid - minLat / 2;
    north = mid + minLat / 2;
  }
  if (east - west < minLng) {
    const mid = (east + west) / 2;
    west = mid - minLng / 2;
    east = mid + minLng / 2;
  }

  const padLat = (north - south) * 0.12;
  const padLng = (east - west) * 0.12;
  return { west: west - padLng, south: south - padLat, east: east + padLng, north: north + padLat };
}

export function inBounds(point: { latitude: number; longitude: number }, bounds: FocusBounds): boolean {
  return (
    point.latitude >= bounds.south &&
    point.latitude <= bounds.north &&
    point.longitude >= bounds.west &&
    point.longitude <= bounds.east
  );
}

export interface PlacedDot {
  x: number;
  y: number;
  radius: number;
}

/**
 * Nudges overlapping dots apart so next-door addresses stay separate, clickable
 * dots instead of one hiding the other. Dots that already have room do not move,
 * and nothing is moved more than a few radii from where it belongs.
 */
export function spreadDots<T extends PlacedDot>(dots: T[], gap = 3): T[] {
  const placed = dots.map((dot) => ({ ...dot }));

  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false;
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i];
        const b = placed[j];
        const needed = a.radius + b.radius + gap;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= needed) continue;
        if (distance < 0.01) {
          // Exactly on top of each other: pick a direction that differs per pair.
          const angle = (i * 7 + j * 3) * 0.9;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (needed - distance) / 2;
        a.x -= (dx / distance) * push;
        a.y -= (dy / distance) * push;
        b.x += (dx / distance) * push;
        b.y += (dy / distance) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  return placed;
}

// ── Heat map ────────────────────────────────────────────────────────────────

export type HeatMode = 'avg' | 'total';

export interface HeatPoint {
  x: number;
  y: number;
  /** The job's price. */
  value: number;
}

export interface HeatCell {
  x: number;
  y: number;
  /** 0 to 1 along the colour ramp. */
  t: number;
  /** 0 to 1: how much nearby data backs this cell. Drives opacity. */
  strength: number;
}

export interface HeatSurface {
  cells: HeatCell[];
  cellSize: number;
  /** Dollar value at the bottom and top of the ramp. */
  min: number;
  max: number;
}

/**
 * A smoothed price surface over the map, one value per grid cell.
 *
 * `avg` answers "where are the higher-paying jobs": each cell is the average
 * price of nearby jobs, nearer ones counting more, so one address with many
 * cheap jobs does not read as hot. `total` answers "where does the money come
 * from": prices are added up, so busy areas glow even when each job is small.
 *
 * Cells with almost no data nearby are dropped, so the colour stays where the
 * jobs are and does not spread over places nobody has worked.
 */
export function priceSurface(
  points: HeatPoint[],
  width: number,
  height: number,
  cellSize: number,
  bandwidth: number,
  mode: HeatMode,
): HeatSurface {
  if (points.length === 0) return { cells: [], cellSize, min: 0, max: 0 };

  const reach = bandwidth * 3;
  const raw: Array<{ x: number; y: number; value: number; weight: number }> = [];

  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      let weight = 0;
      let weighted = 0;
      for (const point of points) {
        const dx = point.x - cx;
        const dy = point.y - cy;
        if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
        const w = Math.exp(-(dx * dx + dy * dy) / (2 * bandwidth * bandwidth));
        weight += w;
        weighted += w * point.value;
      }
      if (weight < 0.04) continue;
      raw.push({ x, y, weight, value: mode === 'avg' ? weighted / weight : weighted });
    }
  }

  const prices = points.map((point) => point.value);
  const min = mode === 'avg' ? Math.min(...prices) : 0;
  const max = mode === 'avg' ? Math.max(...prices) : Math.max(...raw.map((cell) => cell.value), 0);
  const span = max - min;

  return {
    cellSize,
    min,
    max,
    cells: raw.map((cell) => {
      // Every job the same price: there is no "higher" to show, so sit mid-ramp.
      const t = span > 0 ? Math.min(1, Math.max(0, (cell.value - min) / span)) : 0.5;
      return {
        x: cell.x,
        y: cell.y,
        t,
        strength: mode === 'avg' ? Math.min(1, cell.weight / 0.7) : Math.sqrt(t),
      };
    }),
  };
}

/** Cool to hot: low prices in blue, the middle in amber, the highest in red. */
export const HEAT_STOPS: Array<[number, [number, number, number]]> = [
  [0, [37, 99, 235]],
  [0.35, [20, 184, 166]],
  [0.6, [250, 204, 21]],
  [0.82, [249, 115, 22]],
  [1, [239, 68, 68]],
];

export function heatColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 1; i < HEAT_STOPS.length; i += 1) {
    const [stop, colour] = HEAT_STOPS[i];
    if (clamped <= stop) {
      const [previousStop, previous] = HEAT_STOPS[i - 1];
      const mix = (clamped - previousStop) / (stop - previousStop);
      const channel = (index: number) => Math.round(previous[index] + (colour[index] - previous[index]) * mix);
      return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
    }
  }
  const [, last] = HEAT_STOPS[HEAT_STOPS.length - 1];
  return `rgb(${last.join(',')})`;
}

/** "123 Main St" from "123 Main St, Spring Hill, TN 37174". */
export function streetLine(address: string): string {
  return address.split(',')[0].trim() || address;
}
