import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInquiryQuote,
  driveFrom,
  inquiryHours,
  matchPricingGroup,
  parseHours,
  parseMoney,
} from '../../src/utils/inquiryPricing.ts';
import type { PricingGroup } from '../../src/utils/jobMapPricing.ts';

const group = (label: string) => ({ label }) as PricingGroup;

test('reads the hours and the price the form saved as text', () => {
  assert.equal(parseHours('3.5 hours'), 3.5);
  assert.equal(parseHours(''), null);
  assert.equal(parseHours(null), null);
  assert.equal(parseMoney('$1,250'), 1250);
  assert.equal(parseMoney('call us'), null);
});

test('falls back to the catalog time when an inquiry has no estimate', () => {
  assert.equal(inquiryHours({ estimated_time: '2 hours', furniture_type: 'Bed', pieces: 3 }), 2);
  assert.equal(inquiryHours({ estimated_time: null, furniture_type: 'Bed', pieces: 2 }), 6);
  assert.equal(inquiryHours({ estimated_time: null, furniture_type: 'Sofa', pieces: 1 }), null);
});

test('prices time on site at the target rate and adds the round trip', () => {
  // 20 min and 15 miles each way: 40 min at $120/hr = $80, plus 30 miles at $0.70 = $21.
  const quote = buildInquiryQuote({
    hours: 3,
    shownPrice: 280,
    couponAmount: 20,
    targetRate: 120,
    ratePerMile: 0.7,
    drive: driveFrom(20 * 60, 15 * 1609.344),
  })!;

  assert.equal(quote.labor, 360);
  assert.ok(Math.abs(quote.travel! - 101) < 0.01);
  assert.equal(quote.recommended, 460);
  assert.equal(quote.minimumJob, 220);
  // The coupon is added back so the form's price and this one compare like with like.
  assert.equal(quote.shownBeforeCoupon, 300);
  assert.equal(quote.gap, 160);
});

test('leaves travel out, and says so, until there is an address', () => {
  const quote = buildInquiryQuote({ hours: 2, shownPrice: null, couponAmount: 0, targetRate: 100, ratePerMile: 0.7, drive: null })!;
  assert.equal(quote.travel, null);
  assert.equal(quote.recommended, 200);
  assert.equal(quote.gap, null);
});

test('gives no price without hours', () => {
  assert.equal(
    buildInquiryQuote({ hours: null, shownPrice: 200, couponAmount: 0, targetRate: 100, ratePerMile: 0.7, drive: null }),
    null,
  );
});

test('matches the town named in the address, then the drive band', () => {
  const areas = [group('Nashville'), group('East Nashville'), group('Spring Hill'), group('Unknown area')];
  const bands = [group('Under 10 min'), group('20 to 30 min')];
  const drive = driveFrom(25 * 60, null);

  assert.equal(matchPricingGroup('12 Oak St, Spring Hill, TN', drive, areas, bands)?.label, 'Spring Hill');
  assert.equal(matchPricingGroup('4 Elm Ave, east nashville', drive, areas, bands)?.label, 'East Nashville');
  assert.equal(matchPricingGroup('9 Unknown Area Rd, Pulaski', drive, areas, bands)?.label, '20 to 30 min');
  assert.equal(matchPricingGroup('Pulaski, TN', driveFrom(15 * 60, null), areas, bands), null);
  assert.equal(matchPricingGroup(null, null, areas, bands), null);
});
