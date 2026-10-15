import test from 'node:test';
import assert from 'node:assert/strict';

import { DIY_TIME_SAVINGS, estimateTimeSaved, formatHoursRange } from '../../src/utils/diyTimeSavings.ts';

test('every range is positive and ordered', () => {
  for (const [id, e] of Object.entries(DIY_TIME_SAVINGS)) {
    assert.ok(e.diyHours[0] > 0 && e.diyHours[0] <= e.diyHours[1], id);
  }
});

test('quantities scale the range and unknown ids are ignored', () => {
  assert.deepEqual(estimateTimeSaved({ Chair: 4, Nope: 3, Bed: 0 }), { low: 4, high: 6 });
  assert.deepEqual(estimateTimeSaved({}), { low: 0, high: 0 });
});

test('formatting', () => {
  assert.equal(formatHoursRange({ low: 2, high: 4 }), '2–4 hours');
  assert.equal(formatHoursRange({ low: 1, high: 1 }), '1 hour');
  assert.equal(formatHoursRange({ low: 1, high: 1.5 }), '1–1.5 hours');
  assert.equal(formatHoursRange({ low: 0, high: 0 }), '');
});
