/**
 * Human copy for the two different failure families a passkey ceremony can
 * produce. Kept free of React, of the Supabase client and of import.meta.env
 * on purpose: tests/unit runs under `node --test` with Node's type stripping
 * and no bundler, so a module that reaches import.meta.env (as src/lib/supabase.ts
 * does) cannot be imported there at all. src/services/passkeyService.ts holds
 * everything that does need the client.
 *
 * The two families:
 *
 *  - Server codes from Supabase Auth (AuthError.code) — 'passkey_disabled',
 *    'too_many_passkeys', 'webauthn_verification_failed' and friends. These are
 *    NOT in auth-js's exported ErrorCode union, which only enumerates the stable
 *    codes; AuthError.code is widened to `string` and the server sends these
 *    through. So match on plain strings rather than importing a type.
 *
 *  - Browser ceremony codes from auth-js's own WebAuthnError — 'ERROR_*'. These
 *    come from navigator.credentials.* failing, before or instead of a round
 *    trip, and they carry the diagnostics that matter most in practice: a
 *    cancelled prompt and a relying-party mismatch.
 */

/** Anything with a `code`, which both AuthError and WebAuthnError provide. */
type CodedError = { code?: string | null; message?: string } | null | undefined;

export function getPasskeyErrorCode(error: CodedError): string {
  if (!error || typeof error !== 'object') return '';
  return typeof error.code === 'string' ? error.code : '';
}

/**
 * True when the person simply dismissed the system prompt, or let it time out.
 * This is the single most common outcome after "it worked", and it is not a
 * failure worth putting in a red banner — the caller should quietly re-enable
 * its button and say nothing.
 *
 * `NotAllowedError` is the raw DOMException name; auth-js normally wraps it as
 * ERROR_CEREMONY_ABORTED, but an abort can surface either way depending on
 * where in the ceremony it happened, so both are treated the same.
 */
export function isPasskeyCeremonyCancelled(error: CodedError): boolean {
  const code = getPasskeyErrorCode(error);
  if (code === 'ERROR_CEREMONY_ABORTED') return true;

  const name = (error as { name?: string } | null | undefined)?.name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

const MESSAGES: Record<string, string> = {
  // ── Supabase Auth server codes ──────────────────────────────────────────
  passkey_disabled:
    'Passkeys are not switched on for this site yet. Sign in with Google or your password instead.',
  too_many_passkeys:
    'This account already has the maximum number of passkeys. Remove one before adding another.',
  webauthn_credential_exists:
    'This device already has a passkey for your account. Try signing in with it instead of adding another.',
  webauthn_credential_not_found:
    'That passkey is not registered to any account here. It may have been removed — sign in with Google or your password, then add a new one.',
  webauthn_challenge_not_found:
    'That sign-in attempt has already been used. Please try again.',
  webauthn_challenge_expired:
    'The request timed out before your device answered. Please try again.',
  webauthn_verification_failed:
    'Your device’s response could not be verified. Please try again.',
  email_not_confirmed:
    'Confirm your email address before adding a passkey.',
  phone_not_confirmed:
    'Confirm your phone number before adding a passkey.',
  user_banned:
    'This account is not able to sign in. Please contact us.',
  over_request_rate_limit:
    'Too many attempts. Wait a moment and try again.',

  // ── Browser ceremony codes (auth-js WebAuthnError) ──────────────────────
  // The RP-ID pair below is the expected failure on localhost and on Netlify
  // deploy previews: passkeys are bound to boxed2built.com, and neither host
  // is a subdomain of it. Naming that explicitly saves a long debugging detour.
  ERROR_INVALID_DOMAIN:
    'Passkeys only work on the live boxed2built.com site, not on this address.',
  ERROR_INVALID_RP_ID:
    'Passkeys only work on the live boxed2built.com site, not on this address.',
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED:
    'This device already has a passkey for your account. Try signing in with it instead of adding another.',
  ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT:
    'This security key cannot store a passkey. Try your phone, laptop or password manager instead.',
  ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT:
    'This device cannot confirm it is you. Turn on a PIN, fingerprint or face unlock and try again.',
  ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG:
    'This device is not compatible with passkeys here. Try your phone or a password manager instead.',
  ERROR_AUTHENTICATOR_GENERAL_ERROR:
    'Your device could not complete the request. Please try again.',
  ERROR_CEREMONY_ABORTED:
    'The passkey prompt was dismissed.',
};

const FALLBACK =
  'That did not work. Please try again, or sign in another way.';

/**
 * A sentence safe to show a customer. Never returns the raw error text: these
 * come from the browser and from Supabase, and both lean technical.
 */
export function describePasskeyError(error: CodedError): string {
  const code = getPasskeyErrorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (isPasskeyCeremonyCancelled(error)) return MESSAGES.ERROR_CEREMONY_ABORTED;
  return FALLBACK;
}
