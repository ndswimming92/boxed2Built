/**
 * Passkey failures arrive from two unrelated places — Supabase Auth and the
 * browser's own WebAuthn stack — and both surface as `{ code }`. These cover
 * that every code we know about turns into something a customer can act on,
 * and that an unknown one still says something rather than leaking raw text.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describePasskeyError,
  getPasskeyErrorCode,
  isPasskeyCeremonyCancelled,
} from '../../src/utils/passkeyErrors.ts';

const SERVER_CODES = [
  'passkey_disabled',
  'too_many_passkeys',
  'webauthn_credential_exists',
  'webauthn_credential_not_found',
  'webauthn_challenge_not_found',
  'webauthn_challenge_expired',
  'webauthn_verification_failed',
  'email_not_confirmed',
  'phone_not_confirmed',
  'user_banned',
  'over_request_rate_limit',
];

const CEREMONY_CODES = [
  'ERROR_INVALID_DOMAIN',
  'ERROR_INVALID_RP_ID',
  'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
  'ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT',
  'ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT',
  'ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG',
  'ERROR_AUTHENTICATOR_GENERAL_ERROR',
  'ERROR_CEREMONY_ABORTED',
];

const FALLBACK = describePasskeyError({ code: 'something_nobody_has_seen' });

test('every documented Supabase passkey code gets its own explanation', () => {
  for (const code of SERVER_CODES) {
    const message = describePasskeyError({ code });
    assert.notEqual(message, FALLBACK, `${code} fell through to the generic message`);
    assert.ok(message.length > 0, `${code} produced empty copy`);
  }
});

test('every browser ceremony code gets its own explanation', () => {
  for (const code of CEREMONY_CODES) {
    const message = describePasskeyError({ code });
    assert.notEqual(message, FALLBACK, `${code} fell through to the generic message`);
    assert.ok(message.length > 0, `${code} produced empty copy`);
  }
});

test('an unknown code still says something useful rather than nothing', () => {
  assert.ok(FALLBACK.length > 0);
  assert.match(FALLBACK, /try again/i);
});

test('a null or undefined error does not throw', () => {
  assert.equal(describePasskeyError(null), FALLBACK);
  assert.equal(describePasskeyError(undefined), FALLBACK);
});

test('the wrong-domain codes name the live site, since that is the actual fix', () => {
  // This is the failure everyone hits first: passkeys are bound to
  // boxed2built.com, so localhost and deploy previews cannot ever work.
  for (const code of ['ERROR_INVALID_DOMAIN', 'ERROR_INVALID_RP_ID']) {
    assert.match(describePasskeyError({ code }), /boxed2built\.com/);
  }
});

test('a dismissed prompt is recognised however the browser reports it', () => {
  assert.equal(isPasskeyCeremonyCancelled({ code: 'ERROR_CEREMONY_ABORTED' }), true);
  assert.equal(isPasskeyCeremonyCancelled(Object.assign(new Error('x'), { name: 'NotAllowedError' })), true);
  assert.equal(isPasskeyCeremonyCancelled(Object.assign(new Error('x'), { name: 'AbortError' })), true);
});

test('a real failure is not mistaken for a dismissed prompt', () => {
  assert.equal(isPasskeyCeremonyCancelled({ code: 'webauthn_verification_failed' }), false);
  assert.equal(isPasskeyCeremonyCancelled(null), false);
  assert.equal(isPasskeyCeremonyCancelled(new Error('boom')), false);
});

test('a cancelled ceremony with no code still gets the dismissed wording', () => {
  const dismissed = Object.assign(new Error('The operation either timed out or was not allowed.'), {
    name: 'NotAllowedError',
  });
  assert.equal(describePasskeyError(dismissed), describePasskeyError({ code: 'ERROR_CEREMONY_ABORTED' }));
});

test('getPasskeyErrorCode reads a code only when there is a real one', () => {
  assert.equal(getPasskeyErrorCode({ code: 'passkey_disabled' }), 'passkey_disabled');
  assert.equal(getPasskeyErrorCode({}), '');
  assert.equal(getPasskeyErrorCode(null), '');
  assert.equal(getPasskeyErrorCode({ code: null }), '');
});
