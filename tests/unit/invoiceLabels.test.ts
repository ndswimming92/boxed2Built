import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  invoiceLabels,
  invoiceNoun,
  amountLabel,
  totalLabel,
  headlineAmount,
  invoiceEmailSubject,
} from '../../src/utils/invoiceLabels.ts';

const MARKER = '// === BEGIN SHARED ===\n';

function sharedPart(path: string): string {
  const source = readFileSync(path, 'utf8');
  const index = source.indexOf(MARKER);
  assert.notEqual(index, -1, `${path} is missing the ${MARKER.trim()} marker`);
  return source.slice(index + MARKER.length);
}

test('the Deno twin has not drifted from the src copy', () => {
  assert.equal(
    sharedPart('supabase/functions/_shared/invoiceLabels.ts'),
    sharedPart('src/utils/invoiceLabels.ts'),
    'src/utils/invoiceLabels.ts and supabase/functions/_shared/invoiceLabels.ts must match below the marker',
  );
});

test('every type the database allows has a label', () => {
  // Mirrors the CHECK constraint on invoices.invoice_type.
  for (const type of ['estimate', 'deposit', 'progress', 'final', 'general']) {
    const labels = invoiceLabels(type);
    for (const [field, value] of Object.entries(labels)) {
      if (field === 'isQuote') continue;
      assert.ok(value, `${type}.${field} should not be empty`);
    }
  }
});

test('an estimate is worded as a quote everywhere', () => {
  const labels = invoiceLabels('estimate');
  assert.equal(labels.header, 'QUOTE');
  assert.equal(labels.bandTag, 'QUOTE');
  assert.equal(labels.type, 'Quote');
  assert.equal(labels.noun, 'quote');
  assert.equal(labels.dateLabel, 'Quote Date');
  assert.equal(labels.fileNoun, 'Quote');
  assert.equal(labels.isQuote, true);
  assert.equal(invoiceNoun('estimate'), 'Quote');
});

test('no other type is treated as a quote', () => {
  for (const type of ['deposit', 'progress', 'final', 'general']) {
    assert.equal(invoiceLabels(type).isQuote, false, `${type} should be a bill`);
    assert.equal(amountLabel(type), 'Amount Due');
    assert.equal(totalLabel(type), 'Total Due');
    assert.equal(invoiceLabels(type).dateLabel, 'Invoice Date');
  }
});

test('a quote is labelled with a total, not an amount owed', () => {
  assert.equal(amountLabel('estimate'), 'Quote Total');
  assert.equal(totalLabel('estimate'), 'Quote Total');
});

test('a quote headlines the job price even after a payment is recorded', () => {
  const paid = { total_amount: 450, amount_due: 0 };
  assert.equal(headlineAmount('estimate', paid), 450);
  assert.equal(headlineAmount('final', paid), 0);
});

test('the email subject calls a quote a quote and claims nothing is due', () => {
  assert.equal(
    invoiceEmailSubject('estimate', 'B2B-041', '$450.00'),
    'Your quote from Boxed2Built — $450.00',
  );
});

test('the invoice email subject is unchanged', () => {
  assert.equal(
    invoiceEmailSubject('final', 'B2B-042', '$450.00'),
    'Invoice B2B-042 — $450.00 Due',
  );
});

test('an unrecognised type falls back to invoice wording rather than throwing', () => {
  const labels = invoiceLabels('something_new');
  assert.equal(labels.header, 'INVOICE');
  assert.equal(labels.isQuote, false);
});
