import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCouponPass,
  RELEVANT_DAYS_BEFORE_EXPIRY,
} from '../../supabase/functions/_shared/couponPass.ts';

const OPTIONS = {
  passTypeIdentifier: 'pass.com.boxed2built.coupon',
  teamIdentifier: 'ABCDE12345',
  siteUrl: 'https://boxed2built.com',
  now: new Date('2026-09-01T12:00:00Z'),
};

const FIXED = {
  code: 'WELCOME25',
  description: '$25 off your first assembly',
  discount_type: 'fixed',
  discount_value: 25,
  // Exclusive: the code's last usable day is 30 September.
  ends_at: '2026-10-01T05:00:00.000Z',
};

test('carries the keys Apple requires', () => {
  const pass = buildCouponPass(FIXED, OPTIONS) as Record<string, unknown>;
  for (const key of [
    'formatVersion',
    'passTypeIdentifier',
    'teamIdentifier',
    'organizationName',
    'serialNumber',
    'description',
  ]) {
    assert.ok(pass[key], `pass.json is missing the required key ${key}`);
  }
  assert.equal(pass.formatVersion, 1);
  assert.equal(pass.serialNumber, 'WELCOME25');
});

test('is a coupon-style pass, not a generic one', () => {
  const pass = buildCouponPass(FIXED, OPTIONS) as Record<string, unknown>;
  assert.ok(pass.coupon, 'must use the coupon style');
  assert.equal(pass.generic, undefined);
});

test('shows the same discount wording the site uses', () => {
  const fixed = buildCouponPass(FIXED, OPTIONS) as any;
  assert.equal(fixed.coupon.primaryFields[0].value, '$25 off');

  const percentage = buildCouponPass(
    { ...FIXED, discount_type: 'percentage', discount_value: 10 },
    OPTIONS,
  ) as any;
  assert.equal(percentage.coupon.primaryFields[0].value, '10% off');
});

test('expirationDate uses the raw exclusive instant', () => {
  const pass = buildCouponPass(FIXED, OPTIONS) as Record<string, unknown>;
  assert.equal(pass.expirationDate, '2026-10-01T05:00:00.000Z');
});

test('the readable deadline is the day before ends_at, not ends_at', () => {
  // ends_at is midnight *after* the last valid day, so a customer reading
  // "valid through 1 October" would be wrong by a day.
  const pass = buildCouponPass(FIXED, OPTIONS) as any;
  const expires = pass.coupon.auxiliaryFields.find((f: any) => f.key === 'expires');
  assert.ok(expires, 'expected a VALID THROUGH field');
  assert.match(expires.value, /September 30/);
  assert.doesNotMatch(expires.value, /October/);
});

test('uses relevantDates, not the relevantDate key deprecated in iOS 18', () => {
  const pass = buildCouponPass(FIXED, OPTIONS) as Record<string, unknown>;
  assert.equal(pass.relevantDate, undefined);
  assert.ok(Array.isArray(pass.relevantDates));

  const [window] = pass.relevantDates as Array<{ startDate: string; endDate: string }>;
  const spanDays = (new Date(window.endDate).getTime() - new Date(window.startDate).getTime()) / 86_400_000;
  assert.equal(spanDays, RELEVANT_DAYS_BEFORE_EXPIRY);
});

test('a coupon expiring sooner than the window still gets a valid range', () => {
  const pass = buildCouponPass(FIXED, {
    ...OPTIONS,
    // One day out — less than RELEVANT_DAYS_BEFORE_EXPIRY.
    now: new Date('2026-09-30T05:00:00.000Z'),
  }) as Record<string, unknown>;

  const [window] = pass.relevantDates as Array<{ startDate: string; endDate: string }>;
  assert.ok(
    new Date(window.startDate).getTime() <= new Date(window.endDate).getTime(),
    'startDate must never run past endDate',
  );
});

test('an open-ended coupon carries no expiry keys at all', () => {
  const pass = buildCouponPass({ ...FIXED, ends_at: null }, OPTIONS) as any;
  assert.equal(pass.expirationDate, undefined);
  assert.equal(pass.relevantDates, undefined);
  assert.equal(
    pass.coupon.auxiliaryFields.find((f: any) => f.key === 'expires'),
    undefined,
  );
});

test('the barcode opens the prefilled quote form', () => {
  const pass = buildCouponPass(FIXED, OPTIONS) as any;
  const [barcode] = pass.barcodes;
  assert.equal(barcode.message, 'https://boxed2built.com/contact?coupon=WELCOME25');
  assert.equal(barcode.altText, 'WELCOME25', 'a human must be able to read the code out');
  assert.equal(barcode.format, 'PKBarcodeFormatQR');
});

test('omits the details row when a coupon has no description', () => {
  const pass = buildCouponPass({ ...FIXED, description: null }, OPTIONS) as any;
  assert.equal(pass.coupon.backFields.find((f: any) => f.key === 'details'), undefined);
  assert.ok(pass.coupon.backFields.find((f: any) => f.key === 'howto'));
});
