import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSnapshot, saveSnapshot } from '../../src/utils/newsSnapshot.ts';
import type { NewsItem } from '../../src/types/news.ts';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const item = (id: string, endsOn: string | null = null) => ({ id, ends_on: endsOn }) as NewsItem;
const NOW = Date.parse('2026-10-08T18:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

test('what was saved for a view comes back for that view only', () => {
  const storage = memory();
  saveSnapshot('deals|', [item('a')], 3, NOW, storage);
  assert.deepEqual(loadSnapshot('deals|', NOW, storage)?.items.map((i) => i.id), ['a']);
  assert.equal(loadSnapshot('all|', NOW, storage), null);
});

test('sales that ended since are dropped; nothing current left means nothing to show', () => {
  const storage = memory();
  saveSnapshot('deals|', [item('a', '2026-10-09'), item('b', '2026-10-10')], 2, NOW, storage);
  const later = NOW + 2 * DAY; // October 10 evening, Central: b is still on, a is over
  assert.deepEqual(loadSnapshot('deals|', later, storage)?.items.map((i) => i.id), ['b']);
  assert.equal(loadSnapshot('deals|', NOW + 4 * DAY - 1, storage), null);
});

test('a copy older than three days is not shown', () => {
  const storage = memory();
  saveSnapshot('deals|', [item('a')], 1, NOW, storage);
  assert.notEqual(loadSnapshot('deals|', NOW + 3 * DAY, storage), null);
  assert.equal(loadSnapshot('deals|', NOW + 3 * DAY + 1, storage), null);
});

test('only the six most recent views are kept', () => {
  const storage = memory();
  for (let i = 0; i < 8; i += 1) saveSnapshot(`view-${i}`, [item(`x${i}`)], 1, NOW + i, storage);
  assert.equal(loadSnapshot('view-0', NOW + 8, storage), null);
  assert.equal(loadSnapshot('view-1', NOW + 8, storage), null);
  assert.notEqual(loadSnapshot('view-2', NOW + 8, storage), null);
  assert.notEqual(loadSnapshot('view-7', NOW + 8, storage), null);
});

test('an empty answer clears that view\'s saved copy, and bad storage is ignored', () => {
  const storage = memory();
  saveSnapshot('deals|', [item('a')], 1, NOW, storage);
  saveSnapshot('deals|', [], 0, NOW + 1, storage);
  assert.equal(loadSnapshot('deals|', NOW + 2, storage), null);
  saveSnapshot('other|', [item('b')], 1, NOW, storage);
  saveSnapshot('deals|', [], 0, NOW + 3, storage);
  assert.equal(loadSnapshot('other|', NOW + 4, storage)?.items.length, 1);

  const broken = { getItem: () => '{not json', setItem: () => { throw new Error('full'); } };
  assert.equal(loadSnapshot('deals|', NOW, broken), null);
  assert.doesNotThrow(() => saveSnapshot('deals|', [item('a')], 1, NOW, broken));
  assert.equal(loadSnapshot('deals|', NOW, null), null);
});
