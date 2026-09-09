/**
 * Campaign attribution for the quote form.
 *
 * Several internal CTAs link to /contact with UTM parameters attached, and
 * `form_inquiries` has had columns for them all along, but the form never read
 * them - so every campaign-driven lead was filed as untagged.
 *
 * Values are held for the session, so wandering off the contact page and back
 * does not lose the attribution.
 *
 * Only the three parameters the table has columns for are kept. The CTAs also
 * carry utm_id, utm_term and utm_content, which have nowhere to go.
 */

export type UTMParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

const UTM_STORAGE_KEY = 'boxed2built.utm';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

/** Campaign names are short. Anything longer is junk or an attack on the column. */
const MAX_LENGTH = 200;

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, MAX_LENGTH);
  return trimmed || undefined;
}

/**
 * The UTMs on the current URL, or the ones captured earlier this session when
 * the URL carries none. A URL that has them always wins, so a fresh campaign
 * link overwrites a stale one.
 */
export function readUTMParams(searchParams: URLSearchParams): UTMParams {
  const fromURL: UTMParams = {};
  for (const key of UTM_KEYS) {
    const value = clean(searchParams.get(key));
    if (value) fromURL[key] = value;
  }

  if (Object.keys(fromURL).length > 0) {
    rememberUTMParams(fromURL);
    return fromURL;
  }

  return recallUTMParams();
}

export function rememberUTMParams(params: UTMParams): void {
  try {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Private browsing or blocked storage. The URL still works.
  }
}

export function recallUTMParams(): UTMParams {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};

    // Rebuilt key by key rather than trusted as-is: this came back from
    // storage, so it can be anything.
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const restored: UTMParams = {};
    for (const key of UTM_KEYS) {
      const value = clean((parsed as Record<string, unknown>)[key]);
      if (value) restored[key] = value;
    }
    return restored;
  } catch {
    return {};
  }
}

export function forgetUTMParams(): void {
  try {
    sessionStorage.removeItem(UTM_STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}
