/**
 * Per-client referral QR codes.
 *
 * Every client already has a `referral_code` (`B2B-ADRIA-4F7D`) assigned by a
 * database trigger. This turns that code into a scannable link, so a client can
 * hand someone a printed token instead of reciting the code.
 *
 * Two rules here exist because the codes get printed on physical objects that
 * cannot be corrected afterwards:
 *
 *  1. The URL is built from SITE_URL, never `window.location.origin`. A code
 *     generated while running locally would otherwise encode `localhost:5173`.
 *  2. The QR points at `/r/<code>`, not straight at the contact form, so where
 *     a scan lands stays changeable long after the tokens are made.
 */
import { supabase } from '../lib/supabase';
import { SITE_URL } from '../constants/serviceLocations';

/** Survives a visitor wandering off the contact page before submitting. */
const REFERRAL_STORAGE_KEY = 'boxed2built.referral_code';

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** The human-facing link - for texting, emailing, or a "copy link" button. */
export function getReferralLandingURL(code: string): string {
  return `${SITE_URL}/r/${normalizeReferralCode(code)}`;
}

/**
 * The string the QR itself encodes. Uppercase on purpose: it keeps the payload
 * inside QR alphanumeric mode, which at error-correction H fits this URL into a
 * 33x33 symbol instead of the 37x37 that mixed case forces into byte mode.
 * Chunkier squares survive a 0.4mm nozzle, and the difference is free.
 *
 * Safe because hosts are case-insensitive, React Router matches static path
 * segments case-insensitively, and `public/_redirects` lists `/R/*` alongside
 * `/r/*` so Netlify does not 404 before the app loads.
 */
export function getReferralQRPayload(code: string): string {
  return getReferralLandingURL(code).toUpperCase();
}

/**
 * Records a scan. The RPC returns nothing whether or not the code matched, so
 * this cannot be used to probe which referral codes exist.
 */
export async function logReferralScan(params: {
  code: string;
  userAgent?: string;
  referrer?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('log_referral_scan', {
    p_code: normalizeReferralCode(params.code),
    p_user_agent: params.userAgent ?? '',
    p_referrer: params.referrer ?? ''
  });

  if (error) {
    // Analytics must never cost someone their referral. Log and move on.
    console.warn('[referralQR] Scan logging failed:', error.message);
  }
}

export function rememberReferralCode(code: string): void {
  try {
    sessionStorage.setItem(REFERRAL_STORAGE_KEY, normalizeReferralCode(code));
  } catch {
    // Private browsing or blocked storage. The URL param still works.
  }
}

export function recallReferralCode(): string | null {
  try {
    return sessionStorage.getItem(REFERRAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function forgetReferralCode(): void {
  try {
    sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}
