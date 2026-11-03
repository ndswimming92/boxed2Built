import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkOutreach,
  daysSince,
  idempotencyKey,
  isSendableAddress,
  normalizeBody,
  normalizeSubject,
  renderOutreach,
} from '../../supabase/functions/_shared/partnerOutreach.ts';
import {
  canEmail,
  foundLabel,
  isPlainEmail,
  matchesLeadSearch,
  partnerLinks,
  sortLeads,
} from '../../src/utils/partnerLeads.ts';
import type { PartnerLead } from '../../src/types/partnerLeads.ts';

test('only one plain address is sendable', () => {
  assert.equal(isSendableAddress('leasing@example.com'), true);
  assert.equal(isSendableAddress(' office@movers.co '), true);
  for (const bad of ['', null, 'no-at-sign', 'a@b', 'a@b.com, c@d.com', 'a@b.com;c@d.com', 'Name <a@b.com>', 'a b@c.com']) {
    assert.equal(isSendableAddress(bad), false, String(bad));
  }
});

test('the subject is one line and the body is tidied', () => {
  assert.equal(normalizeSubject('Hello\r\nBcc: x@y.com'), 'Hello Bcc: x@y.com');
  assert.equal(normalizeBody('Hi  \r\n\r\n\r\n\r\nThanks\n'), 'Hi\n\nThanks');
});

test('empty or oversized emails are refused', () => {
  assert.equal(checkOutreach(' ', 'body'), 'subject_missing');
  assert.equal(checkOutreach('Hi', '\n \n'), 'body_missing');
  assert.equal(checkOutreach('x'.repeat(201), 'body'), 'subject_too_long');
  assert.equal(checkOutreach('Hi', 'x'.repeat(5001)), 'body_too_long');
  assert.equal(checkOutreach('Hi', 'Hello there'), null);
});

test('the rendered email escapes what was typed and adds signature and opt-out', () => {
  const out = renderOutreach({
    subject: 'Partnering on move-ins',
    body: 'Hi <b>Sam</b>,\n\nA second paragraph & more.',
    postalAddress: 'PO Box 1, Spring Hill, TN 37174',
  });
  assert.match(out.html, /Hi &lt;b&gt;Sam&lt;\/b&gt;,/);
  assert.doesNotMatch(out.html, /<b>Sam<\/b>/);
  assert.match(out.html, /A second paragraph &amp; more\./);
  assert.match(out.text, /Nicholas Davidson\nOwner, Boxed2Built/);
  assert.match(out.text, /won't email you again/);
  assert.match(out.text, /PO Box 1, Spring Hill, TN 37174/);
  assert.equal(out.html.includes('<script'), false);
});

test('without a postal address the footer falls back to the town', () => {
  const out = renderOutreach({ subject: 'Hi', body: 'Hello', postalAddress: null });
  assert.match(out.text, /Boxed2Built LLC, Spring Hill, TN$/);
});

test('the idempotency key is stable for the same email and changes with it', async () => {
  const a = await idempotencyKey('lead-1', 'a@b.com', 'Hi', 'Body');
  assert.equal(a, await idempotencyKey('lead-1', 'A@B.com', 'Hi', 'Body'));
  assert.notEqual(a, await idempotencyKey('lead-1', 'a@b.com', 'Hi', 'Body 2'));
});

test('daysSince', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  assert.equal(daysSince(null, now), null);
  assert.equal(daysSince('2026-11-03T12:00:00Z', now), 7);
});

test('not a fit and do not contact cannot be emailed', () => {
  assert.equal(canEmail('new'), true);
  assert.equal(canEmail('talking'), true);
  assert.equal(canEmail('not_a_fit'), false);
  assert.equal(canEmail('do_not_contact'), false);
  assert.equal(isPlainEmail('x@y.com'), true);
  assert.equal(isPlainEmail('x@y'), false);
});

test('links keep only labelled http(s) entries', () => {
  assert.deepEqual(
    partnerLinks([
      { label: 'Facebook', url: 'https://facebook.com/x' },
      { label: 'Bad', url: 'javascript:alert(1)' },
      { label: '', url: 'https://example.com' },
      'nope',
    ]),
    [{ label: 'Facebook', url: 'https://facebook.com/x' }],
  );
  assert.deepEqual(partnerLinks(null), []);
});

test('found labels', () => {
  assert.equal(foundLabel('2026-11-03', '2026-11-03'), 'Found today');
  assert.equal(foundLabel('2026-11-02', '2026-11-03'), 'Found yesterday');
  assert.equal(foundLabel('2026-10-30', '2026-11-03'), 'Found 4 days ago');
  assert.equal(foundLabel('2026-10-01', '2026-11-03'), 'Found 2026-10-01');
});

function lead(overrides: Partial<PartnerLead>): PartnerLead {
  return {
    id: overrides.name ?? 'id',
    organization_id: 'org',
    name: 'Lead',
    category: 'moving',
    location: 'Franklin, TN',
    summary: 'A mover',
    why_fit: 'Moves people',
    partnership_idea: null,
    website_url: null,
    email: null,
    email_source_url: null,
    phone: null,
    contact_name: null,
    contact_title: null,
    links: [],
    draft_subject: null,
    draft_body: null,
    notes: null,
    status: 'new',
    status_changed_at: null,
    status_changed_by: null,
    last_emailed_at: null,
    emails_sent: 0,
    found_on: '2026-11-03',
    created_at: '2026-11-03T12:00:00Z',
    updated_at: '2026-11-03T12:00:00Z',
    ...overrides,
  };
}

test('new leads: newest first, then ones with an email', () => {
  const sorted = sortLeads(
    [
      lead({ name: 'Old', found_on: '2026-11-01', email: 'a@b.com' }),
      lead({ name: 'No email', found_on: '2026-11-03' }),
      lead({ name: 'Has email', found_on: '2026-11-03', email: 'c@d.com' }),
    ],
    'new',
  );
  assert.deepEqual(sorted.map((row) => row.name), ['Has email', 'No email', 'Old']);
});

test('search matches name, town, contact and kind', () => {
  const row = lead({ name: 'Two Men Moving', location: 'Columbia, TN', contact_name: 'Dana' });
  assert.equal(matchesLeadSearch(row, 'columbia'), true);
  assert.equal(matchesLeadSearch(row, 'dana'), true);
  assert.equal(matchesLeadSearch(row, 'moving company'), true);
  assert.equal(matchesLeadSearch(row, 'realtor'), false);
});
