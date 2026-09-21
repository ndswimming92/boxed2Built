/**
 * Where to send someone after they sign in to the customer portal.
 *
 * This lived as two identical private copies in LoginPage and CallbackPage
 * while Google OAuth was the only way in. Magic links add a third consumer and
 * a path where it genuinely matters: the destination now travels through an
 * email, so it crosses a trust boundary that a same-tab OAuth redirect never
 * did.
 *
 * Kept free of React, the Supabase client and import.meta.env so
 * `node --test` can import it directly — same constraint as
 * src/utils/passkeyErrors.ts.
 */

export const PORTAL_DEFAULT_PATH = '/portal/dashboard';

/**
 * A same-origin portal path, or the dashboard.
 *
 * Rejected, and why each matters:
 *  - anything not starting with `/portal` — including `/admin/...`, which a
 *    customer cannot load anyway, and protocol-relative `//evil.com`
 *  - `https://evil.com` and other absolute URLs, for the obvious reason
 *  - `/portalXyz`, which shares the prefix but is a different route
 *  - anything containing `..`, which `startsWith('/portal')` alone would wave
 *    through: `/portal/../admin/dashboard` passes that test and normalises to
 *    an admin route in the browser before the router ever sees it
 */
export function getSafeNextPath(value: string | null | undefined): string {
  if (!value) return PORTAL_DEFAULT_PATH;
  if (value.includes('..')) return PORTAL_DEFAULT_PATH;
  if (value !== '/portal' && !value.startsWith('/portal/')) return PORTAL_DEFAULT_PATH;

  return value;
}

/**
 * Pick between the destination carried in the callback URL and the one left in
 * sessionStorage, preferring the URL.
 *
 * The ordering is the whole point. `sessionStorage` is per-tab, and a mail
 * client always opens a link in a NEW tab, so the value LoginPage stored is
 * guaranteed to be missing on every magic-link landing. Google sign-in keeps
 * working off sessionStorage only because it redirects the same tab.
 */
export function resolveNextPath(
  queryNext: string | null | undefined,
  storedNext: string | null | undefined,
): string {
  const fromQuery = getSafeNextPath(queryNext);
  if (fromQuery !== PORTAL_DEFAULT_PATH) return fromQuery;

  return getSafeNextPath(storedNext);
}
