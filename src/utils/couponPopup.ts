/**
 * Rules for the coupon popup on the home page, kept apart from the component
 * so the public popup, the admin preview and the tests all agree on which
 * coupon shows, what it says and whether this visitor has already seen it.
 */
import { describeDiscount, isRedeemable, type CouponDiscount, type CouponWindow } from './coupon.ts';

export type CouponPopupFrequency = 'once_per_coupon' | 'once_per_day' | 'every_visit';
export type CouponPopupPosition = 'center' | 'corner';

export interface CouponPopupSettings {
  is_enabled: boolean;
  delay_seconds: number;
  fade_ms: number;
  frequency: CouponPopupFrequency;
  position: CouponPopupPosition;
  cta_label: string;
}

/** Matches the column defaults, so "no settings row yet" behaves the same everywhere. */
export const DEFAULT_COUPON_POPUP_SETTINGS: CouponPopupSettings = {
  is_enabled: true,
  delay_seconds: 3,
  fade_ms: 600,
  frequency: 'once_per_coupon',
  position: 'center',
  cta_label: 'Claim my discount',
};

export const POPUP_DELAY_MAX_SECONDS = 60;
export const POPUP_FADE_MAX_MS = 3000;
export const POPUP_CTA_MAX_LENGTH = 40;

/** What the popup needs to draw one coupon. */
export interface CouponPopupContent extends CouponDiscount {
  code: string;
  ends_at: string | null;
  headline: string | null;
  message: string | null;
}

export interface HomeCouponCandidate extends CouponWindow {
  show_on_home: boolean;
  created_at: string;
}

/**
 * The coupon the home page shows: ticked, redeemable now, soonest-ending first.
 * Mirrors the ORDER BY in `get_home_coupon_popup()` so the admin page can say
 * which code visitors are seeing without asking the public function.
 */
export function pickHomeCoupon<T extends HomeCouponCandidate>(coupons: T[], now: Date = new Date()): T | null {
  const live = coupons.filter((c) => c.show_on_home && isRedeemable(c, now));

  live.sort((a, b) => {
    if (a.ends_at && b.ends_at) {
      const byEnd = new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime();
      if (byEnd !== 0) return byEnd;
    } else if (a.ends_at || b.ends_at) {
      return a.ends_at ? -1 : 1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return live[0] ?? null;
}

/** "$25 off" → "$25 OFF", the big line at the top of the popup. */
export function popupOfferLabel(coupon: CouponDiscount): string {
  return describeDiscount(coupon).toUpperCase();
}

/** The wording shown when the admin has not written their own. */
export function popupCopy(coupon: CouponPopupContent): { headline: string; message: string } {
  return {
    headline: coupon.headline?.trim() || `Save ${describeDiscount(coupon).replace(/ off$/, '')} on your next build`,
    message:
      coupon.message?.trim() ||
      'We unbox it, build it, set it where you want it and haul away the packaging. Request your free quote and the discount comes straight off.',
  };
}

/**
 * "Ends Thursday, Nov 26 · 3 days left". `ends_at` is the midnight after the
 * last day, so the day named is the one before it. Null when the code has no
 * end date — there is no deadline to advertise.
 */
export function describePopupDeadline(endsAt: string | null, now: Date = new Date()): string | null {
  if (!endsAt) return null;

  const lastDay = new Date(endsAt);
  lastDay.setDate(lastDay.getDate() - 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round(
    (new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate()).getTime() - today.getTime()) / 86_400_000,
  );

  if (days < 0) return null;
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends tomorrow';

  const date = lastDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return `Ends ${date} · ${days} days left`;
}

/**
 * Whether this visitor should see the popup for this coupon again.
 * `lastSeenAt` is when it was last shown to them (ms), or null for never.
 */
export function shouldShowPopup(
  frequency: CouponPopupFrequency,
  lastSeenAt: number | null,
  now: number = Date.now(),
): boolean {
  if (lastSeenAt === null) return true;
  if (frequency === 'every_visit') return true;
  if (frequency === 'once_per_day') return now - lastSeenAt >= 86_400_000;
  return false;
}

const SEEN_KEY = 'b2b_coupon_popup_seen';

function readSeen(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** When this browser last saw the popup for a code. Null in private mode too. */
export function popupLastSeenAt(code: string): number | null {
  const at = readSeen()[code];
  return typeof at === 'number' ? at : null;
}

export function rememberPopupSeen(code: string, now: number = Date.now()): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [code]: now }));
  } catch {
    // Storage blocked: the popup simply shows again next visit.
  }
}

/** Clamp what the admin typed to what the database will accept. */
export function normalizePopupSettings(input: CouponPopupSettings): CouponPopupSettings {
  const delay = Number.isFinite(input.delay_seconds) ? input.delay_seconds : DEFAULT_COUPON_POPUP_SETTINGS.delay_seconds;
  const fade = Number.isFinite(input.fade_ms) ? input.fade_ms : DEFAULT_COUPON_POPUP_SETTINGS.fade_ms;

  return {
    is_enabled: input.is_enabled,
    delay_seconds: Math.round(Math.min(POPUP_DELAY_MAX_SECONDS, Math.max(0, delay)) * 10) / 10,
    fade_ms: Math.round(Math.min(POPUP_FADE_MAX_MS, Math.max(0, fade))),
    frequency: input.frequency,
    position: input.position,
    cta_label: input.cta_label.trim().slice(0, POPUP_CTA_MAX_LENGTH) || DEFAULT_COUPON_POPUP_SETTINGS.cta_label,
  };
}
