import test from 'node:test';
import assert from 'node:assert/strict';

import { clusterSubscribers, placeLabel, summarize, timeAgo } from '../../src/utils/subscriberMap.ts';
import { isPublicIp, parseIpLocation } from '../../supabase/functions/_shared/ipLocation.ts';
import type { SaleSubscriber } from '../../src/types/saleSubscriber.ts';

const NOW = Date.parse('2026-10-20T15:00:00Z');

const sub = (overrides: Partial<SaleSubscriber> = {}): SaleSubscriber => ({
  id: Math.random().toString(36).slice(2),
  name: 'Kurt Zollner',
  email: 'kurt@example.com',
  status: 'active',
  subscribed_at: '2026-10-20T14:00:00Z',
  unsubscribed_at: null,
  city: 'Spring Hill',
  region: 'Tennessee',
  region_code: 'TN',
  country_code: 'US',
  latitude: 35.75,
  longitude: -86.93,
  ...overrides,
});

const unplaced = { city: null, region: null, region_code: null, country_code: null, latitude: null, longitude: null };

test('summary counts only active subscribers and splits them by place', () => {
  const summary = summarize(
    [
      sub(),
      sub({ city: 'Austin', region_code: 'TX', latitude: 30.27, longitude: -97.74, subscribed_at: '2026-10-10T00:00:00Z' }),
      sub(unplaced),
      sub({ status: 'unsubscribed' }),
    ],
    NOW,
  );
  assert.deepEqual(summary, { total: 3, today: 2, inTennessee: 1, elsewhere: 1, unknown: 1 });
});

test('people from the same place share one dot, counted', () => {
  const clusters = clusterSubscribers([
    sub({ subscribed_at: '2026-10-19T00:00:00Z' }),
    sub({ subscribed_at: '2026-10-20T10:00:00Z' }),
    sub({ city: 'Franklin', latitude: 35.92, longitude: -86.87 }),
    sub({ status: 'unsubscribed' }),
    sub(unplaced),
  ]);
  assert.equal(clusters.length, 2);
  const springHill = clusters.find((c) => c.label === 'Spring Hill, TN')!;
  assert.equal(springHill.count, 2);
  assert.equal(springHill.latest, Date.parse('2026-10-20T10:00:00Z'));
});

test('place labels fall back gracefully', () => {
  assert.equal(placeLabel({ city: 'Franklin', region_code: 'TN', region: 'Tennessee', country_code: 'US' }), 'Franklin, TN');
  assert.equal(placeLabel({ city: null, region_code: null, region: 'Ontario', country_code: 'CA' }), 'Ontario');
  assert.equal(placeLabel({ city: null, region_code: null, region: null, country_code: null }), 'Unknown location');
});

test('time ago reads naturally', () => {
  assert.equal(timeAgo('2026-10-20T14:59:40Z', NOW), 'just now');
  assert.equal(timeAgo('2026-10-20T14:55:00Z', NOW), '5m ago');
  assert.equal(timeAgo('2026-10-20T12:00:00Z', NOW), '3h ago');
  assert.equal(timeAgo('2026-10-18T15:00:00Z', NOW), '2d ago');
});

test('private and unusable addresses are never looked up', () => {
  for (const ip of ['10.0.0.4', '192.168.1.9', '172.20.1.1', '127.0.0.1', '::1', 'unknown', '', '999.1.1.1', '100.64.0.1']) {
    assert.equal(isPublicIp(ip), false, ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '2607:f8b0:4009:80b::200e']) {
    assert.equal(isPublicIp(ip), true, ip);
  }
});

test('a lookup answer is read strictly and the coordinates rounded', () => {
  assert.deepEqual(
    parseIpLocation({
      success: true,
      city: ' Spring Hill ',
      region: 'Tennessee',
      region_code: 'TN',
      country_code: 'us',
      latitude: 35.751234,
      longitude: -86.930987,
    }),
    { city: 'Spring Hill', region: 'Tennessee', region_code: 'TN', country_code: 'US', latitude: 35.75, longitude: -86.93 },
  );
  assert.equal(parseIpLocation({ success: false }), null);
  assert.equal(parseIpLocation({ success: true, latitude: 999, longitude: 0, country_code: 'US' }), null);
  assert.equal(parseIpLocation({ success: true, latitude: 1, longitude: 1, country_code: 'USA' }), null);
  assert.equal(parseIpLocation(null), null);
});
