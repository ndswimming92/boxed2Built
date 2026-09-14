import type { User } from '@supabase/supabase-js';
import { customerPortalService } from './customerPortalService';
import { portalAccountLinkingService } from './portalAccountLinkingService';

/**
 * The work that has to happen once, the first time a customer lands in the
 * portal on a given sign-in: bind their auth user to a customers row, and
 * record the login for the adoption funnel.
 *
 * This used to live inline in CallbackPage, which was fine while Google OAuth
 * was the only way in — OAuth redirects through /portal/callback, so the page
 * always ran. Passkey sign-in resolves in place without a redirect, and cannot
 * route through that page either: AuthContext only calls setUser after an
 * awaited loadOrganizations round trip, so `user` is still null for a moment
 * after signInWithPasskey() resolves, and CallbackPage would read that as a
 * dead session and bounce to /portal/login?error=session_expired.
 *
 * So the pipeline lives here, takes the user explicitly rather than reading
 * context, and both callers invoke it directly.
 */

export type PortalLoginSource = 'oauth_callback' | 'passkey';

const seenUserIds = new Set<string>();

/**
 * Fire-and-forget by design: every step is best-effort and none of them may
 * block someone from reaching their dashboard. Safe to call twice for the same
 * user (React StrictMode double-invokes effects in development) — the second
 * call is a no-op.
 */
export function runPortalPostLogin(user: User, source: PortalLoginSource): void {
  if (seenUserIds.has(user.id)) return;
  seenUserIds.add(user.id);

  void (async () => {
    const userEmail = user.email?.toLowerCase() ?? '';
    const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
    let linked = false;

    if (userEmail.endsWith('@gmail.com')) {
      try {
        const result = await portalAccountLinkingService.autoLinkGmailAccount(userEmail);
        linked = result.status === 'linked' || result.status === 'already_linked';
      } catch {
        // best-effort auto-linking; do not block sign-in flow
      }
    }

    if (!linked && userEmail) {
      try {
        await portalAccountLinkingService.autoCreatePortalCustomer(userEmail, fullName);
      } catch {
        // best-effort auto-create; do not block sign-in flow
      }
    }

    await customerPortalService.trackFunnelEvent('login', { source }).catch(() => undefined);
  })();
}

/** Lets a signed-out user's next sign-in run the pipeline again. */
export function resetPortalPostLogin(userId?: string): void {
  if (userId) {
    seenUserIds.delete(userId);
    return;
  }
  seenUserIds.clear();
}
