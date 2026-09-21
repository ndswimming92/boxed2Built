/**
 * Email sign-in fails in three different places — refused at send, rejected at
 * verify, or dead on arrival because the link was opened in the wrong browser
 * (PKCE keeps the code verifier in the requesting browser only). These cover
 * that each one says something a customer can act on, and that the server's
 * own cooldown number is the one we count down from.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeMagicLinkError,
  getMagicLinkErrorCode,
  isEmailRateLimited,
  parseEmailRateLimitSeconds,
} from '../../src/utils/magicLinkErrors.ts';

const KNOWN_CODES = [
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'email_address_invalid',
  'validation_failed',
  'signup_disabled',
  'email_provider_disabled',
  'otp_disabled',
  'otp_expired',
  'flow_state_not_found',
  'flow_state_expired',
  'bad_code_verifier',
  'access_denied',
  'magic_link_failed',
  'user_banned',
];

test('every known code gets its own actionable copy', () => {
  for (const code of KNOWN_CODES) {
    const copy = describeMagicLinkError({ code });
    assert.ok(copy.length > 0, code);
    assert.notEqual(copy, 'That did not work. Please try again, or sign in another way.');
  }
});

test('the wrong-browser family names the 6-digit code as the way out', () => {
  // This is the whole reason the code field exists; copy that omits it leaves
  // someone reading mail on their phone with no route forward.
  for (const code of ['otp_expired', 'flow_state_not_found', 'magic_link_failed', 'access_denied']) {
    assert.match(describeMagicLinkError({ code }), /6-digit code/, code);
  }
});

test('a misconfigured project points at a route that still works', () => {
  for (const code of ['signup_disabled', 'email_provider_disabled', 'otp_disabled']) {
    assert.match(describeMagicLinkError({ code }), /Google/, code);
  }
});

test('an unknown code still says something rather than leaking raw text', () => {
  const copy = describeMagicLinkError({ code: 'something_new_upstream', message: 'pq: relation does not exist' });
  assert.equal(copy, 'That did not work. Please try again, or sign in another way.');
  assert.doesNotMatch(copy, /pq:/);
});

test('handles missing and malformed errors', () => {
  assert.equal(getMagicLinkErrorCode(null), '');
  assert.equal(getMagicLinkErrorCode(undefined), '');
  assert.equal(getMagicLinkErrorCode({}), '');
  assert.ok(describeMagicLinkError(null).length > 0);
  assert.ok(describeMagicLinkError({}).length > 0);
});

test('a 429 without a recognised code is still treated as a rate limit', () => {
  assert.equal(
    describeMagicLinkError({ status: 429 }),
    describeMagicLinkError({ code: 'over_email_send_rate_limit' }),
  );
  assert.equal(isEmailRateLimited({ status: 429 }), true);
});

test('isEmailRateLimited only fires for rate limits', () => {
  assert.equal(isEmailRateLimited({ code: 'over_email_send_rate_limit' }), true);
  assert.equal(isEmailRateLimited({ code: 'over_request_rate_limit' }), true);
  assert.equal(isEmailRateLimited({ code: 'otp_expired' }), false);
  assert.equal(isEmailRateLimited(null), false);
});

test('reads the cooldown seconds out of the upstream message', () => {
  assert.equal(
    parseEmailRateLimitSeconds('For security purposes, you can only request this after 47 seconds.'),
    47,
  );
  assert.equal(parseEmailRateLimitSeconds('you can only request this after 1 second'), 1);
  assert.equal(parseEmailRateLimitSeconds('... after   9   seconds'), 9);
});

test('returns null when there is no cooldown to read', () => {
  assert.equal(parseEmailRateLimitSeconds(null), null);
  assert.equal(parseEmailRateLimitSeconds(undefined), null);
  assert.equal(parseEmailRateLimitSeconds(''), null);
  assert.equal(parseEmailRateLimitSeconds('Email rate limit exceeded'), null);
  assert.equal(parseEmailRateLimitSeconds('after 0 seconds'), null);
});
