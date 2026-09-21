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
  isKnownMagicLinkCode,
  isMagicLinkSendBlocked,
  isProbablyEmail,
  normalizeEmail,
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

test('only project-level and format failures escape the "check your email" card', () => {
  // These say nothing about a particular address, so showing them leaks nothing.
  for (const code of ['signup_disabled', 'email_provider_disabled', 'otp_disabled', 'email_address_invalid', 'validation_failed']) {
    assert.equal(isMagicLinkSendBlocked({ code }), true, code);
  }

  // These would each reveal whether an address belongs to a customer.
  for (const code of ['user_banned', 'over_email_send_rate_limit', 'otp_expired', 'unknown_code']) {
    assert.equal(isMagicLinkSendBlocked({ code }), false, code);
  }

  assert.equal(isMagicLinkSendBlocked(null), false);
});

test('normalizeEmail collapses case and whitespace into one rate-limit bucket', () => {
  assert.equal(normalizeEmail('  A@X.com '), 'a@x.com');
  assert.equal(normalizeEmail('a@x.com'), 'a@x.com');
  assert.equal(normalizeEmail(null), '');
  assert.equal(normalizeEmail(undefined), '');
});

test('isProbablyEmail catches typos without rejecting real addresses', () => {
  for (const good of ['a@x.co', 'someone@boxed2built.com', 'first.last+tag@sub.example.co.uk', '  A@X.COM ']) {
    assert.equal(isProbablyEmail(good), true, good);
  }

  for (const bad of ['', 'nope', 'a@b', 'a@@b.com', 'a b@x.com', '@x.com', 'a@.com', 'a@x.', null, undefined]) {
    assert.equal(isProbablyEmail(bad), false, String(bad));
  }
});

test('isKnownMagicLinkCode separates our own copy from the catch-all', () => {
  for (const code of KNOWN_CODES) {
    assert.equal(isKnownMagicLinkCode(code), true, code);
  }

  assert.equal(isKnownMagicLinkCode('something_new_upstream'), false);
  assert.equal(isKnownMagicLinkCode(''), false);
  assert.equal(isKnownMagicLinkCode(null), false);
  assert.equal(isKnownMagicLinkCode(undefined), false);
});

test('a server fault is surfaced, not hidden behind the sent card', () => {
  // The real failure this covers: an SMTP password Resend rejected with
  // 535 "Authentication credentials invalid" surfaced as /otp -> 500, and the
  // page told every customer to check an inbox nothing had been sent to.
  for (const status of [500, 502, 503, 504]) {
    assert.equal(isMagicLinkSendBlocked({ status }), true, String(status));
  }

  // A cooldown is not a block — it drives the countdown instead.
  assert.equal(isMagicLinkSendBlocked({ status: 429 }), false);
  assert.equal(isEmailRateLimited({ status: 500 }), false);
});

test('server-fault copy says it is our problem, not their address', () => {
  const copy = describeMagicLinkError({ status: 500 });

  assert.notEqual(copy, 'That did not work. Please try again, or sign in another way.');
  assert.match(copy, /our end/);
  assert.match(copy, /not with your address/);
});

test('a 5xx resolves with no code at all', () => {
  // This is the shape auth-js actually delivers: it throws
  // AuthRetryableFetchError for 5xx and returns before parsing a code, so
  // matching on `code` alone is what let this through in the first place.
  assert.equal(getMagicLinkErrorCode({ status: 503 }), '');
  assert.equal(describeMagicLinkError({ status: 503 }), describeMagicLinkError({ status: 500 }));
  assert.equal(isMagicLinkSendBlocked({ status: 503 }), true);
});

test('4xx below 429 is not mistaken for a server fault', () => {
  assert.equal(isMagicLinkSendBlocked({ status: 400 }), false);
  assert.equal(isMagicLinkSendBlocked({ status: 404 }), false);
  assert.equal(isMagicLinkSendBlocked({ status: 499 }), false);
});
