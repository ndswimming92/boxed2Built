import type { SaleSubscriber } from '../types/saleSubscriber';

/** One dot on the map: everyone who signed up from roughly the same place. */
export interface MapCluster {
  key: string;
  latitude: number;
  longitude: number;
  count: number;
  /** The place's name for the tooltip, e.g. "Spring Hill, TN". */
  label: string;
  /** Newest sign-up here, ms since epoch. Drives the "just joined" pulse. */
  latest: number;
}

export interface MapSummary {
  total: number;
  /** Subscribed in the last 24 hours. */
  today: number;
  inTennessee: number;
  /** Placed, but in another state or country. */
  elsewhere: number;
  /** Signed up before locations were kept, or could not be placed. */
  unknown: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const isPlaced = (s: SaleSubscriber): s is SaleSubscriber & { latitude: number; longitude: number } =>
  typeof s.latitude === 'number' &&
  typeof s.longitude === 'number' &&
  Number.isFinite(s.latitude) &&
  Number.isFinite(s.longitude);

export const isInTennessee = (s: SaleSubscriber) => s.country_code === 'US' && s.region_code === 'TN';

export function placeLabel(s: Pick<SaleSubscriber, 'city' | 'region_code' | 'region' | 'country_code'>): string {
  const area = s.region_code || s.region || s.country_code || '';
  return [s.city, area].filter(Boolean).join(', ') || 'Unknown location';
}

export function summarize(subscribers: SaleSubscriber[], now: number = Date.now()): MapSummary {
  const active = subscribers.filter((s) => s.status === 'active');
  const placed = active.filter(isPlaced);
  const inTennessee = placed.filter(isInTennessee).length;

  return {
    total: active.length,
    today: active.filter((s) => now - new Date(s.subscribed_at).getTime() < DAY_MS).length,
    inTennessee,
    elsewhere: placed.length - inTennessee,
    unknown: active.length - placed.length,
  };
}

/**
 * Active subscribers grouped by place. Coordinates are already rounded to two
 * decimals when stored, so an exact match is the same city.
 */
export function clusterSubscribers(subscribers: SaleSubscriber[]): MapCluster[] {
  const clusters = new Map<string, MapCluster>();

  for (const s of subscribers) {
    if (s.status !== 'active' || !isPlaced(s)) continue;
    const key = `${s.latitude.toFixed(2)},${s.longitude.toFixed(2)}`;
    const joined = new Date(s.subscribed_at).getTime();
    const existing = clusters.get(key);
    if (existing) {
      existing.count += 1;
      existing.latest = Math.max(existing.latest, joined);
    } else {
      clusters.set(key, {
        key,
        latitude: s.latitude,
        longitude: s.longitude,
        count: 1,
        label: placeLabel(s),
        latest: joined,
      });
    }
  }

  return [...clusters.values()];
}

/** "just now", "5m ago", "3h ago", "2d ago", then a date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
