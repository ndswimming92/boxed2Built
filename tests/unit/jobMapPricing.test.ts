import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJobSites, type AddressLocation } from '../../src/utils/jobMap.ts';
import { areaPricing, drivePricing, overallPricing, pricingAdvice } from '../../src/utils/jobMapPricing.ts';

let nextId = 0;
const job = (address: string, city: string, price: number, hours: number, date: string, over: Record<string, unknown> = {}) =>
  ({
    id: `job-${(nextId += 1)}`,
    is_active: true,
    job_status: 'completed',
    date_completed: date,
    client_address: address,
    service_address: null,
    final_price: price,
    quoted_price: price,
    materials_cost: 0,
    hours_worked: hours,
    is_free: false,
    location_city: city,
    ...over,
  }) as never;

/** `minutes` one way, at a mile a minute. */
const at = (minutes: number): AddressLocation => ({
  latitude: 35.7,
  longitude: -86.9,
  durationSeconds: minutes * 60,
  distanceMeters: minutes * 1609.344,
  refreshedAt: '2026-11-01T00:00:00Z',
});

const inputs = { targetRate: 60, ratePerMile: 0.5 };
const money = (amount: number) => `$${Math.round(amount)}`;

// Near: 3 jobs of 2h at $120 ($60/hr on site), 6 min each way.
// Far:  3 jobs of 2h at $120, 30 min each way.
// Low:  3 jobs of 2h at $80 ($40/hr on site), 6 min each way.
const jobs = [
  job('1 Near St', 'Near', 120, 2, '2026-01-01'),
  job('1 Near St', 'Near', 120, 2, '2026-02-01'),
  job('2 Near St', 'Near', 120, 2, '2026-03-01'),
  job('1 Far Rd', 'Far', 120, 2, '2026-01-01'),
  job('1 Far Rd', 'Far', 120, 2, '2026-02-01'),
  job('1 Far Rd', 'Far', 120, 2, '2026-03-01'),
  job('1 Low Ln', 'Low', 80, 2, '2026-01-01'),
  job('1 Low Ln', 'Low', 80, 2, '2026-02-01'),
  job('1 Low Ln', 'Low', 80, 2, '2026-03-01'),
  job('1 New Way', 'New', 500, 2, '2026-03-01'),
];
const locations = new Map([
  ['1 near st', at(6)],
  ['2 near st', at(6)],
  ['1 far rd', at(30)],
  ['1 low ln', at(6)],
  ['1 new way', at(6)],
]);
const { sites } = buildJobSites(jobs, locations);
const area = (label: string) => areaPricing(sites, inputs).find((group) => group.label === label)!;

test('the true rate counts round-trip driving time and mileage', () => {
  const far = area('Far');
  assert.equal(far.jobs, 3);
  assert.equal(far.visits, 3);
  assert.equal(far.onSiteRate, 60);
  // 3 visits x 1h round trip = 3h driving; 3 x 60 miles x $0.50 = $90 mileage.
  assert.equal(far.travelHours, 3);
  assert.equal(far.mileageCost, 90);
  // ($360 - $90) / (6h + 3h)
  assert.equal(far.trueRate, 30);
  // One visit: 1h at $60 + 60 miles at $0.50.
  assert.equal(far.travelCharge, 90);
  assert.equal(far.minimumJob, 150);
});

test('verdicts: hold when on target after travel, travel charge when only the drive hurts, raise when base is low', () => {
  // Raise a little so the short drive still clears target within tolerance.
  const closeEnough = areaPricing(sites, { targetRate: 52, ratePerMile: 0.5 }).find((group) => group.label === 'Near')!;
  assert.equal(closeEnough.verdict, 'hold');

  const far = area('Far');
  assert.equal(far.verdict, 'travel');
  assert.equal(far.baseRaisePct, 0);
  assert.match(pricingAdvice(far, inputs, money), /Add about \$90 a visit for travel/);

  const low = area('Low');
  assert.equal(low.verdict, 'raise');
  // Needs $360 for 6 hours, took $240.
  assert.equal(low.baseRaisePct, 0.5);
  assert.equal(low.baseRaisePerJob, 40);
  assert.match(pricingAdvice(low, inputs, money), /Raise them about 50% \(around \$40 on an average job\)/);
});

test('an area with under three jobs gets figures but no price advice', () => {
  const fresh = area('New');
  assert.equal(fresh.verdict, 'thin');
  assert.match(pricingAdvice(fresh, inputs, money), /^Only 1 priced job here so far/);
  // Thin areas sort last; the biggest problem sorts first.
  const order = areaPricing(sites, inputs).map((group) => group.label);
  assert.equal(order[0], 'Low');
  assert.equal(order[order.length - 1], 'New');
});

test('two jobs at one address on the same day are one trip', () => {
  const sameDay = [
    job('1 Near St', 'Near', 100, 1, '2026-05-01'),
    job('1 Near St', 'Near', 100, 1, '2026-05-01'),
    job('1 Near St', 'Near', 100, 1, '2026-05-02'),
  ];
  const [group] = areaPricing(buildJobSites(sameDay, locations).sites, inputs);
  assert.equal(group.jobs, 3);
  assert.equal(group.visits, 2);
});

test('free jobs, jobs with no hours and addresses with no drive time are left out', () => {
  const mixed = [
    job('1 Near St', 'Near', 100, 1, '2026-05-01'),
    job('1 Near St', 'Near', 0, 2, '2026-05-02', { is_free: true }),
    job('1 Near St', 'Near', 100, 0, '2026-05-03'),
    job('9 Lost Ct', 'Near', 100, 1, '2026-05-04'),
  ];
  const noDrive = new Map([...locations, ['9 lost ct', { ...at(6), durationSeconds: null, distanceMeters: null }]]);
  const overall = overallPricing(buildJobSites(mixed, noDrive).sites, inputs)!;
  assert.equal(overall.jobs, 1);
  assert.equal(overall.visits, 1);
  assert.equal(overallPricing([], inputs), null);
});

test('materials come off before the rate, and quotes that ran over are called out', () => {
  const overQuote = [
    job('1 Near St', 'Near', 150, 2, '2026-05-01', { quoted_price: 100, materials_cost: 30 }),
    job('1 Near St', 'Near', 150, 2, '2026-05-02', { quoted_price: 100, materials_cost: 30 }),
    job('1 Near St', 'Near', 150, 2, '2026-05-03', { quoted_price: 100, materials_cost: 30 }),
  ];
  const [group] = areaPricing(buildJobSites(overQuote, locations).sites, inputs);
  assert.equal(group.onSiteRate, 60);
  assert.equal(group.quoteDriftPct, 0.5);
  assert.match(pricingAdvice(group, inputs, money), /ran 50% over your quotes, so quote higher up front/);
});

test('travel charge by drive time is ordered nearest first', () => {
  const bands = drivePricing(sites, inputs);
  assert.deepEqual(bands.map((band) => [band.label, band.travelCharge]), [
    // 12 min round trip at $60/hr = $12, plus 12 miles at $0.50 = $6: $18, to the nearest $5.
    ['Under 10 min', 20],
    ['Over 30 min', 90],
  ]);
});
