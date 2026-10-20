/**
 * Approximate location for a sign-up, from the visitor's IP address.
 *
 * Uses ipwho.is (free, HTTPS, no key). The address is sent to that service and
 * only the result is kept: the privacy policy says so, and the IP is never
 * stored. Everything here is best effort. A failed or slow lookup returns null
 * and the person is simply not placed on the map.
 */

export interface IpLocation {
  city: string | null;
  region: string | null;
  region_code: string | null;
  country_code: string;
  latitude: number;
  longitude: number;
}

const LOOKUP_TIMEOUT_MS = 2500;

/** Loopback, private and link-local ranges have no place on a map. */
export function isPublicIp(ip: string): boolean {
  if (!ip || ip === 'unknown') return false;
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return !(lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80'));
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return !(
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Reads an ipwho.is answer. Anything unexpected is null, never a guess. */
export function parseIpLocation(body: unknown): IpLocation | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.success !== true) return null;

  const lat = typeof b.latitude === 'number' ? b.latitude : NaN;
  const lon = typeof b.longitude === 'number' ? b.longitude : NaN;
  const country = typeof b.country_code === 'string' ? b.country_code.trim().toUpperCase() : '';
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (!/^[A-Z]{2}$/.test(country)) return null;

  const text = (value: unknown, max: number) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

  return {
    city: text(b.city, 100),
    region: text(b.region, 100),
    region_code: text(b.region_code, 10),
    country_code: country,
    latitude: round2(lat),
    longitude: round2(lon),
  };
}

export async function lookupIpLocation(ip: string): Promise<IpLocation | null> {
  if (!isPublicIp(ip)) return null;
  try {
    const response = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,region_code,country_code,latitude,longitude`,
      { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) },
    );
    if (!response.ok) return null;
    return parseIpLocation(await response.json());
  } catch {
    return null;
  }
}
