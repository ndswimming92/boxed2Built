const DEFAULT_RETRYABLE_CODES = new Set(['408', '429', '500', '502', '503', '504']);

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export const isTransientError = (error: unknown) => {
  if (isOffline()) return true;

  if (error instanceof TypeError) {
    return true;
  }

  if (error && typeof error === 'object') {
    const maybeCode = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
    if (DEFAULT_RETRYABLE_CODES.has(maybeCode)) {
      return true;
    }

    const message = 'message' in error ? String((error as { message?: unknown }).message ?? '').toLowerCase() : '';
    return ['network', 'timed out', 'timeout', 'temporary', 'fetch failed'].some((term) => message.includes(term));
  }

  return false;
};

export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  options?: { retries?: number; initialDelayMs?: number; maxDelayMs?: number; shouldRetry?: (error: unknown) => boolean }
): Promise<T> {
  const retries = options?.retries ?? 2;
  const initialDelayMs = options?.initialDelayMs ?? 300;
  const maxDelayMs = options?.maxDelayMs ?? 2000;
  const shouldRetry = options?.shouldRetry ?? isTransientError;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }

      const exponentialDelay = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
      const jitter = Math.floor(Math.random() * 125);
      await new Promise((resolve) => setTimeout(resolve, exponentialDelay + jitter));
      attempt += 1;
    }
  }

  throw lastError;
}

export const getOfflineFriendlyErrorMessage = (fallback: string) => {
  if (isOffline()) {
    return 'You appear to be offline. We will retry when your connection returns, or you can reconnect and try again.';
  }

  return fallback;
};
