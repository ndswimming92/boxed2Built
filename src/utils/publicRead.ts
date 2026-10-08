/**
 * How the public /news page reads its data: through the cached route first,
 * straight from Supabase if that route is not working, and a couple of spaced
 * retries before giving up. Kept free of Supabase types so it can be tested.
 */

export interface ReadResult {
  error: unknown;
  /** HTTP status; 0 when the request never got an answer. */
  status: number;
}

/** The cached route's answer for "Supabase is failing"; going round it would add load. */
export const UPSTREAM_DOWN_STATUS = 503;

/** Worth another go: no answer at all, throttled, or a server-side failure. */
export function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

export const DEFAULT_RETRY_DELAYS_MS = [1000, 2500];

export interface ReadOptions {
  /** Waits before the 2nd, 3rd... round. One fewer than the number of rounds. */
  retryDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `cached` and, if it fails, `direct`. A failed round is retried after a
 * pause with some jitter, so a crowd of visitors that all failed together do
 * not all come back in the same instant. Gives back the last result, which may
 * still carry an error; the caller decides what that means.
 *
 * `cached` is null where there is no cached route (the build, or tests that
 * want to read directly).
 */
export async function readWithFallback<T extends ReadResult>(
  cached: (() => PromiseLike<T>) | null,
  direct: () => PromiseLike<T>,
  options: ReadOptions = {},
): Promise<T> {
  const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? wait;
  const random = options.random ?? Math.random;

  let last: T | null = null;
  for (let round = 0; round <= delays.length; round += 1) {
    if (round > 0) {
      const base = delays[round - 1];
      await sleep(Math.round(base * (0.75 + random() * 0.5)));
    }

    last = null;
    if (cached) {
      const viaCache = await cached();
      if (!viaCache.error) return viaCache;
      last = viaCache;
    }
    // When the cached route says the database itself is failing, asking it
    // again directly would only pile on.
    if (!last || last.status !== UPSTREAM_DOWN_STATUS) {
      const viaDirect = await direct();
      if (!viaDirect.error) return viaDirect;
      last = viaDirect;
    }

    if (!isRetryableStatus(last.status)) break;
  }
  return last as T;
}
