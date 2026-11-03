import test from 'node:test';
import assert from 'node:assert/strict';

import { fundingPeriodEnd, summarizeFunding } from '../../src/services/fundingProgress.ts';

const TODAY = new Date(Date.UTC(2026, 10, 3)); // Nov 3, 2026
const iso = (d: Date) => d.toISOString().slice(0, 10);

test('year-end period ends Dec 31 of the current year', () => {
  assert.equal(iso(fundingPeriodEnd('year-end', TODAY)), '2026-12-31');
});

test('rolling period ends the day before the same date next year', () => {
  assert.equal(iso(fundingPeriodEnd('next-12-months', TODAY)), '2027-11-02');
  assert.equal(iso(fundingPeriodEnd('next-12-months', new Date(Date.UTC(2027, 1, 28)))), '2028-02-27');
  assert.equal(iso(fundingPeriodEnd('next-12-months', new Date(Date.UTC(2028, 1, 29)))), '2029-02-27');
});

test('partially funded reports fraction and shortfall', () => {
  const p = summarizeFunding([{ amount: 10 }, { amount: 10 }], 5, 'year-end', TODAY);
  assert.equal(p.required, 20);
  assert.equal(p.fraction, 0.25);
  assert.equal(p.shortfall, 15);
  assert.equal(p.surplus, 0);
  assert.equal(p.fullyFunded, false);
  assert.equal(p.chargeCount, 2);
});

test('fully funded caps at 100% and reports surplus', () => {
  const p = summarizeFunding([{ amount: 10 }, { amount: 10 }], 100, 'year-end', TODAY);
  assert.equal(p.fraction, 1);
  assert.equal(p.surplus, 80);
  assert.equal(p.fullyFunded, true);
});

test('nothing owed counts as funded; negative balance is treated as zero', () => {
  const none = summarizeFunding([], 0, 'year-end', TODAY);
  assert.equal(none.fraction, 1);
  assert.equal(none.fullyFunded, true);
  const neg = summarizeFunding([{ amount: 10 }], -50, 'year-end', TODAY);
  assert.equal(neg.fraction, 0);
  assert.equal(neg.shortfall, 10);
});

test('cushion is added on top of scheduled charges', () => {
  const p = summarizeFunding([{ amount: 10 }, { amount: 10 }], 15, 'next-12-months', TODAY, 10);
  assert.equal(p.scheduled, 20);
  assert.equal(p.cushion, 10);
  assert.equal(p.required, 30);
  assert.equal(p.fraction, 0.5);
  assert.equal(p.shortfall, 15);
});

test('a cushion alone still needs funding when no charges remain', () => {
  const p = summarizeFunding([], 0, 'year-end', TODAY, 20);
  assert.equal(p.required, 20);
  assert.equal(p.fullyFunded, false);
});
