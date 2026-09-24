import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cooldownSecondsRemaining,
  describeCooldown,
  testRecipientFrom,
} from '../../supabase/functions/_shared/adminEmailModes.ts';

const TEN_MINUTES = 10 * 60 * 1000;
const NOW = Date.parse('2026-09-23T18:00:00Z');

test('nothing sent yet means nothing to wait for', () => {
  assert.equal(cooldownSecondsRemaining(null, TEN_MINUTES, NOW), 0);
  assert.equal(cooldownSecondsRemaining(undefined, TEN_MINUTES, NOW), 0);
});

test('a cooldown that has run out is over', () => {
  assert.equal(
    cooldownSecondsRemaining('2026-09-23T17:50:00Z', TEN_MINUTES, NOW),
    0,
  );
  assert.equal(
    cooldownSecondsRemaining('2026-09-23T12:00:00Z', TEN_MINUTES, NOW),
    0,
  );
});

test('a cooldown still running reports the seconds left, rounded up', () => {
  assert.equal(
    cooldownSecondsRemaining('2026-09-23T17:56:00Z', TEN_MINUTES, NOW),
    360,
  );
  // 59.5s elapsed: the admin is told 541, not 540, so the wait is never short.
  assert.equal(
    cooldownSecondsRemaining('2026-09-23T17:59:00.500Z', TEN_MINUTES, NOW),
    541,
  );
});

test('an unreadable timestamp does not hold an email back', () => {
  assert.equal(cooldownSecondsRemaining('not a date', TEN_MINUTES, NOW), 0);
  assert.equal(cooldownSecondsRemaining('', TEN_MINUTES, NOW), 0);
});

test('a timestamp in the future is a disagreeing clock, not a longer wait', () => {
  // Never more than the cooldown itself, however far ahead the row's clock is.
  assert.equal(
    cooldownSecondsRemaining('2026-09-24T18:00:00Z', TEN_MINUTES, NOW),
    600,
  );
});

test('the cooldown reads in whole minutes once past a minute', () => {
  assert.equal(
    describeCooldown(360),
    'This email was sent recently. It can be sent again in 6 minutes.',
  );
  // Rounded up: 5m01s is not "5 minutes" to someone who then tries at 5m00s.
  assert.equal(
    describeCooldown(301),
    'This email was sent recently. It can be sent again in 6 minutes.',
  );
  assert.equal(
    describeCooldown(60),
    'This email was sent recently. It can be sent again in 1 minute.',
  );
});

test('the last minute counts down in seconds', () => {
  assert.equal(
    describeCooldown(45),
    'This email was sent recently. It can be sent again in 45 seconds.',
  );
  assert.equal(
    describeCooldown(1),
    'This email was sent recently. It can be sent again in 1 second.',
  );
});

test('no cooldown, nothing to say', () => {
  assert.equal(describeCooldown(0), '');
  assert.equal(describeCooldown(-5), '');
});

test('a test copy goes to the signed-in admin', () => {
  assert.deepEqual(
    testRecipientFrom({ user: { email: 'boxed2builtco@gmail.com' } }),
    { ok: true, email: 'boxed2builtco@gmail.com' },
  );
  assert.deepEqual(
    testRecipientFrom({ user: { email: '  boxed2builtco@gmail.com  ' } }),
    { ok: true, email: 'boxed2builtco@gmail.com' },
  );
});

test('a caller with no address of their own cannot test', () => {
  // The service role key authorises cron and other functions, which have no
  // inbox. A test send from one has nowhere to go and must say so rather than
  // quietly falling back to the client.
  const noUser = testRecipientFrom({});
  assert.equal(noUser.ok, false);

  for (const email of [null, '', '   ']) {
    const result = testRecipientFrom({ user: { email } });
    assert.equal(result.ok, false, `expected ${JSON.stringify(email)} to be refused`);
  }
});
