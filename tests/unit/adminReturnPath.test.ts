import test from 'node:test';
import assert from 'node:assert/strict';

import { isSafeAdminPath } from '../../src/utils/adminReturnPath.ts';

test('an admin page path, with or without a plain query, is safe to return to', () => {
  assert.equal(isSafeAdminPath('/admin/inquiries'), true);
  assert.equal(isSafeAdminPath('/admin/dashboard'), true);
  assert.equal(
    isSafeAdminPath('/admin/inquiries?open=8f3c2a1e-5b7d-4c9a-9e21-3d6f7a1b2c4d'),
    true,
  );
  assert.equal(isSafeAdminPath('/admin/job-card/8f3c2a1e'), true);
});

test('anything that could send an admin elsewhere is refused', () => {
  assert.equal(isSafeAdminPath(null), false);
  assert.equal(isSafeAdminPath(undefined), false);
  assert.equal(isSafeAdminPath(''), false);
  assert.equal(isSafeAdminPath('https://evil.test/admin/inquiries'), false);
  assert.equal(isSafeAdminPath('//evil.test/admin/x'), false);
  assert.equal(isSafeAdminPath('/admin//evil.test'), false);
  assert.equal(isSafeAdminPath('/portal/dashboard'), false);
  assert.equal(isSafeAdminPath('/administrator'), false);
  assert.equal(isSafeAdminPath('/admin/inquiries#frag'), false);
  assert.equal(isSafeAdminPath('/admin/x?next=https://evil.test'), false);
  assert.equal(isSafeAdminPath(`/admin/${'a'.repeat(400)}`), false);
});

test('the login page itself is never a place to return to', () => {
  assert.equal(isSafeAdminPath('/admin/login'), false);
  assert.equal(isSafeAdminPath('/admin/login?error=1'), false);
  assert.equal(isSafeAdminPath('/admin/login/extra'), false);
  assert.equal(isSafeAdminPath('/admin/logins'), true);
});
