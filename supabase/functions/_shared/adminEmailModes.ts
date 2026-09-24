/**
 * The preview and test-send modes shared by the emails an admin sends by hand
 * from a client's profile: the post-job follow-up, the quote, and the invoice.
 *
 * Each of those functions renders its own email, so the rules that decide what
 * a preview shows and where a test copy goes live here instead of being written
 * out three times and drifting apart. Nothing in this file imports Deno or
 * Supabase, so tests/unit can exercise it directly.
 *
 * The same shape send-customer-job-reminders already answers with, so the admin
 * console reads every preview the same way.
 */

/** What the admin console needs to show one of these emails before it goes out. */
export interface EmailPreviewPayload {
  subject: string;
  /** The email body. Rendered into a sandboxed iframe, never injected. */
  html: string;
  text: string;
  /** The address a real send would go to, or null when there is not a usable one. */
  recipient: string | null;
  /**
   * Why a real send would refuse as things stand, in words the admin can act
   * on, or null when it would go. A preview renders either way: seeing the
   * email is how you work out what to fix.
   */
  blocked: string | null;
}

/** Seconds left on a cooldown, or 0 when it has expired or never started. */
export function cooldownSecondsRemaining(
  lastSentAt: string | null | undefined,
  cooldownMs: number,
  now: number = Date.now(),
): number {
  if (!lastSentAt) return 0;
  const lastSent = new Date(lastSentAt).getTime();
  // An unparseable timestamp is not a reason to hold an email back.
  if (!Number.isFinite(lastSent)) return 0;
  const elapsed = now - lastSent;
  if (elapsed >= cooldownMs) return 0;
  // A timestamp in the future is a clock that disagrees, not a longer wait.
  const remaining = Math.min(cooldownMs - elapsed, cooldownMs);
  return Math.ceil(remaining / 1000);
}

/** The wait, as the preview's blocked line puts it. Rounded up: a wait told
 * short is one the admin comes back too early for. */
export function describeCooldown(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return '';
  const minutes = Math.ceil(remainingSeconds / 60);
  const wait = remainingSeconds < 60
    ? `${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`
    : `${minutes} minute${minutes === 1 ? '' : 's'}`;
  return `This email was sent recently. It can be sent again in ${wait}.`;
}

/**
 * Where a test copy goes.
 *
 * The recipient is the signed-in admin, read from their own token by the
 * caller. There is deliberately no recipient parameter anywhere in these
 * functions: a body-supplied address would turn them into a way to mail
 * arbitrary people from the business's domain.
 */
export function testRecipientFrom(
  auth: { user?: { email: string | null } },
): { ok: true; email: string } | { ok: false; error: string } {
  const email = auth.user?.email?.trim();
  if (!email) {
    return {
      ok: false,
      error: 'A test send needs a signed-in admin with an email address.',
    };
  }
  return { ok: true, email };
}
