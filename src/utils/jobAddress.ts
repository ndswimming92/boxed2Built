import { Job } from '../lib/supabase';

/** Blank, whitespace-only and missing addresses all mean "no address on file". */
export function normalizeAddress(address: string | null | undefined): string | null {
  const trimmed = address?.trim();
  return trimmed ? trimmed : null;
}

export function isSameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeAddress(a);
  const right = normalizeAddress(b);
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

type JobAddresses = Pick<Job, 'client_address' | 'service_address'>;

/**
 * Where the work took place. A job with no service address of its own was worked at the
 * customer's address, so it follows the client profile instead of holding a stale copy.
 */
export function resolveWorkAddress(job: Partial<JobAddresses>): string | null {
  return normalizeAddress(job.service_address) ?? normalizeAddress(job.client_address);
}

/** True when the work happened somewhere other than the customer's own address. */
export function hasSeparateWorkAddress(job: Partial<JobAddresses>): boolean {
  return normalizeAddress(job.service_address) !== null;
}

/** Directions deep link — Apple Maps on iOS, Google Maps everywhere else. */
export function getDirectionsUrl(address: string): string {
  const encodedAddress = encodeURIComponent(address.trim());
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  return isIOS
    ? `https://maps.apple.com/?daddr=${encodedAddress}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
}
