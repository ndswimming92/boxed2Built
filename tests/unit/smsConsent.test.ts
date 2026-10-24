import test from 'node:test';
import assert from 'node:assert/strict';

import {
  type ConsentLogRow,
  decideSmsConsent,
  describeAppointment,
  idempotencyKey,
  phoneDigits,
  smsValue,
  toUsE164,
} from '../../supabase/functions/_shared/smsConsent.ts';

const optIn = (at: string, serviceTexts = true): ConsentLogRow => ({
  event_type: 'opt_in',
  service_texts: serviceTexts,
  consent_given_at: at,
  created_at: at,
});
const optOut = (at: string): ConsentLogRow => ({
  event_type: 'opt_out',
  service_texts: false,
  consent_given_at: null,
  created_at: at,
});

test('a number with no website opt-in is never texted', () => {
  assert.deepEqual(decideSmsConsent([], []), { allowed: false, reason: 'no_opt_in' });
});

test('a START keyword alone is not a first opt-in', () => {
  assert.deepEqual(
    decideSmsConsent([], [{ opted_out: false, last_signal_at: '2026-10-24T10:00:00Z' }]),
    { allowed: false, reason: 'no_opt_in' },
  );
});

test('a marketing-only opt-in does not allow service texts', () => {
  assert.deepEqual(decideSmsConsent([optIn('2026-10-01T00:00:00Z', false)], []), {
    allowed: false,
    reason: 'no_opt_in',
  });
});

test('a website opt-in allows texting', () => {
  assert.deepEqual(decideSmsConsent([optIn('2026-10-01T00:00:00Z')], []), { allowed: true });
});

test('a STOP after the opt-in blocks texting', () => {
  assert.deepEqual(
    decideSmsConsent([optIn('2026-10-01T00:00:00Z')], [{ opted_out: true, last_signal_at: '2026-10-02T00:00:00Z' }]),
    { allowed: false, reason: 'opted_out' },
  );
});

test('a START after a STOP restores a number that opted in on the website', () => {
  assert.deepEqual(
    decideSmsConsent(
      [optIn('2026-10-01T00:00:00Z')],
      [{ opted_out: false, last_signal_at: '2026-10-03T00:00:00Z' }],
    ),
    { allowed: true },
  );
});

test('a fresh website opt-in after a STOP allows texting again', () => {
  assert.deepEqual(
    decideSmsConsent(
      [optIn('2026-10-01T00:00:00Z'), optIn('2026-10-05T00:00:00Z')],
      [{ opted_out: true, last_signal_at: '2026-10-02T00:00:00Z' }],
    ),
    { allowed: true },
  );
});

test('an opt-out an admin recorded blocks texting', () => {
  assert.deepEqual(decideSmsConsent([optIn('2026-10-01T00:00:00Z'), optOut('2026-10-02T00:00:00Z')], []), {
    allowed: false,
    reason: 'opted_out',
  });
});

test('an opt-out at the same instant as the opt-in wins', () => {
  assert.deepEqual(decideSmsConsent([optIn('2026-10-01T00:00:00Z'), optOut('2026-10-01T00:00:00Z')], []), {
    allowed: false,
    reason: 'opted_out',
  });
});

test('consent_given_at is used over created_at when present', () => {
  const row: ConsentLogRow = {
    event_type: 'opt_in',
    service_texts: true,
    consent_given_at: '2026-10-03T00:00:00Z',
    created_at: '2026-10-01T00:00:00Z',
  };
  assert.deepEqual(decideSmsConsent([row], [{ opted_out: true, last_signal_at: '2026-10-02T00:00:00Z' }]), {
    allowed: true,
  });
});

test('toUsE164 normalises common US formats and rejects the rest', () => {
  assert.equal(toUsE164('(615) 403-4538'), '+16154034538');
  assert.equal(toUsE164('615.403.4538'), '+16154034538');
  assert.equal(toUsE164('+1 615 403 4538'), '+16154034538');
  assert.equal(toUsE164('16154034538'), '+16154034538');
  assert.equal(toUsE164('403-4538'), null);
  assert.equal(toUsE164('(015) 403-4538'), null);
  assert.equal(toUsE164('+44 20 7946 0958'), null);
  assert.equal(toUsE164(''), null);
  assert.equal(toUsE164(null), null);
});

test('phoneDigits matches the ten digits consent rows are keyed on', () => {
  assert.equal(phoneDigits('+16154034538'), '6154034538');
});

test('smsValue removes what Sent rejects and caps length', () => {
  assert.equal(smsValue('123 Main St\nApt 4\t  Spring Hill'), '123 Main St Apt 4 Spring Hill');
  assert.equal(smsValue(null), '');
  assert.equal(smsValue('x'.repeat(200), 10), `${'x'.repeat(9)}…`);
});

test('idempotencyKey keeps only characters Sent accepts', () => {
  assert.equal(
    idempotencyKey('reminder', 'a1b2', '2026-10-25', '10:00:00', null),
    'reminder_a1b2_2026-10-25_10-00-00',
  );
  assert.equal(idempotencyKey('invoice', 'id', '2026-10-24T03:30:00.123Z'), 'invoice_id_2026-10-24T03-30-00-123Z');
  assert.ok(idempotencyKey('x'.repeat(300)).length <= 255);
});

test('describeAppointment adds the time only when there is one', () => {
  assert.equal(describeAppointment('Saturday, October 25', '10:00 AM'), 'Saturday, October 25 at 10:00 AM');
  assert.equal(describeAppointment('Saturday, October 25', null), 'Saturday, October 25');
});
