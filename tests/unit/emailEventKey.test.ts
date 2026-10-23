import test from 'node:test';
import assert from 'node:assert/strict';

import { resendEventKey } from '../../supabase/functions/_shared/emailEventKey.ts';

test('uses the svix-id, so every event for one email gets its own key', () => {
  const sent = resendEventKey('msg_aaa', 'email.sent', 'email-1');
  const delivered = resendEventKey('msg_bbb', 'email.delivered', 'email-1');
  const bounced = resendEventKey('msg_ccc', 'email.bounced', 'email-1');
  assert.equal(new Set([sent, delivered, bounced]).size, 3);
});

test('a retry of the same event keeps the same key, so it is still de-duplicated', () => {
  assert.equal(
    resendEventKey('msg_aaa', 'email.delivered', 'email-1'),
    resendEventKey('msg_aaa', 'email.delivered', 'email-1'),
  );
});

test('without a svix-id the key still separates event types for one email', () => {
  const sent = resendEventKey(null, 'email.sent', 'email-1');
  const delivered = resendEventKey(undefined, 'email.delivered', 'email-1');
  assert.notEqual(sent, delivered);
  assert.equal(sent, 'email.sent:email-1');
});

test('events with neither a svix-id nor an email id get no key rather than a shared one', () => {
  assert.equal(resendEventKey('', 'domain.updated', undefined), null);
  assert.equal(resendEventKey('  ', 'domain.updated', null), null);
});
