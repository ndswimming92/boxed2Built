import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatNewsDate,
  newsCursor,
  safeExternalUrl,
  NEWS_TOPIC_LABELS,
} from '../../src/utils/news.ts';

test('a source date prints as the day it names, not the day before', () => {
  // The unit-test job pins TZ to a negative-offset zone, where parsing a
  // date-only string as UTC would print October 4.
  assert.equal(
    formatNewsDate({ source_published_on: '2026-10-05', published_at: null }),
    'October 5, 2026',
  );
});

test('the source date wins over the date the item was posted here', () => {
  assert.equal(
    formatNewsDate({
      source_published_on: '2026-09-30',
      published_at: '2026-10-06T15:00:00Z',
    }),
    'September 30, 2026',
  );
});

test('falls back to the posted date when the source date is unknown', () => {
  assert.equal(
    formatNewsDate({ source_published_on: null, published_at: '2026-10-06T15:00:00Z' }),
    'October 6, 2026',
  );
});

test('returns null when there is no usable date at all', () => {
  assert.equal(formatNewsDate({ source_published_on: null, published_at: null }), null);
  assert.equal(formatNewsDate({ source_published_on: 'not-a-date', published_at: null }), null);
});

test('only http and https source links are rendered', () => {
  assert.equal(safeExternalUrl('https://example.com/story'), 'https://example.com/story');
  assert.equal(safeExternalUrl('http://example.com/story'), 'http://example.com/story');
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(safeExternalUrl('/relative/path'), null);
  assert.equal(safeExternalUrl(''), null);
  assert.equal(safeExternalUrl(null), null);
});

test('every topic the database allows has a label', () => {
  assert.deepEqual(Object.keys(NEWS_TOPIC_LABELS).sort(), ['flat_pack', 'furniture_assembly']);
});

test('the next page starts from the last story shown', () => {
  assert.deepEqual(
    newsCursor([
      { id: 'a', published_at: '2026-10-06T12:00:00+00:00' },
      { id: 'b', published_at: '2026-10-05T12:00:00+00:00' },
    ]),
    { publishedAt: '2026-10-05T12:00:00+00:00', idsAtCursor: ['b'] },
  );
});

test('stories sharing the last timestamp are all named, so a tie cannot hide one', () => {
  // The next request asks for "at or before" this timestamp and drops these
  // ids. Naming only the very last one would show "b" twice.
  assert.deepEqual(
    newsCursor([
      { id: 'a', published_at: '2026-10-06T12:00:00+00:00' },
      { id: 'b', published_at: '2026-10-05T12:00:00+00:00' },
      { id: 'c', published_at: '2026-10-05T12:00:00+00:00' },
    ]),
    { publishedAt: '2026-10-05T12:00:00+00:00', idsAtCursor: ['b', 'c'] },
  );
});

test('there is no next page to ask for without a story to start from', () => {
  assert.equal(newsCursor([]), null);
  assert.equal(newsCursor([{ id: 'a', published_at: null }]), null);
});
