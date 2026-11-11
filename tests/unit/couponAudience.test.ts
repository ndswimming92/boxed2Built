import test from 'node:test';
import assert from 'node:assert/strict';

import { couponAudience, matchesCouponSearch } from '../../src/utils/coupon.ts';

test('a code a partner lead points at is a partner code', () => {
  assert.equal(couponAudience({ id: 'a', description: null }, new Set(['a'])), 'partner');
});

test('the partner flow description marks a partner code with no link', () => {
  assert.equal(couponAudience({ id: 'b', description: 'Partner code for The Fountains' }, new Set()), 'partner');
});

test('everything else is a customer code', () => {
  assert.equal(couponAudience({ id: 'c', description: 'Welcome offer' }, new Set(['a'])), 'customer');
  assert.equal(couponAudience({ id: 'd', description: null }, new Set()), 'customer');
});

test('search matches code, description and partner name, ignoring case', () => {
  const coupon = { code: 'SYDNEYCOLLINS', description: 'Partner code for Sydney Collins Realty' };
  assert.ok(matchesCouponSearch(coupon, 'sydney'));
  assert.ok(matchesCouponSearch(coupon, 'realty'));
  assert.ok(matchesCouponSearch({ code: 'X1', description: null }, 'acme', 'Acme Homes'));
  assert.ok(!matchesCouponSearch(coupon, 'thankful'));
  assert.ok(matchesCouponSearch(coupon, '   '));
});
