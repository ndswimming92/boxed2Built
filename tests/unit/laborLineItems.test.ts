import test from 'node:test';
import assert from 'node:assert/strict';

import {
  groupLaborDescriptionsByJob,
  type LaborInvoiceRow,
  type LaborLineItemRow,
} from '../../supabase/functions/_shared/laborLineItems.ts';

function invoice(id: string, jobId: string): LaborInvoiceRow {
  return { id, job_id: jobId };
}

function item(invoiceId: string, description: string, displayOrder = 0): LaborLineItemRow {
  return { invoice_id: invoiceId, description, display_order: displayOrder };
}

test('a labor line item becomes the job\'s "what is being built" text', () => {
  const byJob = groupLaborDescriptionsByJob(
    [invoice('inv-1', 'job-1')],
    [item('inv-1', 'Farmhouse Queen Murphy Bed With Charging Station')],
  );

  assert.deepEqual(byJob.get('job-1'), ['Farmhouse Queen Murphy Bed With Charging Station']);
});

test('a job with no invoice, or no labor line, has no entry', () => {
  assert.equal(groupLaborDescriptionsByJob([], []).size, 0);
  assert.equal(
    groupLaborDescriptionsByJob([invoice('inv-1', 'job-1')], []).size,
    0,
  );
});

test('multiple labor items on one invoice keep their display order', () => {
  const byJob = groupLaborDescriptionsByJob(
    [invoice('inv-1', 'job-1')],
    [item('inv-1', 'Second piece', 1), item('inv-1', 'First piece', 0)],
  );

  assert.deepEqual(byJob.get('job-1'), ['First piece', 'Second piece']);
});

test('a final invoice restating the deposit\'s line item is not repeated', () => {
  const byJob = groupLaborDescriptionsByJob(
    [invoice('deposit', 'job-1'), invoice('final', 'job-1')],
    [
      item('deposit', 'Farmhouse Queen Murphy Bed'),
      // Different casing and surrounding whitespace, same job — still a duplicate.
      item('final', '  farmhouse queen murphy bed  '),
    ],
  );

  assert.deepEqual(byJob.get('job-1'), ['Farmhouse Queen Murphy Bed']);
});

test('a later invoice with genuinely different work adds a second line', () => {
  const byJob = groupLaborDescriptionsByJob(
    [invoice('deposit', 'job-1'), invoice('change-order', 'job-1')],
    [item('deposit', 'Farmhouse Queen Murphy Bed'), item('change-order', 'Matching nightstand')],
  );

  assert.deepEqual(byJob.get('job-1'), ['Farmhouse Queen Murphy Bed', 'Matching nightstand']);
});

test('an empty or whitespace-only description is skipped', () => {
  const byJob = groupLaborDescriptionsByJob(
    [invoice('inv-1', 'job-1')],
    [item('inv-1', '   '), item('inv-1', 'Real work', 1)],
  );

  assert.deepEqual(byJob.get('job-1'), ['Real work']);
});

test('jobs stay independent of each other', () => {
  const byJob = groupLaborDescriptionsByJob(
    [invoice('inv-1', 'job-1'), invoice('inv-2', 'job-2')],
    [item('inv-1', 'Job one build'), item('inv-2', 'Job two build')],
  );

  assert.deepEqual(byJob.get('job-1'), ['Job one build']);
  assert.deepEqual(byJob.get('job-2'), ['Job two build']);
});
