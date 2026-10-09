import test from 'node:test';
import assert from 'node:assert/strict';

import {
  competitorLinks,
  isNewThisWeek,
  isWatchStale,
  lastRanOn,
  mailtoHref,
  matchesCompetitorSearch,
  sortActionItems,
  sortCompetitors,
  telHref,
  websiteLabel,
} from '../../src/utils/competitors.ts';

const TODAY = '2026-10-12';

test('the checklist puts the highest impact first, and the quickest among equals', () => {
  const item = (title: string, priority: string, effort: string, created_at = '2026-10-12T11:00:00Z') => ({
    title,
    priority,
    effort,
    created_at,
    status_changed_at: null,
  });
  const sorted = sortActionItems(
    [
      item('low quick', 'low', 'quick'),
      item('high big', 'high', 'big'),
      item('medium quick', 'medium', 'quick'),
      item('high quick', 'high', 'quick'),
      item('high quick, older', 'high', 'quick', '2026-10-05T11:00:00Z'),
    ] as never,
    'open',
  );
  assert.deepEqual(
    sorted.map((row: { title: string }) => row.title),
    ['high quick', 'high quick, older', 'high big', 'medium quick', 'low quick'],
  );
});

test('done and removed items list the most recently changed first', () => {
  const item = (title: string, status_changed_at: string | null) => ({
    title,
    priority: 'high',
    effort: 'quick',
    created_at: '2026-10-01T00:00:00Z',
    status_changed_at,
  });
  const rows = [
    item('yesterday', '2026-10-11T15:00:00Z'),
    item('never stamped', null),
    item('today', '2026-10-12T09:00:00Z'),
  ] as never;
  assert.deepEqual(
    sortActionItems(rows, 'done').map((row: { title: string }) => row.title),
    ['today', 'yesterday', 'never stamped'],
  );
});

test('sorting leaves the list it was given alone', () => {
  const rows = [
    { title: 'b', priority: 'low', effort: 'big', created_at: '', status_changed_at: null },
    { title: 'a', priority: 'high', effort: 'quick', created_at: '', status_changed_at: null },
  ] as never[];
  sortActionItems(rows, 'open');
  assert.equal((rows[0] as { title: string }).title, 'b');
});

test('competitors list local businesses first, then platforms, retailers and out-of-area', () => {
  const sorted = sortCompetitors([
    { name: 'Zeta Elsewhere', category: 'out_of_area' },
    { name: 'IKEA', category: 'retailer' },
    { name: 'Taskrabbit', category: 'platform' },
    { name: 'beta Assembly', category: 'local' },
    { name: 'Alpha Assembly', category: 'local' },
  ] as never);
  assert.deepEqual(
    sorted.map((row: { name: string }) => row.name),
    ['Alpha Assembly', 'beta Assembly', 'Taskrabbit', 'IKEA', 'Zeta Elsewhere'],
  );
});

test('new means first saved within the last week, judged in Central time', () => {
  assert.equal(isNewThisWeek('2026-10-12T11:00:00Z', TODAY), true);
  assert.equal(isNewThisWeek('2026-10-06T12:00:00Z', TODAY), true);
  assert.equal(isNewThisWeek('2026-10-05T12:00:00Z', TODAY), false);
  // 03:00 UTC on the 6th is still the evening of the 5th in Tennessee.
  assert.equal(isNewThisWeek('2026-10-06T03:00:00Z', TODAY), false);
  assert.equal(isNewThisWeek('not a date', TODAY), false);
});

test('search covers the name, town, owner, email and what they offer', () => {
  const competitor = {
    name: 'Example Assembly Co.',
    summary: 'A two-person crew.',
    location: 'Franklin, TN',
    owner_name: 'Jordan Example',
    email: 'hello@example.com',
    services: 'Furniture assembly\nTV mounting',
    pricing: 'From $65 an item',
    standout: 'Same-day booking',
    service_area: null,
  };
  for (const term of ['example assembly', 'FRANKLIN', 'jordan', 'hello@', 'tv mounting', '$65', 'same-day', '  ']) {
    assert.equal(matchesCompetitorSearch(competitor, term), true, term);
  }
  assert.equal(matchesCompetitorSearch(competitor, 'plumbing'), false);
});

test('only labelled http(s) links survive, once each', () => {
  assert.deepEqual(
    competitorLinks([
      { label: 'Facebook', url: 'https://facebook.com/example' },
      { label: 'Facebook again', url: 'https://facebook.com/example' },
      { label: 'Bad', url: 'javascript:alert(1)' },
      { label: 'Also bad', url: 'data:text/html,hi' },
      { url: 'https://www.example.com/reviews' },
      { label: 42, url: 'https://example.org/' },
      { label: 'No url' },
      'https://example.net',
      null,
    ]),
    [
      { label: 'Facebook', url: 'https://facebook.com/example' },
      { label: 'example.com', url: 'https://www.example.com/reviews' },
      { label: 'example.org', url: 'https://example.org/' },
    ],
  );
});

test('links saved in any other shape are ignored rather than trusted', () => {
  assert.deepEqual(competitorLinks(null), []);
  assert.deepEqual(competitorLinks('https://example.com'), []);
  assert.deepEqual(competitorLinks({ label: 'x', url: 'https://example.com' }), []);
});

test('a website is shown by its host name', () => {
  assert.equal(websiteLabel('https://www.example.com/about?x=1'), 'example.com');
  assert.equal(websiteLabel('http://shop.example.com'), 'shop.example.com');
  assert.equal(websiteLabel('javascript:alert(1)'), null);
  assert.equal(websiteLabel(null), null);
});

test('an email becomes a mailto link only when it is one plain address', () => {
  assert.equal(mailtoHref('hello@example.com'), 'mailto:hello@example.com');
  assert.equal(mailtoHref('  first.last+tag@example.co.uk '), 'mailto:first.last%2Btag@example.co.uk');
  // Nothing saved may add a second recipient, a subject or a body.
  assert.equal(mailtoHref('a@example.com,b@example.com'), null);
  assert.equal(mailtoHref('a@example.com?subject=hi'), 'mailto:a@example.com%3Fsubject%3Dhi');
  assert.equal(mailtoHref('Jordan <jordan@example.com>'), null);
  assert.equal(mailtoHref('not an email'), null);
  assert.equal(mailtoHref(null), null);
});

test('a phone number becomes a tel link, without its extension', () => {
  assert.equal(telHref('(615) 555-0100'), 'tel:6155550100');
  assert.equal(telHref('+1 615-555-0100'), 'tel:+16155550100');
  assert.equal(telHref('615-555-0100 ext. 12'), 'tel:6155550100');
  assert.equal(telHref('call us'), null);
  assert.equal(telHref('12345'), null);
  assert.equal(telHref(null), null);
});

test('the last run is the newest day either list was confirmed', () => {
  assert.equal(
    lastRanOn([{ last_verified_on: '2026-10-05' }, { last_verified_on: '2026-10-12' }], [{ last_seen_on: '2026-10-05' }]),
    '2026-10-12',
  );
  assert.equal(lastRanOn([], [{ last_seen_on: '2026-10-05' }]), '2026-10-05');
  assert.equal(lastRanOn([], []), null);
});

test('a weekly check is only called stale once it has clearly missed a week', () => {
  assert.equal(isWatchStale('2026-10-05', TODAY), false);
  assert.equal(isWatchStale('2026-10-02', TODAY), false);
  assert.equal(isWatchStale('2026-10-01', TODAY), true);
  assert.equal(isWatchStale(null, TODAY), false);
});
