import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TEMPLATE_DEFAULTS,
  countSegments,
  findNonGsmCharacters,
  renderPreview,
  validateTemplate as validateInBrowser,
} from '../../src/constants/smsTemplates.ts';
import { validateTemplate as validateOnServer } from '../../supabase/functions/_shared/sentTemplates.ts';

// What each sender passes today (send-booking-email, send-customer-job-reminders,
// send-invoice-email). A rename on either side breaks the text, so this pins them.
const SENDER_PARAMETERS: Record<string, string[]> = {
  booking_confirmed: ['customerName', 'serviceName', 'appointmentTime', 'bookingReference'],
  job_reminder: ['customerName', 'appointmentTime', 'serviceName', 'serviceAddress'],
  quote_ready: ['customerName', 'documentNumber', 'amount', 'viewLink'],
  invoice_ready: ['customerName', 'documentNumber', 'amount', 'viewLink'],
};

for (const template of TEMPLATE_DEFAULTS) {
  test(`${template.key}: the default wording passes both the page and the server checks`, () => {
    assert.deepEqual(validateInBrowser(template.body, template.variables), []);
    assert.deepEqual(
      validateOnServer({ secret: template.secret, category: template.category, body: template.body, variables: template.variables }),
      [],
    );
  });

  test(`${template.key}: stays within two text segments with its sample values`, () => {
    const { segments, unicode } = countSegments(renderPreview(template.body, template.variables));
    assert.equal(unicode, false);
    assert.ok(segments <= 2, `${template.key} would bill ${segments} segments`);
  });

  test(`${template.key}: names the business, the way to opt out and a phone number`, () => {
    assert.match(template.body, /^Boxed2Built: /);
    assert.match(template.body, /Reply STOP to opt out\./);
    assert.match(template.body, /\(615\) 403-4538/);
  });

  test(`${template.key}: variables are numbered in the order they appear`, () => {
    const order = [...template.body.matchAll(/\{\{(\d+):variable\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(order, template.variables.map((v) => v.id));
  });
}

for (const [key, names] of Object.entries(SENDER_PARAMETERS)) {
  test(`${key}: variable names match what the sender passes`, () => {
    const template = TEMPLATE_DEFAULTS.find((t) => t.key === key);
    assert.ok(template);
    assert.deepEqual(template.variables.map((v) => v.name).sort(), [...names].sort());
  });
}

test('the promotion is marketing and says message and data rates may apply', () => {
  const promotion = TEMPLATE_DEFAULTS.find((t) => t.key === 'promotion');
  assert.equal(promotion?.category, 'MARKETING');
  assert.match(promotion?.body ?? '', /Msg&data rates may apply\./);
});

test('countSegments follows the 160 and 153 rule, and the 70 and 67 rule for special characters', () => {
  assert.deepEqual(countSegments('a'.repeat(160)), { length: 160, segments: 1, unicode: false });
  assert.deepEqual(countSegments('a'.repeat(161)), { length: 161, segments: 2, unicode: false });
  assert.equal(countSegments('a'.repeat(306)).segments, 2);
  assert.equal(countSegments('a'.repeat(307)).segments, 3);
  assert.deepEqual(countSegments(`${'a'.repeat(69)}’`), { length: 70, segments: 1, unicode: true });
  assert.equal(countSegments(`${'a'.repeat(70)}’`).segments, 2);
  // An emoji is two UTF-16 units: 69 + 2 = 71, one over the single-segment limit.
  assert.deepEqual(countSegments(`${'a'.repeat(69)}\u{1F600}`), { length: 71, segments: 2, unicode: true });
  // [ ] { } cost two characters each in the standard alphabet.
  assert.equal(countSegments(`${'a'.repeat(159)}[`).segments, 2);
});

test('curly quotes, long dashes, ellipses and emoji are found; variable markers and plain text are not', () => {
  assert.deepEqual(findNonGsmCharacters("Boxed2Built: Hi {{0:variable}}, you're set. $185.00 (ref #4) - ok & done"), []);
  assert.deepEqual(findNonGsmCharacters('you’re — set…'), ['’', '—', '…']);
  assert.deepEqual(findNonGsmCharacters('hi \u{1F600}'), ['\u{1F600}']);
});
