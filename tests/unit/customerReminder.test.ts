import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SEND_HOUR,
  decideReminder,
  describeProximity,
  isSendableEmail,
  jobStartInstant,
  reminderSendAt,
  type ReminderJobFacts,
} from '../../supabase/functions/_shared/customerReminder.ts';

const CHICAGO = 'America/Chicago';

function facts(overrides: Partial<ReminderJobFacts> = {}): ReminderJobFacts {
  return {
    dateScheduled: '2026-09-26',
    scheduledStartTime: '11:30',
    clientEmail: 'kjzollner21@yahoo.com',
    isActive: true,
    jobStatus: 'scheduled',
    reminderFor: null,
    reminderStartTime: null,
    ...overrides,
  };
}

test('reminderSendAt lands at 5pm local the day before', () => {
  // 2026-09-25 17:00 CDT is 22:00 UTC.
  assert.equal(
    reminderSendAt('2026-09-26', CHICAGO).toISOString(),
    '2026-09-25T22:00:00.000Z',
  );
});

test('reminderSendAt stays at 5pm local across a DST change', () => {
  // US DST ends 2026-11-01, so a Nov 2 job is reminded in CST (UTC-6) not CDT.
  assert.equal(
    reminderSendAt('2026-11-02', CHICAGO).toISOString(),
    '2026-11-01T23:00:00.000Z',
  );
  assert.equal(
    reminderSendAt('2026-10-30', CHICAGO).toISOString(),
    '2026-10-29T22:00:00.000Z',
  );
});

test('reminderSendAt crosses a month boundary backwards', () => {
  assert.equal(
    reminderSendAt('2026-10-01', CHICAGO).toISOString(),
    '2026-09-30T22:00:00.000Z',
  );
});

test('jobStartInstant treats a job with no start time as local midnight', () => {
  assert.equal(
    jobStartInstant('2026-09-26', null, CHICAGO).toISOString(),
    '2026-09-26T05:00:00.000Z',
  );
  assert.equal(
    jobStartInstant('2026-09-26', '11:30:00', CHICAGO).toISOString(),
    '2026-09-26T16:30:00.000Z',
  );
});

test('holds the email until 5pm the day before, then sends', () => {
  const justBefore = decideReminder(facts(), {
    now: new Date('2026-09-25T21:59:00Z'),
    timeZone: CHICAGO,
  });
  assert.deepEqual(justBefore, { send: false, reason: 'too_early' });

  const onTime = decideReminder(facts(), {
    now: new Date('2026-09-25T22:00:00Z'),
    timeZone: CHICAGO,
  });
  assert.equal(onTime.send, true);
});

test('a job booked after the window still goes out on the next tick', () => {
  // Booked at 9pm the night before: the 5pm send time is already behind us.
  const decision = decideReminder(facts(), {
    now: new Date('2026-09-26T02:00:00Z'),
    timeZone: CHICAGO,
  });
  assert.equal(decision.send, true);
});

test('stops once the job has started', () => {
  const decision = decideReminder(facts(), {
    now: new Date('2026-09-26T16:30:00Z'),
    timeZone: CHICAGO,
  });
  assert.deepEqual(decision, { send: false, reason: 'job_already_started' });
});

test('a job with no start time is not reminded on its own day', () => {
  const decision = decideReminder(facts({ scheduledStartTime: null }), {
    now: new Date('2026-09-26T13:00:00Z'),
    timeZone: CHICAGO,
  });
  assert.deepEqual(decision, { send: false, reason: 'job_already_started' });
});

test('does not send twice for the same date and time', () => {
  const decision = decideReminder(
    facts({ reminderFor: '2026-09-26', reminderStartTime: '11:30:00' }),
    { now: new Date('2026-09-25T22:00:00Z'), timeZone: CHICAGO },
  );
  assert.deepEqual(decision, { send: false, reason: 'already_reminded' });
});

test('a reschedule to a new time re-sends', () => {
  const decision = decideReminder(
    facts({ scheduledStartTime: '14:00', reminderFor: '2026-09-26', reminderStartTime: '11:30:00' }),
    { now: new Date('2026-09-25T22:00:00Z'), timeZone: CHICAGO },
  );
  assert.equal(decision.send, true);
});

test('force re-sends an already-reminded job but never an ineligible one', () => {
  const resent = decideReminder(
    facts({ reminderFor: '2026-09-26', reminderStartTime: '11:30' }),
    { now: new Date('2026-09-25T22:00:00Z'), timeZone: CHICAGO, force: true },
  );
  assert.equal(resent.send, true);

  const cancelled = decideReminder(
    facts({ jobStatus: 'cancelled' }),
    { now: new Date('2026-09-25T22:00:00Z'), timeZone: CHICAGO, force: true },
  );
  assert.deepEqual(cancelled, { send: false, reason: 'status_not_remindable' });
});

test('skips jobs that are not going to happen', () => {
  const now = new Date('2026-09-25T22:00:00Z');
  for (const status of ['quoted', 'completed', 'lost', 'cancelled', 'in_progress', null]) {
    assert.deepEqual(
      decideReminder(facts({ jobStatus: status }), { now, timeZone: CHICAGO }),
      { send: false, reason: 'status_not_remindable' },
      `status ${status}`,
    );
  }
  assert.deepEqual(
    decideReminder(facts({ isActive: false }), { now, timeZone: CHICAGO }),
    { send: false, reason: 'job_inactive' },
  );
  assert.deepEqual(
    decideReminder(facts({ dateScheduled: null }), { now, timeZone: CHICAGO }),
    { send: false, reason: 'no_scheduled_date' },
  );
});

test('placeholder and malformed emails are never mailed', () => {
  const now = new Date('2026-09-25T22:00:00Z');
  for (const email of ['NA', 'n/a', ' none ', '-', 'null', 'test@test.com', '', null, '555-1234', 'nope@nope']) {
    assert.deepEqual(
      decideReminder(facts({ clientEmail: email }), { now, timeZone: CHICAGO }),
      { send: false, reason: 'no_client_email' },
      `email ${email}`,
    );
  }
});

test('isSendableEmail accepts ordinary addresses', () => {
  assert.equal(isSendableEmail('kjzollner21@yahoo.com'), true);
  assert.equal(isSendableEmail('  First.Last+tag@sub.example.co.uk '), true);
});

test('describeProximity reads the date in the business timezone', () => {
  // 2026-09-26T02:00Z is still the 25th in Chicago, so the 26th is tomorrow.
  const lateNight = new Date('2026-09-26T02:00:00Z');
  assert.equal(describeProximity('2026-09-26', CHICAGO, lateNight), 'tomorrow');
  assert.equal(describeProximity('2026-09-25', CHICAGO, lateNight), 'today');
  assert.equal(describeProximity('2026-09-28', CHICAGO, lateNight), null);
});

test('the default send hour is 5pm', () => {
  assert.equal(DEFAULT_SEND_HOUR, '17:00');
});
