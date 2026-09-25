import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeReminderStatus,
  formatReminderInstant,
  type JobReminderPreview,
} from '../../src/services/jobReminderLabels.ts';

const CHICAGO = 'America/Chicago';

function preview(overrides: Partial<JobReminderPreview> = {}): JobReminderPreview {
  return {
    subject: 'Reminder: your Furniture Assembly appointment is tomorrow at 11:30 AM',
    html: '<p>…</p>',
    text: '…',
    recipient: 'kjzollner21@yahoo.com',
    status: 'scheduled',
    reason: 'too_early',
    sendAt: '2026-09-25T22:00:00.000Z',
    sentAt: null,
    timeZone: CHICAGO,
    ...overrides,
  };
}

test('an instant renders on the business clock, not the viewer\'s', () => {
  // The CI runner is pinned to America/New_York, so a helper that ignored the
  // zone would read 6:00 PM here — an hour later than the customer was told.
  assert.equal(formatReminderInstant('2026-09-25T22:00:00.000Z', CHICAGO), 'Fri, Sep 25 at 5:00 PM');
  assert.equal(
    formatReminderInstant('2026-09-25T22:00:00.000Z', 'America/New_York'),
    'Fri, Sep 25 at 6:00 PM',
  );
});

test('a scheduled reminder says when it goes out', () => {
  assert.equal(describeReminderStatus(preview()), 'Goes out Fri, Sep 25 at 5:00 PM');
});

test('a sent reminder says when it went', () => {
  assert.equal(
    describeReminderStatus(preview({
      status: 'sent',
      reason: 'already_reminded',
      sentAt: '2026-09-25T22:02:14.000Z',
    })),
    'Sent Fri, Sep 25 at 5:02 PM',
  );
});

test('a due reminder says it is about to go', () => {
  assert.equal(
    describeReminderStatus(preview({ status: 'due', reason: null })),
    'Sending within the hour',
  );
});

test('every blocked reason reads as something you can act on', () => {
  const cases: Array<[JobReminderPreview['reason'], string]> = [
    ['no_client_email', 'There is no usable email address on this job.'],
    ['status_not_remindable', 'Only jobs marked Scheduled or Accepted get a reminder.'],
    ['job_inactive', 'This job is archived.'],
    ['job_already_started', 'The start time has already passed.'],
    ['no_scheduled_date', 'This job has no scheduled date yet.'],
    ['cancelled', 'This reminder was cancelled. Resume it from Scheduled Emails to send it again.'],
  ];
  for (const [reason, expected] of cases) {
    assert.equal(describeReminderStatus(preview({ status: 'blocked', reason })), expected);
  }
});

test('a missing instant degrades to a plain label rather than "Invalid Date"', () => {
  assert.equal(describeReminderStatus(preview({ sendAt: null })), 'Scheduled');
  assert.equal(
    describeReminderStatus(preview({ status: 'sent', reason: 'already_reminded', sentAt: null })),
    'Already sent',
  );
  assert.equal(
    describeReminderStatus(preview({ status: 'blocked', reason: null })),
    'No reminder will be sent.',
  );
});

test('the status line never leaks a raw reason code to the screen', () => {
  const reasons: Array<JobReminderPreview['reason']> = [
    'no_scheduled_date', 'job_inactive', 'status_not_remindable',
    'no_client_email', 'cancelled', 'already_reminded', 'too_early', 'job_already_started',
  ];
  for (const reason of reasons) {
    for (const status of ['due', 'scheduled', 'sent', 'blocked'] as const) {
      const line = describeReminderStatus(preview({ status, reason }));
      assert.doesNotMatch(line, /_/, `${status}/${reason} showed a code`);
      assert.ok(line.length > 0);
    }
  }
});
