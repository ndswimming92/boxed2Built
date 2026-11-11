import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describePopupDeadline, normalizePopupSettings, pickHomeCoupon, popupCopy, shouldShowPopup,
  DEFAULT_COUPON_POPUP_SETTINGS,
} from '../../src/utils/couponPopup.ts';

const now = new Date(2026, 10, 11, 10, 0);
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString();
const base = { is_active: true, starts_at: null, ends_at: null, show_on_home: true, created_at: at(2026, 1, 1) };

test('only ticked, live coupons are candidates for the home page', () => {
  assert.equal(pickHomeCoupon([{ ...base, show_on_home: false }], now), null);
  assert.equal(pickHomeCoupon([{ ...base, is_active: false }], now), null);
  assert.equal(pickHomeCoupon([{ ...base, starts_at: at(2026, 11, 22) }], now), null);
  assert.equal(pickHomeCoupon([{ ...base, ends_at: at(2026, 11, 1) }], now), null);
  assert.ok(pickHomeCoupon([base], now));
});

test('the coupon ending soonest wins, and no end date goes last', () => {
  const open = { ...base, id: 'open' };
  const later = { ...base, id: 'later', ends_at: at(2026, 12, 20) };
  const sooner = { ...base, id: 'sooner', ends_at: at(2026, 11, 27) };
  assert.equal(pickHomeCoupon([open, later, sooner], now)?.id, 'sooner');
  assert.equal(pickHomeCoupon([open, later], now)?.id, 'later');
});

test('two open-ended coupons fall back to the newest', () => {
  const older = { ...base, id: 'older' };
  const newer = { ...base, id: 'newer', created_at: at(2026, 6, 1) };
  assert.equal(pickHomeCoupon([older, newer], now)?.id, 'newer');
});

test('the deadline names the last day the code works, not the midnight after', () => {
  // Last day Nov 26 is stored as midnight going into Nov 27.
  assert.equal(describePopupDeadline(at(2026, 11, 27), now), 'Ends Thursday, Nov 26 · 15 days left');
  assert.equal(describePopupDeadline(at(2026, 11, 13), now), 'Ends tomorrow');
  assert.equal(describePopupDeadline(at(2026, 11, 12), now), 'Ends today');
  assert.equal(describePopupDeadline(null, now), null);
});

test('frequency decides whether a returning visitor sees it again', () => {
  const t = Date.now();
  const hour = 3_600_000;
  for (const frequency of ['once_per_coupon', 'once_per_day', 'every_visit'] as const) {
    assert.equal(shouldShowPopup(frequency, null, t), true);
  }
  assert.equal(shouldShowPopup('once_per_coupon', t - 400 * 24 * hour, t), false);
  assert.equal(shouldShowPopup('once_per_day', t - 23 * hour, t), false);
  assert.equal(shouldShowPopup('once_per_day', t - 25 * hour, t), true);
  assert.equal(shouldShowPopup('every_visit', t - 1000, t), true);
});

test('built-in wording is written from the discount, and custom wording replaces it', () => {
  const coupon = { code: 'X', discount_type: 'percentage' as const, discount_value: 15, ends_at: null, headline: null, message: null };
  assert.equal(popupCopy(coupon).headline, 'Save 15% on your next build');
  assert.equal(popupCopy({ ...coupon, headline: '  Hello  ', message: 'Hi' }).headline, 'Hello');
  assert.equal(popupCopy({ ...coupon, headline: '   ' }).headline, 'Save 15% on your next build');
});

test('settings are clamped to what the database accepts', () => {
  const clean = normalizePopupSettings({
    ...DEFAULT_COUPON_POPUP_SETTINGS, delay_seconds: 500, fade_ms: -20, cta_label: '   ',
  });
  assert.equal(clean.delay_seconds, 60);
  assert.equal(clean.fade_ms, 0);
  assert.equal(clean.cta_label, 'Claim my discount');
});
