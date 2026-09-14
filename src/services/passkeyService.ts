import type { PasskeyListItem } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  describePasskeyError,
  isPasskeyCeremonyCancelled,
} from '../utils/passkeyErrors';

export type { PasskeyListItem };
export { describePasskeyError, isPasskeyCeremonyCancelled };

/**
 * The one place the app touches Supabase's passkey API. That API is still
 * marked experimental upstream, so keeping every call behind this module means
 * a breaking change upstream is a one-file edit rather than a hunt.
 *
 * Every function here returns `{ data, error }` rather than throwing, matching
 * the shape auth-js itself returns and the shape the rest of src/services uses.
 */

/**
 * Whether this browser can do WebAuthn at all.
 *
 * Deliberately a function, never a module-scope const: vite.config.ts sets
 * ssgOptions.mock: true, so the prerender pass has a fake `window` and a bare
 * `typeof window !== 'undefined'` check passes there while PublicKeyCredential
 * is undefined. Evaluating this at module scope would also run it during
 * `vite-react-ssg build`, which prerenders every public route.
 *
 * Call it from an effect or an event handler, not during render.
 */
export function isPasskeySupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.PublicKeyCredential !== 'function') return false;
  return typeof navigator !== 'undefined' && typeof navigator.credentials?.get === 'function';
}

/**
 * Whether the device has a built-in authenticator (Touch ID, Windows Hello, a
 * phone). Used only to soften copy — a security key still works without one,
 * so never gate the button on this.
 *
 * Both of these are optional-chained: older Safari ships PublicKeyCredential
 * without them.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;

  try {
    return (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()) ?? false;
  } catch {
    return false;
  }
}

/**
 * Enroll a passkey for the user who is already signed in. Supabase requires a
 * confirmed, non-anonymous session here — there is no way to create an account
 * from a passkey alone, which is why the UI only offers this once someone is in.
 */
export async function registerPasskey() {
  return supabase.auth.registerPasskey();
}

/**
 * Sign in with a discoverable credential. The authenticator picks the account,
 * so this takes no email and the caller cannot know in advance which account
 * comes back — callers that care (the admin portal) must check the returned
 * user themselves.
 */
export async function signInWithPasskey() {
  return supabase.auth.signInWithPasskey();
}

export async function listPasskeys() {
  return supabase.auth.passkey.list();
}

/** friendlyName is capped at 120 characters server-side. */
export async function renamePasskey(passkeyId: string, friendlyName: string) {
  return supabase.auth.passkey.update({ passkeyId, friendlyName: friendlyName.slice(0, 120) });
}

export async function deletePasskey(passkeyId: string) {
  return supabase.auth.passkey.delete({ passkeyId });
}
