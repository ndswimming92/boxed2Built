/**
 * The post-login destination now travels through an email, so it crosses a
 * trust boundary a same-tab OAuth redirect never did. These cover that only
 * portal paths survive, and that the callback URL wins over the per-tab
 * sessionStorage value a magic-link landing can never have.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PORTAL_DEFAULT_PATH,
  getSafeNextPath,
  resolveNextPath,
} from '../../src/utils/portalNextPath.ts';

test('keeps portal paths as they are', () => {
  for (const path of ['/portal', '/portal/jobs', '/portal/invoices', '/portal/jobs/abc-123']) {
    assert.equal(getSafeNextPath(path), path);
  }
});

test('falls back to the dashboard for anything outside the portal', () => {
  const rejected = [
    '/admin/dashboard',
    '/admin',
    '/',
    '/contact',
    'https://evil.com',
    'http://evil.com/portal/jobs',
    '//evil.com',
    '//evil.com/portal',
    'javascript:alert(1)',
  ];

  for (const path of rejected) {
    assert.equal(getSafeNextPath(path), PORTAL_DEFAULT_PATH, path);
  }
});

test('rejects paths that only share the portal prefix', () => {
  // startsWith('/portal') alone would wave these through.
  assert.equal(getSafeNextPath('/portalXyz'), PORTAL_DEFAULT_PATH);
  assert.equal(getSafeNextPath('/portal-admin'), PORTAL_DEFAULT_PATH);
  assert.equal(getSafeNextPath('/portal.evil.com'), PORTAL_DEFAULT_PATH);
});

test('rejects traversal that normalises out of the portal', () => {
  // These pass startsWith('/portal') but the browser resolves them elsewhere
  // before the router is involved.
  assert.equal(getSafeNextPath('/portal/../admin/dashboard'), PORTAL_DEFAULT_PATH);
  assert.equal(getSafeNextPath('/portal/jobs/../../admin'), PORTAL_DEFAULT_PATH);
});

test('falls back for empty and missing values', () => {
  assert.equal(getSafeNextPath(null), PORTAL_DEFAULT_PATH);
  assert.equal(getSafeNextPath(undefined), PORTAL_DEFAULT_PATH);
  assert.equal(getSafeNextPath(''), PORTAL_DEFAULT_PATH);
});

test('resolveNextPath prefers the callback URL over sessionStorage', () => {
  assert.equal(resolveNextPath('/portal/invoices', '/portal/jobs'), '/portal/invoices');
});

test('resolveNextPath falls back to the stored path when the URL has none', () => {
  // The Google path: nothing in the URL, the value is in the same tab's storage.
  assert.equal(resolveNextPath(null, '/portal/jobs'), '/portal/jobs');
  assert.equal(resolveNextPath('', '/portal/jobs'), '/portal/jobs');
});

test('resolveNextPath falls back to the stored path when the URL value is unsafe', () => {
  assert.equal(resolveNextPath('/admin/dashboard', '/portal/jobs'), '/portal/jobs');
});

test('resolveNextPath lands on the dashboard when neither is usable', () => {
  assert.equal(resolveNextPath(null, null), PORTAL_DEFAULT_PATH);
  assert.equal(resolveNextPath('/admin', '//evil.com'), PORTAL_DEFAULT_PATH);
});
