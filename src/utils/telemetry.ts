const SESSION_CORRELATION_KEY = 'boxed2built.session.correlation_id';

const isBrowser = typeof window !== 'undefined';

const safeStorage = {
  getItem(key: string): string | null {
    if (!isBrowser) return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    if (!isBrowser) return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Ignore storage availability issues.
    }
  },
};

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const randomPart = Math.random().toString(16).slice(2);
  return `cid-${Date.now()}-${randomPart}`;
}

export function getSessionCorrelationId(): string {
  const existing = safeStorage.getItem(SESSION_CORRELATION_KEY);
  if (existing) {
    return existing;
  }

  const correlationId = generateCorrelationId();
  safeStorage.setItem(SESSION_CORRELATION_KEY, correlationId);
  return correlationId;
}

export function createRequestCorrelationId(): string {
  return generateCorrelationId();
}

export function getRequestTraceContext() {
  return {
    correlationId: createRequestCorrelationId(),
    sessionCorrelationId: getSessionCorrelationId(),
  };
}

