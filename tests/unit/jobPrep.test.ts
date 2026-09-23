import test from 'node:test';
import assert from 'node:assert/strict';

import { buildJobPrep } from '../../supabase/functions/_shared/jobPrep.ts';

/** Every job type currently in the jobs table, so the real data stays covered. */
const LIVE_JOB_TYPES = [
  'Furniture Assembly',
  'Wall Mounting',
  'Installations',
  'Furniture Assembly + Wall Mounting',
  'Repairs',
  'Table',
];

test('every job type in use produces a non-empty checklist', () => {
  for (const jobType of LIVE_JOB_TYPES) {
    const prep = buildJobPrep(jobType);
    assert.ok(prep.items.length >= 3, `${jobType} produced ${prep.items.length} items`);
    assert.ok(prep.intro.length > 0, `${jobType} has no intro`);
  }
});

test('an unknown or missing type still gets the universal advice', () => {
  for (const jobType of ['Trampoline Setup', '', '   ', null, undefined]) {
    const prep = buildJobPrep(jobType);
    assert.deepEqual(prep.items, [
      'Make sure someone 18 or older is home for the visit.',
      'Let me know where to park and how to get in — a spot near the door saves real time on the trip in.',
      'Secure any pets that might be startled by power tools.',
    ]);
  }
});

test('assembly advice is about boxes, mounting advice is about walls', () => {
  const assembly = buildJobPrep('Furniture Assembly');
  assert.ok(assembly.items.some((item) => item.includes('Move the boxes')));
  assert.ok(!assembly.items.some((item) => item.includes('behind that wall')));

  const mounting = buildJobPrep('Wall Mounting');
  assert.ok(mounting.items.some((item) => item.includes('behind that wall')));
  assert.ok(!mounting.items.some((item) => item.includes('Move the boxes')));
});

test('wall mounting does not assume a TV', () => {
  const mounting = buildJobPrep('Wall Mounting');
  assert.ok(!mounting.items.some((item) => /\bTV\b|soundbar|streaming/.test(item)));

  // ...but TV mounting does get the cable reminder, on top of the wall advice.
  const tv = buildJobPrep('TV Mounting');
  assert.ok(tv.items.some((item) => item.includes('soundbar')));
  assert.ok(tv.items.some((item) => item.includes('behind that wall')));
});

test('a combined job type gets both checklists and says so', () => {
  const both = buildJobPrep('Furniture Assembly + Wall Mounting');
  assert.ok(both.items.some((item) => item.includes('Move the boxes')));
  assert.ok(both.items.some((item) => item.includes('behind that wall')));
  assert.match(both.intro, /a bit to cover/);
});

test('one service with an addendum is not described as two jobs', () => {
  // 'TV Mounting' hits both the mounting rule and the TV addendum.
  assert.equal(buildJobPrep('TV Mounting').intro, 'A few things to have ready before I arrive:');
});

test('a bare furniture noun is still an assembly job', () => {
  assert.ok(buildJobPrep('Table').items.some((item) => item.includes('Move the boxes')));
  assert.ok(buildJobPrep('Crib').items.some((item) => item.includes('Move the boxes')));
});

test('matching ignores case and surrounding text', () => {
  assert.deepEqual(buildJobPrep('  ikea DRESSER assembly  ').items, buildJobPrep('Furniture Assembly').items);
});

test('no advice is ever repeated, even when rules overlap', () => {
  for (const jobType of [...LIVE_JOB_TYPES, 'TV Mounting', 'Furniture Assembly + TV Wall Mounting']) {
    const items = buildJobPrep(jobType).items;
    assert.equal(new Set(items).size, items.length, `${jobType} repeated an item`);
  }
});

test('power is mentioned for real work but not for an unknown type', () => {
  assert.ok(buildJobPrep('Repairs').items.some((item) => item.includes('power outlet')));
  assert.ok(!buildJobPrep('Trampoline Setup').items.some((item) => item.includes('power outlet')));
});
