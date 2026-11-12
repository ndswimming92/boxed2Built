import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areaBreakdown,
  buildInsights,
  buildJobSites,
  driveBreakdown,
  focusBounds,
  heatColor,
  inBounds,
  jobPrice,
  mapAddressKey,
  priceSurface,
  spreadDots,
  summarizeSites,
  type AddressLocation,
} from '../../src/utils/jobMap.ts';

let nextId = 0;
const job = (over: Record<string, unknown>) =>
  ({
    id: `job-${(nextId += 1)}`,
    is_active: true,
    job_status: 'completed',
    date_completed: '2026-06-01',
    client_address: null,
    service_address: null,
    final_price: null,
    quoted_price: null,
    is_free: false,
    location_city: 'Spring Hill',
    ...over,
  }) as never;

const at = (latitude: number, longitude: number, minutes: number | null = null): AddressLocation => ({
  latitude,
  longitude,
  durationSeconds: minutes === null ? null : minutes * 60,
  distanceMeters: minutes === null ? null : minutes * 1000,
  refreshedAt: '2026-11-01T00:00:00Z',
});

test('address keys match the geocode cache: trimmed, single-spaced, lowercased', () => {
  assert.equal(mapAddressKey('  12  Oak St,  Spring Hill '), '12 oak st, spring hill');
  assert.equal(mapAddressKey('   '), null);
  assert.equal(mapAddressKey(null), null);
});

test('price is the final price, then the quote; free and empty jobs have none', () => {
  assert.equal(jobPrice({ final_price: 200, quoted_price: 150, is_free: false }), 200);
  assert.equal(jobPrice({ final_price: null, quoted_price: 150, is_free: false }), 150);
  assert.equal(jobPrice({ final_price: 200, quoted_price: 150, is_free: true }), null);
  assert.equal(jobPrice({ final_price: 0, quoted_price: null, is_free: false }), null);
});

test('jobs at the same address become one site, whichever address field holds it', () => {
  const jobs = [
    job({ client_address: '12 Oak St, Spring Hill', final_price: 100, date_completed: '2026-03-01' }),
    job({ service_address: '12  oak st, spring hill ', client_address: '9 Elm St', final_price: 300, date_completed: '2026-05-01' }),
    job({ client_address: '40 Pine Rd, Franklin', final_price: 400, location_city: 'Franklin' }),
  ];
  const locations = new Map([
    ['12 oak st, spring hill', at(35.75, -86.93, 5)],
    ['40 pine rd, franklin', at(35.92, -86.87, 25)],
  ]);

  const { sites, missingAddress, unlocated, totalJobs } = buildJobSites(jobs, locations);
  assert.equal(totalJobs, 3);
  assert.equal(missingAddress.length, 0);
  assert.equal(unlocated.length, 0);
  assert.equal(sites.length, 2);

  const oak = sites.find((site) => site.key === '12 oak st, spring hill')!;
  assert.equal(oak.jobCount, 2);
  assert.equal(oak.revenue, 400);
  assert.equal(oak.avgPrice, 200);
  assert.equal(oak.lastDate, '2026-05-01');
  assert.equal(oak.driveSeconds, 300);
});

test('only finished, real jobs are mapped; the rest are sorted into why not', () => {
  const jobs = [
    job({ client_address: '1 A St', final_price: 100 }),
    job({ client_address: '2 B St', final_price: 100, job_status: 'quoted', date_completed: null }),
    job({ client_address: '3 C St', final_price: 100, job_status: 'lost' }),
    job({ client_address: '4 D St', final_price: 100, is_test: true }),
    job({ client_address: '  ', final_price: 100 }),
    job({ client_address: '6 F St', final_price: 100 }),
  ];
  const result = buildJobSites(jobs, new Map([['1 a st', at(35.7, -86.9)]]));
  assert.equal(result.totalJobs, 3);
  assert.equal(result.sites.length, 1);
  assert.equal(result.missingAddress.length, 1);
  assert.deepEqual(result.unlocated.map((entry) => entry.address), ['6 F St']);
});

test('free jobs are drawn but stay out of the averages', () => {
  const jobs = [
    job({ client_address: '1 A St', final_price: 300 }),
    job({ client_address: '1 A St', final_price: 0, is_free: true }),
  ];
  const { sites } = buildJobSites(jobs, new Map([['1 a st', at(35.7, -86.9, 10)]]));
  assert.equal(sites[0].jobCount, 2);
  assert.equal(sites[0].pricedCount, 1);
  assert.equal(sites[0].avgPrice, 300);

  const summary = summarizeSites(sites);
  assert.equal(summary.jobs, 2);
  assert.equal(summary.avgPrice, 300);
  assert.equal(summary.repeatAddresses, 1);
  assert.equal(summary.avgDriveMinutes, 10);
  // $300 over two 10-minute trips.
  assert.equal(summary.revenuePerDriveMinute, 15);
});

test('area and drive breakdowns, and the sentences built from them', () => {
  const jobs = [
    job({ client_address: '1 A St', final_price: 100 }),
    job({ client_address: '1 A St', final_price: 200 }),
    job({ client_address: '2 B St', final_price: 400, location_city: 'Franklin' }),
    job({ client_address: '3 C St', final_price: 600, location_city: 'Franklin' }),
  ];
  const locations = new Map([
    ['1 a st', at(35.75, -86.93, 5)],
    ['2 b st', at(35.92, -86.87, 25)],
    ['3 c st', at(35.93, -86.86, 28)],
  ]);
  const { sites } = buildJobSites(jobs, locations);

  const areas = areaBreakdown(sites);
  assert.deepEqual(areas.map((area) => [area.label, area.jobs, area.avgPrice]), [
    ['Franklin', 2, 500],
    ['Spring Hill', 2, 150],
  ]);

  const drives = driveBreakdown(sites);
  assert.deepEqual(drives.map((band) => [band.label, band.jobs, band.avgPrice]), [
    ['Under 10 min', 2, 150],
    ['20 to 30 min', 2, 500],
  ]);

  const insights = buildInsights(sites, (amount) => `$${amount}`);
  assert.match(insights[0], /^Franklin pays best: \$500 .* against \$150 in Spring Hill/);
  assert.ok(insights.some((line) => line.startsWith('1 of 3 addresses had you back more than once')));
  assert.ok(insights.some((line) => line.startsWith('Longer drives are paying more')));
});

test('the service-area frame ignores one far-away job and never collapses to a point', () => {
  const local = [
    { latitude: 35.75, longitude: -86.93 },
    { latitude: 35.62, longitude: -87.03 },
    { latitude: 35.92, longitude: -86.87 },
  ];
  const memphis = { latitude: 35.15, longitude: -90.05 };
  const bounds = focusBounds([...local, memphis])!;
  assert.ok(local.every((point) => inBounds(point, bounds)));
  assert.equal(inBounds(memphis, bounds), false);

  const single = focusBounds([local[0]])!;
  assert.ok(single.north - single.south > 0.15);
  assert.ok(single.east - single.west > 0.15);
  assert.equal(focusBounds([]), null);
});

test('average-price heat follows price, not how many jobs there are', () => {
  // Five cheap jobs on the left, one expensive job on the right.
  const points = [
    ...Array.from({ length: 5 }, () => ({ x: 20, y: 20, value: 50 })),
    { x: 180, y: 20, value: 500 },
  ];
  const cellAt = (surface: ReturnType<typeof priceSurface>, x: number) =>
    surface.cells.find((cell) => cell.x === x && cell.y === 16)!;

  const avg = priceSurface(points, 200, 40, 8, 12, 'avg');
  assert.equal(avg.min, 50);
  assert.equal(avg.max, 500);
  assert.ok(cellAt(avg, 16).t < 0.05);
  assert.ok(cellAt(avg, 176).t > 0.95);
  // Nothing is painted far from any job.
  assert.equal(avg.cells.find((cell) => cell.x === 96), undefined);

  const total = priceSurface(points, 200, 40, 8, 12, 'total');
  assert.ok(cellAt(total, 176).t > cellAt(total, 16).t);
  assert.deepEqual(priceSurface([], 200, 40, 8, 12, 'avg').cells, []);
});

test('heat colours run blue to red and clamp out-of-range input', () => {
  assert.equal(heatColor(0), 'rgb(37,99,235)');
  assert.equal(heatColor(1), 'rgb(239,68,68)');
  assert.equal(heatColor(-1), heatColor(0));
  assert.equal(heatColor(2), heatColor(1));
});

test('overlapping dots are pushed apart; dots with room stay put', () => {
  const [a, b, far] = spreadDots([
    { x: 100, y: 100, radius: 10 },
    { x: 100, y: 100, radius: 6 },
    { x: 300, y: 100, radius: 5 },
  ]);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 10 + 6 + 3 - 0.01);
  assert.ok(Math.hypot(a.x - 100, a.y - 100) < 20);
  assert.deepEqual([far.x, far.y], [300, 100]);
});
