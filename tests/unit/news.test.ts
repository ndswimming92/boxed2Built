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
  DEFAULT_NEWS_VIEW,
  countSales,
  newsViewToSearch,
  parseNewsView,
  scopeCounts,
  storeOptions,
  storeSlug,
  typeOptions,
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

/* ── Sales filters ─────────────────────────────────────────────────────── */

const SALE_ROWS = [
  { store_name: 'Wayfair', store_slug: 'wayfair', sale_scope: 'online', furniture_types: ['living_room', 'bedroom'], sale_count: 2 },
  { store_name: 'Wayfair', store_slug: 'wayfair', sale_scope: 'online', furniture_types: ['outdoor'], sale_count: 1 },
  { store_name: 'Bassett Home Furnishings', store_slug: 'bassett-home-furnishings', sale_scope: 'local', furniture_types: ['living_room'], sale_count: 1 },
  { store_name: 'IKEA', store_slug: 'ikea', sale_scope: 'online', furniture_types: [], sale_count: 4 },
  { store_name: null, store_slug: null, sale_scope: null, furniture_types: [], sale_count: 1 },
] as Parameters<typeof storeOptions>[0];

test('a store name becomes the same slug the database generates', () => {
  assert.equal(storeSlug('Bassett Home Furnishings'), 'bassett-home-furnishings');
  assert.equal(storeSlug("  Lowe's & Co.  "), 'lowe-s-co');
  assert.equal(storeSlug('IKEA'), 'ikea');
  assert.equal(storeSlug('---'), null);
  assert.equal(storeSlug(null), null);
});

test('the default page link is empty, and a filtered one round-trips', () => {
  assert.equal(newsViewToSearch(DEFAULT_NEWS_VIEW), '');
  assert.deepEqual(parseNewsView(''), { view: DEFAULT_NEWS_VIEW, explicit: false });

  const view = { topic: 'deals', order: 'newest', store: 'wayfair', scope: 'online', type: 'bedroom' } as const;
  const search = newsViewToSearch(view);
  assert.equal(search, '?sort=newest&store=wayfair&where=online&type=bedroom');
  assert.deepEqual(parseNewsView(search), { view, explicit: true });
});

test('news tabs use their own tab name and default order', () => {
  const view = { topic: 'flat_pack', order: 'newest', store: null, scope: null, type: null } as const;
  assert.equal(newsViewToSearch(view), '?tab=flat-pack');
  assert.deepEqual(parseNewsView('?tab=flat-pack').view, view);
  assert.equal(parseNewsView('?tab=all').explicit, true);
});

test('page links that make no sense are ignored, not trusted', () => {
  // Store filters and end-date orders belong to the Sales tab.
  assert.deepEqual(parseNewsView('?tab=all&store=wayfair&sort=ending-soonest').view, {
    topic: 'all', order: 'newest', store: null, scope: null, type: null,
  });
  assert.deepEqual(parseNewsView('?store=Not%20A%20Slug&where=moon&type=castle&tab=nope').view, DEFAULT_NEWS_VIEW);
  assert.equal(parseNewsView('?store=%3Cscript%3E').view.store, null);
});

test('filter options count the live sales that match the other filters', () => {
  assert.equal(countSales(SALE_ROWS), 9);
  assert.equal(countSales(SALE_ROWS, { store: 'wayfair' }), 3);
  assert.equal(countSales(SALE_ROWS, { type: 'living_room' }), 3);

  assert.deepEqual(
    storeOptions(SALE_ROWS).map((store) => [store.slug, store.count]),
    [['ikea', 4], ['wayfair', 3], ['bassett-home-furnishings', 1]],
  );
  // Choosing a type narrows the counts but a chosen store never hides the others.
  assert.deepEqual(
    storeOptions(SALE_ROWS, { type: 'living_room', store: 'wayfair' }).map((store) => [store.slug, store.count]),
    [['wayfair', 2], ['bassett-home-furnishings', 1]],
  );
  assert.deepEqual(scopeCounts(SALE_ROWS, { store: 'wayfair' }), { all: 3, local: 0, online: 3 });
  assert.deepEqual(
    typeOptions(SALE_ROWS, { scope: 'local' }).map((option) => [option.value, option.count]),
    [['living_room', 1]],
  );
});
