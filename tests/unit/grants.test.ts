import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closingSoonLabel,
  daysBetween,
  daysUntilDeadline,
  deadlineParts,
  formatGrantOpens,
  grantBucket,
  isClosingSoon,
  isNewGrant,
  isStale,
  lastCheckedOn,
  matchesGrantSearch,
  sortGrants,
  splitAmount,
  toPoints,
  upcomingDeadlineDetail,
} from '../../src/utils/grants.ts';

const TODAY = '2026-10-08';

test('a grant stays open through its deadline day and closes the day after', () => {
  assert.equal(grantBucket({ cycle_status: 'open', deadline: '2026-10-08' }, TODAY), 'open');
  assert.equal(grantBucket({ cycle_status: 'open', deadline: '2026-10-07' }, TODAY), 'closed');
});

test('a passed deadline closes a grant even though the finder last saw it open', () => {
  // The finder records what it saw on the day it looked. Nothing should sit
  // under "Open now" with a deadline behind it while waiting for the next run.
  assert.equal(grantBucket({ cycle_status: 'open', deadline: '2026-09-30' }, TODAY), 'closed');
  assert.equal(grantBucket({ cycle_status: 'upcoming', deadline: '2026-09-30' }, TODAY), 'closed');
});

test('rolling and undated grants stay open, and the finder can close one outright', () => {
  assert.equal(grantBucket({ cycle_status: 'open', deadline: null }, TODAY), 'open');
  assert.equal(grantBucket({ cycle_status: 'upcoming', deadline: null }, TODAY), 'upcoming');
  assert.equal(grantBucket({ cycle_status: 'closed', deadline: '2026-12-01' }, TODAY), 'closed');
});

test('days are counted on the calendar, across a month end and a clock change', () => {
  assert.equal(daysBetween('2026-10-08', '2026-10-08'), 0);
  assert.equal(daysBetween('2026-10-08', '2026-11-08'), 31);
  // US clocks go back on 2026-11-01; a 25-hour day must still count as one.
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2);
  assert.equal(daysBetween('2026-10-08', 'soon'), null);
});

test('closing soon covers the next two weeks and nothing else', () => {
  assert.equal(isClosingSoon({ cycle_status: 'open', deadline: '2026-10-22' }, TODAY), true);
  assert.equal(isClosingSoon({ cycle_status: 'open', deadline: '2026-10-23' }, TODAY), false);
  assert.equal(isClosingSoon({ cycle_status: 'open', deadline: null }, TODAY), false);
  // Already closed, or not open yet: there is nothing to hurry for.
  assert.equal(isClosingSoon({ cycle_status: 'open', deadline: '2026-10-01' }, TODAY), false);
  assert.equal(isClosingSoon({ cycle_status: 'upcoming', deadline: '2026-10-15' }, TODAY), false);
});

test('the closing label names the day plainly', () => {
  assert.equal(closingSoonLabel({ cycle_status: 'open', deadline: '2026-10-08' }, TODAY), 'Closes today');
  assert.equal(closingSoonLabel({ cycle_status: 'open', deadline: '2026-10-09' }, TODAY), 'Closes tomorrow');
  assert.equal(closingSoonLabel({ cycle_status: 'open', deadline: '2026-10-17' }, TODAY), 'Closes in 9 days');
  assert.equal(closingSoonLabel({ cycle_status: 'open', deadline: '2026-12-31' }, TODAY), null);
  assert.equal(daysUntilDeadline({ deadline: '2026-10-01' }, TODAY), null);
});

test('a grant is new for a week, judged by the Central-time day it was saved', () => {
  // 03:30 UTC on Oct 2 is still Oct 1 in Spring Hill, which makes it seven
  // days old on Oct 8, not six.
  assert.equal(isNewGrant({ created_at: '2026-10-02T03:30:00Z' }, TODAY), false);
  assert.equal(isNewGrant({ created_at: '2026-10-02T15:00:00Z' }, TODAY), true);
  assert.equal(isNewGrant({ created_at: '2026-10-08T12:00:00Z' }, TODAY), true);
  assert.equal(isNewGrant({ created_at: 'not a date' }, TODAY), false);
});

test('the deadline prints as the day it names, with the funder wording kept apart from it', () => {
  // The unit-test job pins TZ to a negative-offset zone, where parsing a
  // date-only string as UTC would print October 30.
  assert.deepEqual(deadlineParts({ deadline: '2026-10-31', deadline_note: null }), {
    headline: 'October 31, 2026',
    detail: null,
  });
  assert.deepEqual(deadlineParts({ deadline: '2026-10-31', deadline_note: '11:59 PM ET' }), {
    headline: 'October 31, 2026',
    detail: '11:59 PM ET',
  });
  assert.equal(formatGrantOpens({ opens_on: '2027-01-15' }), 'January 15, 2027');
  assert.equal(formatGrantOpens({ opens_on: null }), 'Date not announced');
});

test('with no date, a short note is the deadline and a long one sits under it', () => {
  assert.deepEqual(deadlineParts({ deadline: null, deadline_note: 'Rolling' }), {
    headline: 'Rolling',
    detail: null,
  });
  assert.deepEqual(deadlineParts({ deadline: null, deadline_note: null }), {
    headline: 'Not stated',
    detail: null,
  });
  const long = 'The page says applications open monthly but gives no closing dates';
  assert.deepEqual(deadlineParts({ deadline: null, deadline_note: long }), {
    headline: 'No set date',
    detail: long,
  });
});

test('an upcoming grant keeps everything known about its deadline', () => {
  // The opening date takes the headline, so the deadline moves to the small
  // print. It must arrive there whole: a cut-off time is needed to apply.
  assert.equal(
    upcomingDeadlineDetail({ deadline: '2027-03-31', deadline_note: '5:00 PM ET' }),
    'Deadline March 31, 2027 (5:00 PM ET)',
  );
  assert.equal(upcomingDeadlineDetail({ deadline: '2027-03-31', deadline_note: null }), 'Deadline March 31, 2027');
  assert.equal(upcomingDeadlineDetail({ deadline: null, deadline_note: 'Rolling' }), 'Deadline: Rolling');
  assert.equal(upcomingDeadlineDetail({ deadline: null, deadline_note: 'Not stated' }), 'Deadline: Not stated');
  assert.equal(upcomingDeadlineDetail({ deadline: null, deadline_note: null }), null);
});

test('the amount is split into the figure to read at a glance and its small print', () => {
  assert.deepEqual(
    splitAmount('$500 to one business each month; monthly recipients are also considered for a $2,500 year-end grant'),
    {
      headline: '$500 to one business each month',
      detail: 'Monthly recipients are also considered for a $2,500 year-end grant',
    },
  );
  assert.deepEqual(splitAmount('$2,500, one grant per quarter'), {
    headline: '$2,500',
    detail: 'One grant per quarter',
  });
  assert.deepEqual(splitAmount('$2,500 cash plus $2,500 in services (stated total value $5,000). Two rounds a year.'), {
    headline: '$2,500 cash plus $2,500 in services',
    detail: '(stated total value $5,000). Two rounds a year.',
  });
  assert.deepEqual(splitAmount('Next cycle not announced. The 2026 cycle awarded up to $250,000.'), {
    headline: 'Next cycle not announced',
    detail: 'The 2026 cycle awarded up to $250,000.',
  });
});

test('an amount with nothing to split off is left whole', () => {
  // The comma in a number is not a break, and neither is the stop in "U.S.".
  assert.deepEqual(splitAmount('$10,000'), { headline: '$10,000', detail: null });
  assert.deepEqual(splitAmount('$5,000 each to 20 businesses'), {
    headline: '$5,000 each to 20 businesses',
    detail: null,
  });
  assert.deepEqual(splitAmount('Up to $1,000,000 for U.S. small businesses'), {
    headline: 'Up to $1,000,000 for U.S. small businesses',
    detail: null,
  });
  assert.deepEqual(splitAmount('Not stated'), { headline: 'Not stated', detail: null });
});

test('text written one point per line becomes one point per line', () => {
  assert.deepEqual(toPoints('For-profit U.S. businesses only.\n- Fewer than 50 employees\n\n\u2022 Under $5 million in revenue'), [
    'For-profit U.S. businesses only.',
    'Fewer than 50 employees',
    'Under $5 million in revenue',
  ]);
});

test('a paragraph is split into its sentences, never inside an abbreviation', () => {
  assert.deepEqual(
    toPoints(
      'For-profit businesses only; nonprofits cannot apply. The business must have its primary address in the United States, Puerto Rico or the U.S. Virgin Islands. The owner must be 18 or older.',
    ),
    [
      'For-profit businesses only; nonprofits cannot apply.',
      'The business must have its primary address in the United States, Puerto Rico or the U.S. Virgin Islands.',
      'The owner must be 18 or older.',
    ],
  );
  assert.deepEqual(toPoints('Run by Example Inc. No purchase is necessary. 2026 rules: https://example.org/grants/terms'), [
    'Run by Example Inc. No purchase is necessary.',
    '2026 rules: https://example.org/grants/terms',
  ]);
  assert.deepEqual(toPoints('Only $2,500 of the award is cash; the rest is services.'), [
    'Only $2,500 of the award is cash; the rest is services.',
  ]);
});

test('empty text gives no points', () => {
  assert.deepEqual(toPoints(null), []);
  assert.deepEqual(toPoints('   '), []);
});

test('details go stale after a few days without a re-check', () => {
  assert.equal(isStale({ last_verified_on: '2026-10-08' }, TODAY), false);
  assert.equal(isStale({ last_verified_on: '2026-10-05' }, TODAY), false);
  assert.equal(isStale({ last_verified_on: '2026-10-04' }, TODAY), true);
});

test('open grants sort by the nearest deadline, with undated ones last', () => {
  const grants = [
    { name: 'Rolling fund', deadline: null, opens_on: null },
    { name: 'Later', deadline: '2026-12-01', opens_on: null },
    { name: 'Sooner', deadline: '2026-10-20', opens_on: null },
    { name: 'Also rolling', deadline: null, opens_on: null },
  ];
  assert.deepEqual(
    sortGrants(grants, 'open').map((grant) => grant.name),
    ['Sooner', 'Later', 'Also rolling', 'Rolling fund'],
  );
});

test('upcoming grants sort by opening date and closed ones by most recently closed', () => {
  const grants = [
    { name: 'A', deadline: '2026-08-01', opens_on: '2027-03-01' },
    { name: 'B', deadline: '2026-09-15', opens_on: '2027-01-10' },
    { name: 'C', deadline: null, opens_on: null },
  ];
  assert.deepEqual(sortGrants(grants, 'upcoming').map((grant) => grant.name), ['B', 'A', 'C']);
  assert.deepEqual(sortGrants(grants, 'closed').map((grant) => grant.name), ['B', 'A', 'C']);
});

test('search looks at the grant, the company and the criteria, ignoring case', () => {
  const grant = {
    name: 'Main Street Boost',
    funder: 'Example Bank',
    description: 'Cash awards for small service businesses.',
    eligibility: 'For-profit businesses in Tennessee with fewer than 10 employees.',
    amount: '$5,000',
  };
  assert.equal(matchesGrantSearch(grant, ''), true);
  assert.equal(matchesGrantSearch(grant, '  example BANK '), true);
  assert.equal(matchesGrantSearch(grant, 'tennessee'), true);
  assert.equal(matchesGrantSearch(grant, '5,000'), true);
  assert.equal(matchesGrantSearch(grant, 'nonprofit'), false);
});

test('the last run date is the most recent day any grant was confirmed', () => {
  assert.equal(lastCheckedOn([]), null);
  assert.equal(
    lastCheckedOn([
      { last_verified_on: '2026-10-06' },
      { last_verified_on: '2026-10-08' },
      { last_verified_on: '2026-10-07' },
    ]),
    '2026-10-08',
  );
});

test('an applied grant sits on the Applied tab whatever its deadline or cycle says', () => {
  const applied_on = '2026-10-01';
  assert.equal(grantBucket({ cycle_status: 'open', deadline: '2026-10-31', applied_on }, TODAY), 'applied');
  assert.equal(grantBucket({ cycle_status: 'open', deadline: '2026-09-01', applied_on }, TODAY), 'applied');
  assert.equal(grantBucket({ cycle_status: 'closed', deadline: null, applied_on }, TODAY), 'applied');
  assert.equal(grantBucket({ cycle_status: 'open', deadline: '2026-10-31', applied_on: null }, TODAY), 'open');
});

test('applied grants are not flagged as closing soon', () => {
  assert.equal(
    isClosingSoon({ cycle_status: 'open', deadline: '2026-10-10', applied_on: '2026-10-01' }, TODAY),
    false,
  );
});

test('applied grants sort by most recently applied', () => {
  const grants = [
    { name: 'A', deadline: null, opens_on: null, applied_on: '2026-09-01' },
    { name: 'B', deadline: null, opens_on: null, applied_on: '2026-10-05' },
  ];
  assert.deepEqual(sortGrants(grants, 'applied').map((grant) => grant.name), ['B', 'A']);
});
