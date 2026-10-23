import test from 'node:test';
import assert from 'node:assert/strict';

import { discardPrerenderedShell } from '../../src/utils/discardPrerenderedShell.ts';
import { isSpaOnlyPath } from '../../src/utils/spaOnlyRoutes.ts';

function fakeRoot(serverRendered: boolean) {
  const state = { attr: serverRendered, cleared: false };
  return {
    state,
    hasAttribute: () => state.attr,
    removeAttribute: () => { state.attr = false; },
    replaceChildren: () => { state.cleared = true; },
  };
}

test('isSpaOnlyPath matches every route the host answers with the home page', () => {
  for (const path of ['/admin', '/admin/dashboard', '/portal', '/portal/login', '/book', '/go/abc', '/r/abc', '/R/abc', '/pay/123']) {
    assert.equal(isSpaOnlyPath(path), true, path);
  }
});

test('isSpaOnlyPath leaves pre-rendered routes and look-alikes alone', () => {
  for (const path of ['/', '/services', '/contact', '/store', '/administrator', '/booking', '/payment', '/roof-repair', '/go']) {
    assert.equal(isSpaOnlyPath(path), false, path);
  }
});

test('discards the home-page shell and its router data on an admin route', () => {
  const root = fakeRoot(true);
  const win: { __staticRouterHydrationData?: unknown } = { __staticRouterHydrationData: { loaderData: {} } };
  assert.equal(discardPrerenderedShell('/admin/dashboard', root, win), true);
  assert.equal(root.state.attr, false);
  assert.equal(root.state.cleared, true);
  assert.equal('__staticRouterHydrationData' in win, false);
});

test('leaves a pre-rendered route to hydrate normally', () => {
  const root = fakeRoot(true);
  const win = { __staticRouterHydrationData: { loaderData: {} } };
  assert.equal(discardPrerenderedShell('/services', root, win), false);
  assert.equal(root.state.attr, true);
  assert.equal(root.state.cleared, false);
  assert.ok(win.__staticRouterHydrationData);
});

test('does nothing when there is no root or no server markup', () => {
  assert.equal(discardPrerenderedShell('/admin', null, {}), false);
  assert.equal(discardPrerenderedShell('/admin', fakeRoot(false), {}), false);
});
