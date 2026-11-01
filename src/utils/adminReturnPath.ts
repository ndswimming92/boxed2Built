/**
 * Remembers which admin page someone was headed to when the guard sent them to
 * sign in, so a link such as /admin/inquiries?open=<id> (the one in the owner's
 * new-request text) still lands there afterwards.
 *
 * It lives in sessionStorage rather than in router state because signing in with
 * Google leaves the site and comes back, which router state does not survive.
 * Only plain /admin/... paths are accepted, never a full address, so a crafted
 * link cannot send an admin somewhere else once they have signed in.
 */

const KEY = 'b2b_admin_return_path';
const MAX_AGE_MS = 30 * 60 * 1000;

/** A path under /admin (not the login page itself) with only plain characters in it. */
export function isSafeAdminPath(path: string | null | undefined): path is string {
  return (
    typeof path === 'string' &&
    path.length <= 300 &&
    /^\/admin\/(?!login(?:[/?]|$))[A-Za-z0-9/_-]*(\?[A-Za-z0-9=&%._~-]*)?$/.test(path) &&
    !path.includes('//')
  );
}

export function rememberAdminReturnPath(path: string): void {
  if (!isSafeAdminPath(path)) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Storage can be blocked; signing in still works, it just lands on the dashboard.
  }
}

/** The remembered path if there is a recent, safe one. Reading does not clear it. */
export function readAdminReturnPath(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof saved.at !== 'number' || Date.now() - saved.at > MAX_AGE_MS) return null;
    return isSafeAdminPath(saved.path as string) ? (saved.path as string) : null;
  } catch {
    return null;
  }
}

export function clearAdminReturnPath(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
