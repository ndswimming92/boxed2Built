import test from 'node:test';
import assert from 'node:assert/strict';

import {
  centralToday,
  endingAfterCondition,
  formatEndsOn,
  formatNewsDate,
  isEndingOrder,
  isNewsExpired,
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
  assert.deepEqual(Object.keys(NEWS_TOPIC_LABELS).sort(), ['deals', 'flat_pack', 'furniture_assembly']);
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

test('an end-date order starts after the last sale shown, by its end date and id', () => {
  assert.deepEqual(
    newsCursor(
      [
        { id: 'a', published_at: '2026-10-06T12:00:00+00:00', ends_on: '2026-10-08' },
        { id: 'b', published_at: '2026-10-05T12:00:00+00:00', ends_on: '2026-10-09' },
      ],
      'ending_soonest',
    ),
    { publishedAt: '2026-10-05T12:00:00+00:00', idsAtCursor: ['b'], endsOn: '2026-10-09' },
  );
  // A sale with no end date is a cursor too, so paging can continue past the dated ones.
  assert.deepEqual(
    newsCursor([{ id: 'c', published_at: '2026-10-04T12:00:00+00:00', ends_on: null }], 'ending_latest'),
    { publishedAt: '2026-10-04T12:00:00+00:00', idsAtCursor: ['c'], endsOn: null },
  );
});

test('after a dated sale: a later end date, a same-day tie broken by posted date and id, or no end date', () => {
  const cursor = { publishedAt: '2026-10-05T12:00:00+00:00', idsAtCursor: ['b'], endsOn: '2026-10-09' };
  assert.equal(
    endingAfterCondition('ending_soonest', cursor),
    'ends_on.gt.2026-10-09,' +
      'and(ends_on.eq.2026-10-09,published_at.lt.2026-10-05T12:00:00+00:00),' +
      'and(ends_on.eq.2026-10-09,published_at.eq.2026-10-05T12:00:00+00:00,id.lt.b),' +
      'ends_on.is.null',
  );
});

test('ending latest looks for earlier end dates after a dated sale', () => {
  const cursor = { publishedAt: '2026-10-05T12:00:00+00:00', idsAtCursor: ['b'], endsOn: '2026-10-09' };
  assert.ok(endingAfterCondition('ending_latest', cursor).startsWith('ends_on.lt.2026-10-09,'));
});

test('after a sale with no end date only other undated sales can follow', () => {
  const cursor = { publishedAt: '2026-10-04T12:00:00+00:00', idsAtCursor: ['c'], endsOn: null };
  assert.equal(
    endingAfterCondition('ending_soonest', cursor),
    'and(ends_on.is.null,published_at.lt.2026-10-04T12:00:00+00:00),' +
      'and(ends_on.is.null,published_at.eq.2026-10-04T12:00:00+00:00,id.lt.c)',
  );
});

test('only the end-date orders count as end-date orders', () => {
  assert.equal(isEndingOrder('ending_soonest'), true);
  assert.equal(isEndingOrder('ending_latest'), true);
  assert.equal(isEndingOrder('newest'), false);
  assert.equal(isEndingOrder('oldest'), false);
});

test('a deal shows through its end date and expires the next day (Central time)', () => {
  const deal = { ends_on: '2026-10-12' };
  // Oct 12, 11:30pm Central (CDT, UTC-5) is still the end date.
  assert.equal(isNewsExpired(deal, new Date('2026-10-13T04:30:00Z')), false);
  // Oct 13, 12:30am Central is the day after.
  assert.equal(isNewsExpired(deal, new Date('2026-10-13T05:30:00Z')), true);
});

test('a deal with no end date never expires', () => {
  assert.equal(isNewsExpired({ ends_on: null }, new Date('2030-01-01T00:00:00Z')), false);
});

test('centralToday uses Central time, not UTC', () => {
  assert.equal(centralToday(new Date('2026-10-13T03:00:00Z')), '2026-10-12');
});

test('formatEndsOn prints the named day', () => {
  assert.equal(formatEndsOn('2026-10-12'), 'October 12, 2026');
  assert.equal(formatEndsOn(null), null);
});
