/**
 * Human copy for the email sign-in link path, the one number worth pulling back
 * out of an upstream message, and the address normalisation that decides which
 * rate-limit bucket a request lands in.
 *
 * Kept free of React, the Supabase client and import.meta.env so
 * `node --test` can import it directly — same constraint as
 * src/utils/passkeyErrors.ts.
 *
 * Three families end up here:
 *
 *  - Send-time codes from Supabase Auth, when signInWithOtp is refused:
 *    rate limits, a disabled provider, a malformed address.
 *  - Verify-time codes, when the link or the typed code is rejected:
 *    'otp_expired' and friends.
 *  - One local code, 'magic_link_failed', which CallbackPage sets itself. The
 *    client runs flowType: 'pkce' (src/lib/supabase.ts), so the emailed link
 *    can only be completed in the browser that asked for it — the code
 *    verifier lives in that browser's localStorage and nowhere else. Opening
 *    the mail on a phone therefore fails with no useful upstream code at all,
 *    and that case needs copy of its own because it is both common and
 *    completely opaque otherwise.
 */

/** Anything with a `code`, which AuthError provides; `status` carries the HTTP code. */
type CodedError =
  | { code?: string | null; message?: string | null; status?: number | null }
  | null
  | undefined;

export function getMagicLinkErrorCode(error: CodedError): string {
  if (!error || typeof error !== 'object') return '';
  return typeof error.code === 'string' ? error.code : '';
}

const SAME_BROWSER_COPY =
  'That sign-in link has expired, was already used, or was opened in a different browser than the one you requested it from. Request a new link below, or enter the 6-digit code from the email.';

const MESSAGES: Record<string, string> = {
  // ── Send time ───────────────────────────────────────────────────────────
  over_email_send_rate_limit:
    'You have asked for a link very recently. Wait a moment and try again.',
  over_request_rate_limit:
    'Too many attempts. Wait a moment and try again.',
  email_address_invalid:
    'That email address does not look right. Check it and try again.',
  validation_failed:
    'That email address does not look right. Check it and try again.',
  // Both of these mean the project is misconfigured rather than anything the
  // customer did, so the copy points them at a route that still works.
  signup_disabled:
    'New accounts cannot be created by email right now. Use "Continue with Google", or contact us and we will set you up.',
  email_provider_disabled:
    'Email sign-in is unavailable right now. Use "Continue with Google", or contact us.',
  otp_disabled:
    'Email sign-in is unavailable right now. Use "Continue with Google", or contact us.',

  // ── Verify time ─────────────────────────────────────────────────────────
  otp_expired: SAME_BROWSER_COPY,
  flow_state_not_found: SAME_BROWSER_COPY,
  flow_state_expired: SAME_BROWSER_COPY,
  bad_code_verifier: SAME_BROWSER_COPY,
  access_denied: SAME_BROWSER_COPY,
  magic_link_failed: SAME_BROWSER_COPY,

  user_banned:
    'This account is not able to sign in. Please contact us.',

  // Not a code Supabase sends — set from `status` below, because auth-js throws
  // AuthRetryableFetchError for 5xx and never parses a code out of the body.
  server_error:
    "We couldn't send that email just now. This is a problem on our end, not with your address — please try again in a few minutes, or use \u201cContinue with Google\u201d.",
};

/** A server fault, as opposed to anything about the address that was entered. */
function isServerFault(error: CodedError): boolean {
  if (!error || typeof error !== 'object') return false;
  return typeof error.status === 'number' && error.status >= 500;
}

const FALLBACK =
  'That did not work. Please try again, or sign in another way.';

/**
 * A sentence safe to show a customer. Never returns the raw error text —
 * Supabase's own wording leans technical and sometimes names internals.
 */
export function describeMagicLinkError(error: CodedError): string {
  const code = getMagicLinkErrorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];

  // A 429 that arrived without a recognised code is still a rate limit.
  if (error && typeof error === 'object' && error.status === 429) {
    return MESSAGES.over_email_send_rate_limit;
  }

  // 5xx arrives with no code at all: auth-js throws AuthRetryableFetchError for
  // anything in that range and returns before the body is inspected. Matching
  // on status is the only way to recognise it.
  if (isServerFault(error)) return MESSAGES.server_error;

  return FALLBACK;
}

/** True when we have copy of our own for this code, rather than the catch-all. */
export function isKnownMagicLinkCode(code: string | null | undefined): boolean {
  return typeof code === 'string' && code in MESSAGES;
}

/**
 * Seconds left on Supabase's per-address cooldown, read out of the message it
 * sends with a 429: "For security purposes, you can only request this after
 * 47 seconds."
 *
 * Worth parsing rather than assuming a fixed 60: the server's number is the
 * authoritative one, and counting down from the wrong value either re-enables
 * the button too early (a second 429, which reads as broken) or leaves it
 * disabled after the real cooldown has passed.
 *
 * Returns null when there is no number to find, so callers can fall back to
 * their own default.
 */
export function parseEmailRateLimitSeconds(message: string | null | undefined): number | null {
  if (!message) return null;

  const match = /after\s+(\d+)\s*second/i.exec(message);
  if (!match) return null;

  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  return seconds;
}

/** True when the caller should show a cooldown rather than the generic sent card. */
export function isEmailRateLimited(error: CodedError): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = getMagicLinkErrorCode(error);
  return code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429;
}

/**
 * Failures that must NOT be hidden behind the "check your email" card.
 *
 * That card is shown whatever the outcome, so that a known and an unknown
 * address are indistinguishable — otherwise the form is a free oracle for
 * testing whether someone is a customer. These codes are exempt because none of
 * them says anything about a particular address: they are either project-wide
 * misconfiguration or a malformed address the sender rejected. Telling the
 * truth about them leaks nothing and saves someone waiting for an email that is
 * never going to arrive.
 *
 * A 5xx counts too, and is matched on status rather than code. It is a fault on
 * our side — it says nothing about the address, so surfacing it leaks nothing,
 * and hiding it turns a broken mail configuration into a silent one. That is
 * not hypothetical: an SMTP password Resend rejected with
 * `535 "Authentication credentials invalid"` sent every customer the
 * "check your email" card while nothing was being sent at all.
 *
 * Deliberately absent: 'user_banned', which IS per-account and would leak.
 */
const SEND_BLOCKED_CODES = new Set([
  'signup_disabled',
  'email_provider_disabled',
  'otp_disabled',
  'email_address_invalid',
  'validation_failed',
]);

export function isMagicLinkSendBlocked(error: CodedError): boolean {
  return SEND_BLOCKED_CODES.has(getMagicLinkErrorCode(error)) || isServerFault(error);
}

/**
 * Lowercased and trimmed, so that `A@x.com ` and `a@x.com` share one
 * rate-limit bucket rather than each getting their own.
 */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/**
 * Enough of a check to catch a typo before it costs a round trip and a slot in
 * the per-address cooldown. Deliberately permissive — the server is the real
 * validator, and an over-strict pattern here rejects addresses that work.
 */
export function isProbablyEmail(value: string | null | undefined): boolean {
  const email = normalizeEmail(value);
  if (email.length < 6 || email.length > 320) return false;
  if (/\s/.test(email)) return false;

  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(email);
}
