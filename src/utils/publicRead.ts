/**
 * How the public /news page reads its data: a couple of spaced retries before
 * giving up. Kept free of Supabase types so it can be tested.
 */

export interface ReadResult {
  error: unknown;
  /** HTTP status; 0 when the request never got an answer. */
  status: number;
}

/** Worth another go: no answer at all, throttled, or a server-side failure. */
export function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

export const DEFAULT_RETRY_DELAYS_MS = [1000, 2500];

export interface ReadOptions {
  /** Waits before the 2nd, 3rd... attempt. One fewer than the number of attempts. */
  retryDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `read`, and if it fails retries after a pause with some jitter, so a
 * crowd of visitors that all failed together do not all come back in the same
 * instant. A request the server rejected (a 4xx other than 429) is not retried.
 * Gives back the last result, which may still carry an error; the caller
 * decides what that means.
 */
export async function readWithRetry<T extends ReadResult>(
  read: () => PromiseLike<T>,
  options: ReadOptions = {},
): Promise<T> {
  const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? wait;
  const random = options.random ?? Math.random;

  let result = await read();
  for (const base of delays) {
    if (!result.error || !isRetryableStatus(result.status)) break;
    await sleep(Math.round(base * (0.75 + random() * 0.5)));
    result = await read();
  }
  return result;
}
