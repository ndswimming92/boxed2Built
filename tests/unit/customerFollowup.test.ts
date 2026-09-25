import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideFollowup,
  isSendableEmail,
  jobEndInstant,
  type FollowupJobFacts,
} from '../../supabase/functions/_shared/customerFollowup.ts';

const CHICAGO = 'America/Chicago';

function facts(overrides: Partial<FollowupJobFacts> = {}): FollowupJobFacts {
  return {
    dateScheduled: '2026-09-26',
    scheduledEndTime: '16:10',
    clientEmail: 'kjzollner21@yahoo.com',
    isActive: true,
    jobStatus: 'scheduled',
    followUpForDate: null,
    followUpForEndTime: null,
    ...overrides,
  };
}

test('jobEndInstant lands at the end time local to the business', () => {
  // 2026-09-26 16:10 CDT is 21:10 UTC.
  assert.equal(
    jobEndInstant('2026-09-26', '16:10', CHICAGO).toISOString(),
    '2026-09-26T21:10:00.000Z',
  );
});

test('jobEndInstant stays at the local clock time across a DST change', () => {
  // US DST ends 2026-11-01, so a Nov 2 job ends in CST (UTC-6) not CDT.
  assert.equal(
    jobEndInstant('2026-11-02', '16:10', CHICAGO).toISOString(),
    '2026-11-02T22:10:00.000Z',
  );
  assert.equal(
    jobEndInstant('2026-10-30', '16:10', CHICAGO).toISOString(),
    '2026-10-30T21:10:00.000Z',
  );
});

test('holds the email until the end time, then sends', () => {
  const justBefore = decideFollowup(facts(), {
    now: new Date('2026-09-26T21:09:00Z'),
    timeZone: CHICAGO,
  });
  assert.equal(justBefore.send, false);
  assert.equal(justBefore.send === false && justBefore.reason, 'too_early');
  // The admin preview shows this, so a refusal still has to say when it is due.
  assert.equal(justBefore.sendAt?.toISOString(), '2026-09-26T21:10:00.000Z');

  const onTime = decideFollowup(facts(), {
    now: new Date('2026-09-26T21:10:00Z'),
    timeZone: CHICAGO,
  });
  assert.equal(onTime.send, true);
});

test('a job whose end time already passed still sends on the next tick', () => {
  const decision = decideFollowup(facts(), {
    now: new Date('2026-09-27T12:00:00Z'),
    timeZone: CHICAGO,
  });
  assert.equal(decision.send, true);
});

test('does not send twice for the same date and end time', () => {
  const decision = decideFollowup(
    facts({ followUpForDate: '2026-09-26', followUpForEndTime: '16:10:00' }),
    { now: new Date('2026-09-27T12:00:00Z'), timeZone: CHICAGO },
  );
  assert.equal(decision.send, false);
  assert.equal(decision.send === false && decision.reason, 'already_sent');
});

test('rescheduling the end time re-sends', () => {
  const decision = decideFollowup(
    facts({ scheduledEndTime: '18:00', followUpForDate: '2026-09-26', followUpForEndTime: '16:10:00' }),
    { now: new Date('2026-09-27T12:00:00Z'), timeZone: CHICAGO },
  );
  assert.equal(decision.send, true);
});

test('pushing the end time later moves sendAt out, even after an earlier send', () => {
  const decision = decideFollowup(
    facts({ scheduledEndTime: '20:00', followUpForDate: '2026-09-26', followUpForEndTime: '16:10:00' }),
    { now: new Date('2026-09-26T21:30:00Z'), timeZone: CHICAGO },
  );
  assert.equal(decision.send, false);
  assert.equal(decision.send === false && decision.reason, 'too_early');
  assert.equal(decision.sendAt?.toISOString(), '2026-09-27T01:00:00.000Z');
});

test('a manual send before the end time records the current end time, blocking the sweep', () => {
  // Manual send at 3pm for a job ending at 4:10pm.
  const manual = decideFollowup(facts(), {
    now: new Date('2026-09-26T20:00:00Z'),
    timeZone: CHICAGO,
    force: true,
  });
  assert.equal(manual.send, true);

  // The sweep an hour later, after the caller records followUpForDate/EndTime
  // from that manual send, must not send again.
  const sweep = decideFollowup(
    facts({ followUpForDate: '2026-09-26', followUpForEndTime: '16:10' }),
    { now: new Date('2026-09-26T22:00:00Z'), timeZone: CHICAGO },
  );
  assert.equal(sweep.send, false);
  assert.equal(sweep.send === false && sweep.reason, 'already_sent');
});

test('force re-sends an already-sent job but never an ineligible one', () => {
  const resent = decideFollowup(
    facts({ followUpForDate: '2026-09-26', followUpForEndTime: '16:10' }),
    { now: new Date('2026-09-27T12:00:00Z'), timeZone: CHICAGO, force: true },
  );
  assert.equal(resent.send, true);

  const cancelled = decideFollowup(
    facts({ jobStatus: 'cancelled' }),
    { now: new Date('2026-09-27T12:00:00Z'), timeZone: CHICAGO, force: true },
  );
  assert.deepEqual(cancelled, { send: false, reason: 'status_not_eligible' });
});

test('skips jobs that are not going to happen, or already did not count', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  for (const status of ['quoted', 'lost', 'cancelled', null]) {
    assert.deepEqual(
      decideFollowup(facts({ jobStatus: status }), { now, timeZone: CHICAGO }),
      { send: false, reason: 'status_not_eligible' },
      `status ${status}`,
    );
  }
  // Unlike the day-before reminder, in_progress and completed are eligible —
  // this email is about work that has happened, not work that is upcoming.
  for (const status of ['in_progress', 'completed', 'scheduled', 'accepted']) {
    const decision = decideFollowup(facts({ jobStatus: status }), { now, timeZone: CHICAGO });
    assert.notEqual(
      decision.send === false ? decision.reason : null,
      'status_not_eligible',
      `status ${status} should be eligible`,
    );
  }
  assert.deepEqual(
    decideFollowup(facts({ isActive: false }), { now, timeZone: CHICAGO }),
    { send: false, reason: 'job_inactive' },
  );
  assert.deepEqual(
    decideFollowup(facts({ dateScheduled: null }), { now, timeZone: CHICAGO }),
    { send: false, reason: 'no_scheduled_date' },
  );
  assert.deepEqual(
    decideFollowup(facts({ scheduledEndTime: null }), { now, timeZone: CHICAGO }),
    { send: false, reason: 'no_end_time' },
  );
});

test('placeholder and malformed emails are never mailed', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  for (const email of ['NA', 'n/a', ' none ', '-', 'null', 'test@test.com', '', null, '555-1234', 'nope@nope']) {
    assert.deepEqual(
      decideFollowup(facts({ clientEmail: email }), { now, timeZone: CHICAGO }),
      { send: false, reason: 'no_client_email' },
      `email ${email}`,
    );
  }
});

test('isSendableEmail accepts ordinary addresses', () => {
  assert.equal(isSendableEmail('kjzollner21@yahoo.com'), true);
  assert.equal(isSendableEmail('  First.Last+tag@sub.example.co.uk '), true);
});

test('force sends a job that is not due yet — the Send it now button', () => {
  const decision = decideFollowup(facts(), {
    now: new Date('2026-09-26T13:00:00Z'),
    timeZone: CHICAGO,
    force: true,
  });
  assert.equal(decision.send, true);

  // Without force the same call waits.
  const waiting = decideFollowup(facts(), {
    now: new Date('2026-09-26T13:00:00Z'),
    timeZone: CHICAGO,
  });
  assert.equal(waiting.send, false);
  assert.equal(waiting.send === false && waiting.reason, 'too_early');
});

test('force never overrides eligibility, only timing', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  const blocked: Array<[Partial<FollowupJobFacts>, string]> = [
    [{ dateScheduled: null }, 'no_scheduled_date'],
    [{ scheduledEndTime: null }, 'no_end_time'],
    [{ isActive: false }, 'job_inactive'],
    [{ jobStatus: 'quoted' }, 'status_not_eligible'],
    [{ clientEmail: 'NA' }, 'no_client_email'],
  ];
  for (const [override, reason] of blocked) {
    const decision = decideFollowup(facts(override), { now, timeZone: CHICAGO, force: true });
    assert.equal(decision.send, false, `${reason} should survive force`);
    assert.equal(decision.send === false && decision.reason, reason);
  }
});

test('a cancelled follow-up is silenced, and force cannot resurrect it', () => {
  const now = new Date('2026-09-27T12:00:00Z');

  const cancelled = decideFollowup(facts({ followUpCancelledAt: '2026-09-20T00:00:00Z' }), {
    now,
    timeZone: CHICAGO,
  });
  assert.equal(cancelled.send, false);
  assert.equal(cancelled.send === false && cancelled.reason, 'cancelled');
  // Still reports when it would have gone out, same as any other refusal.
  assert.equal(cancelled.sendAt?.toISOString(), '2026-09-26T21:10:00.000Z');

  const forced = decideFollowup(facts({ followUpCancelledAt: '2026-09-20T00:00:00Z' }), {
    now,
    timeZone: CHICAGO,
    force: true,
  });
  assert.equal(forced.send, false);
  assert.equal(forced.send === false && forced.reason, 'cancelled');

  // Clearing the column (resuming it) puts it right back on schedule.
  const resumed = decideFollowup(facts({ followUpCancelledAt: null }), {
    now,
    timeZone: CHICAGO,
  });
  assert.equal(resumed.send, true);
});

test('a refusal carries sendAt whenever the job has a date and end time', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  const sent = decideFollowup(
    facts({ followUpForDate: '2026-09-26', followUpForEndTime: '16:10' }),
    { now, timeZone: CHICAGO },
  );
  assert.equal(sent.sendAt?.toISOString(), '2026-09-26T21:10:00.000Z');

  // ...and cannot when there is no date or end time to compute one from.
  const undated = decideFollowup(facts({ dateScheduled: null }), { now, timeZone: CHICAGO });
  assert.equal(undated.sendAt, undefined);
  const untimed = decideFollowup(facts({ scheduledEndTime: null }), { now, timeZone: CHICAGO });
  assert.equal(untimed.sendAt, undefined);
});
