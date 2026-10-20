import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatEndsOn,
  renderDigestEmail,
  renderWelcomeEmail,
  safeHttpUrl,
  type DigestSale,
} from '../../supabase/functions/_shared/salesDigestEmail.ts';
import { unsubscribeHeaders, unsubscribePageUrl } from '../../supabase/functions/_shared/salesSubscribers.ts';

const SITE = 'https://boxed2built.com';
const UNSUB = unsubscribePageUrl(SITE, 'abc-123');

const sale = (overrides: Partial<DigestSale> = {}): DigestSale => ({
  id: '1',
  title: 'Lovesac: up to 25% off sitewide',
  summary: 'Take 15% off orders of $1,000 or more.',
  store_name: 'Lovesac',
  sale_scope: 'online',
  ends_on: '2026-10-21',
  source_url: 'https://www.lovesac.com/sale',
  ...overrides,
});

test('the digest names the sale count and links every sale, the site and the unsubscribe page', () => {
  const email = renderDigestEmail({
    name: 'Kurt Zollner',
    sales: [sale(), sale({ id: '2', title: 'Arhaus sale', store_name: 'Arhaus', sale_scope: 'local' })],
    unsubscribeUrl: UNSUB,
    siteUrl: SITE,
  });

  assert.equal(email.subject, '2 new furniture sales near Spring Hill');
  for (const part of [email.html, email.text]) {
    assert.match(part, /Kurt/);
    assert.match(part, /Lovesac: up to 25% off sitewide/);
    assert.match(part, /Arhaus sale/);
    assert.ok(part.includes(UNSUB));
  }
  assert.match(email.html, /October 21, 2026/);
  assert.ok(email.html.includes('https://boxed2built.com/news'));
});

test('a single sale gets the store in the subject', () => {
  const email = renderDigestEmail({ name: 'Kurt', sales: [sale()], unsubscribeUrl: UNSUB, siteUrl: SITE });
  assert.equal(email.subject, 'New furniture sale: Lovesac');
});

test('sale text is escaped, and a non-http source link is not made clickable', () => {
  const email = renderDigestEmail({
    name: '<b>Eve</b>',
    sales: [sale({ title: '<script>alert(1)</script>', source_url: 'javascript:alert(1)' })],
    unsubscribeUrl: UNSUB,
    siteUrl: SITE,
  });

  assert.ok(!email.html.includes('<script>'));
  assert.ok(!email.html.includes('<b>Eve'));
  assert.ok(!email.html.includes('javascript:'));
  assert.ok(!email.text.includes('javascript:'));
});

test('a long summary is cut at a word boundary', () => {
  const email = renderDigestEmail({
    name: 'Kurt',
    sales: [sale({ summary: 'word '.repeat(200) })],
    unsubscribeUrl: UNSUB,
    siteUrl: SITE,
  });
  assert.match(email.text, /word…/);
});

test('the welcome email greets by first name and carries the unsubscribe link', () => {
  const email = renderWelcomeEmail({ name: 'Kurt Zollner', unsubscribeUrl: UNSUB, siteUrl: SITE });
  assert.match(email.subject, /subscribed/i);
  assert.match(email.html, /Kurt/);
  assert.ok(!email.html.includes('Zollner'));
  assert.ok(email.html.includes(UNSUB));
  assert.ok(email.text.includes(UNSUB));
});

test('end dates print as the day they name', () => {
  assert.equal(formatEndsOn('2026-10-05'), 'October 5, 2026');
  assert.equal(formatEndsOn(null), null);
  assert.equal(formatEndsOn('soon'), null);
});

test('only http and https links pass', () => {
  assert.equal(safeHttpUrl('https://a.com/x'), 'https://a.com/x');
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpUrl('not a url'), null);
});

test('mail apps get a one-click unsubscribe header pointing at the function', () => {
  const headers = unsubscribeHeaders('https://x.supabase.co', SITE, 'tok');
  assert.match(headers['List-Unsubscribe'], /functions\/v1\/sales-subscription\?token=tok/);
  assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});
