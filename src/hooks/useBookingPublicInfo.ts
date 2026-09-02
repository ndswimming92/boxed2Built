import { useEffect, useState } from 'react';
import { BookingPublicInfo } from '../lib/supabase';
import { getBookingPublicInfo } from '../services/bookingService';

/**
 * The booking policy, shared across every consumer on the page.
 *
 * The header and footer render on every route, so a plain `useEffect` fetch
 * here would put a request on each of them, on each navigation. Instead the
 * result and the in-flight promise are held at module scope, the same shape
 * businessDataStore uses: the first consumer fetches, everyone else waits on
 * that one promise, and later mounts read the cache.
 *
 * `null` means "not known yet". Callers should render nothing rather than
 * guessing — a Book Now button that appears a moment late is much better than
 * one that appears and then vanishes because booking turned out to be off.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: BookingPublicInfo | null = null;
let cachedAt = 0;
let pending: Promise<BookingPublicInfo | null> | null = null;

/** Consumers mounted before the fetch resolves; they are all told at once. */
const subscribers = new Set<(info: BookingPublicInfo | null) => void>();

function isFresh(): boolean {
  return !!cached && Date.now() - cachedAt < CACHE_TTL_MS;
}

function load(): Promise<BookingPublicInfo | null> {
  if (isFresh()) return Promise.resolve(cached);
  if (pending) return pending;

  pending = getBookingPublicInfo()
    .then((info) => {
      cached = info;
      cachedAt = Date.now();
      subscribers.forEach((notify) => notify(info));
      return info;
    })
    .catch((error: unknown) => {
      // Booking is an extra path, not the way the site works. If the lookup
      // fails the visitor should still get an unbroken page with the quote
      // form on it, so this stays quiet and every consumer renders nothing.
      console.warn('Booking availability lookup failed', error);
      subscribers.forEach((notify) => notify(null));
      return null;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}

export function useBookingPublicInfo(): BookingPublicInfo | null {
  const [info, setInfo] = useState<BookingPublicInfo | null>(() => (isFresh() ? cached : null));

  useEffect(() => {
    if (isFresh()) {
      setInfo(cached);
      return;
    }

    let active = true;
    const notify = (next: BookingPublicInfo | null) => {
      if (active) setInfo(next);
    };

    subscribers.add(notify);
    void load();

    return () => {
      active = false;
      subscribers.delete(notify);
    };
  }, []);

  return info;
}

/** True only once the policy is known and booking is actually open. */
export function useBookingEnabled(): boolean {
  return useBookingPublicInfo()?.is_enabled === true;
}
