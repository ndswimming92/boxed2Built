import { test, expect, type Page } from '@playwright/test';
import {
  expandCard,
  header,
  invoice,
  job,
  mountJobs,
  rowOf,
  scheduledJob,
  tile,
  writesTo,
} from './support/jobCardStubs';

/**
 * The buttons on a job card change Nick's data: finishing a job puts money on
 * the books, marking one lost takes it out of the pipeline, an edit rewrites the
 * row and emails the customer a calendar invite. The first job card spec checks
 * that the right buttons appear; this one clicks them and checks what was
 * written, what the screen says afterwards, and what happens when the database
 * says no.
 *
 * Writes are asserted against the stand-in database's record of them, not
 * against a stub's say-so, so a refetch after each action shows the card as it
 * would really look.
 */

// A US zone on purpose: dates are the calendar days they name, and the evening
// completion below is already the next day in UTC.
test.use({ timezoneId: 'America/Chicago' });

const quotedJob = (overrides = {}) =>
  job({
    job_status: 'quoted',
    date_quoted: '2026-09-11',
    date_scheduled: null,
    date_completed: null,
    has_signature: false,
    hours_worked: null,
    final_price: null,
    quoted_price: 300,
    ...overrides,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Mark Lost
// ─────────────────────────────────────────────────────────────────────────────

test.describe('mark a job lost', () => {
  test('shows what is being lost and why it matters', async ({ page }) => {
    await mountJobs(page, { jobs: [quotedJob()] });
    await expandCard(page);
    await page.getByTitle('Mark job as lost').click();

    await expect(page.getByRole('heading', { name: 'Mark Job as Lost' })).toBeVisible();
    await expect(page.getByText('This will remove the job from your active pipeline')).toBeVisible();
    await expect(page.getByText('Customer:')).toBeVisible();
    await expect(page.getByText('Kurt Zollner').last()).toBeVisible();
    await expect(page.getByText('Quoted Price:')).toBeVisible();
    await expect(page.getByText('$300')).toBeVisible();
    // The quote went out on the 11th. Read as UTC midnight it showed the 10th.
    await expect(page.getByText('Date Quoted:').locator('xpath=..')).toContainText('Sep 11, 2026');
  });

  test('records the reason and takes the job out of the pipeline', async ({ page }) => {
    const mounted = await mountJobs(page, { jobs: [quotedJob()] });
    await expandCard(page);
    await page.getByTitle('Mark job as lost').click();

    await expect(page.locator('#lostReasonCategory')).toHaveValue('Price too high');
    await page.locator('#lostReasonCategory').selectOption('Went with competitor');
    await page.locator('#lostReasonNotes').fill('  Chose a cheaper local handyman.  ');
    await page.getByRole('button', { name: 'Mark as Lost' }).click();

    await expect(page.getByText('Job marked as lost successfully!')).toBeVisible();

    const [update] = writesTo(mounted, 'jobs', 'PATCH');
    expect(update.url).toContain('id=eq.job-1');
    expect(update.body).toMatchObject({
      job_status: 'lost',
      lost_reason_category: 'Went with competitor',
      lost_reason_notes: 'Chose a cheaper local handyman.',
    });

    // Lost jobs leave the working list until asked for.
    await expect(page.getByText('No jobs match your filters')).toBeVisible();
  });

  test('every lost reason is on offer', async ({ page }) => {
    await mountJobs(page, { jobs: [quotedJob()] });
    await expandCard(page);
    await page.getByTitle('Mark job as lost').click();

    const options = await page.locator('#lostReasonCategory option').allTextContents();
    expect(options).toEqual([
      'Price too high',
      'Went with competitor',
      'Customer decided not to proceed',
      "Timeline didn't work",
      'Customer unresponsive',
      'Out of service area',
      'Project scope mismatch',
      'Other',
    ]);
  });

  test('backing out writes nothing', async ({ page }) => {
    const mounted = await mountJobs(page, { jobs: [quotedJob()] });
    await expandCard(page);
    await page.getByTitle('Mark job as lost').click();

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Mark Job as Lost' })).toHaveCount(0);
    expect(mounted.writes).toHaveLength(0);
    await expect(header(page, 'Kurt Zollner')).toContainText('Quoted');
  });

  test('a refused update is shown and the job stays put', async ({ page }) => {
    const mounted = await mountJobs(page, {
      jobs: [quotedJob()],
      rejectWrite: (w) => (w.table === 'jobs' ? { status: 403, json: { message: 'permission denied for table jobs' } } : undefined),
    });
    await expandCard(page);
    await page.getByTitle('Mark job as lost').click();
    await page.getByRole('button', { name: 'Mark as Lost' }).click();

    await expect(page.getByText('permission denied for table jobs')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mark Job as Lost' })).toBeVisible();
    expect(mounted.db.jobs[0].job_status).toBe('quoted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cancel
// ─────────────────────────────────────────────────────────────────────────────

test.describe('cancel a job', () => {
  test('says what is being cancelled and when it was booked for', async ({ page }) => {
    await mountJobs(page, { jobs: [scheduledJob()] });
    await expandCard(page);
    await page.getByTitle('Cancel job').click();

    await expect(page.getByRole('heading', { name: 'Cancel Job', level: 3 })).toBeVisible();
    await expect(page.getByText('Customer:')).toBeVisible();
    await expect(page.getByText('Scheduled Date:').locator('xpath=..')).toContainText('Sep 26, 2026');
    await expect(page.getByText(/Cancelled jobs remain in your system/)).toBeVisible();
  });

  test('records the reason and takes the job out of the pipeline', async ({ page }) => {
    const mounted = await mountJobs(page, { jobs: [scheduledJob()] });
    await expandCard(page);
    await page.getByTitle('Cancel job').click();

    await page.locator('#cancellationNotes').fill('Customer is moving away.');
    await page.getByRole('button', { name: 'Cancel Job', exact: true }).click();

    await expect(page.getByText('Job cancelled successfully!')).toBeVisible();
    const [update] = writesTo(mounted, 'jobs', 'PATCH');
    expect(update.url).toContain('id=eq.job-1');
    expect(update.body).toMatchObject({ job_status: 'cancelled', lost_reason_notes: 'Customer is moving away.' });
    await expect(page.getByText('No jobs match your filters')).toBeVisible();
  });

  test('"Keep Job" leaves everything alone', async ({ page }) => {
    const mounted = await mountJobs(page, { jobs: [scheduledJob()] });
    await expandCard(page);
    await page.getByTitle('Cancel job').click();

    await page.getByRole('button', { name: 'Keep Job' }).click();

    await expect(page.getByRole('heading', { name: 'Cancel Job', level: 3 })).toHaveCount(0);
    expect(mounted.writes).toHaveLength(0);
  });

  test('a cancelled job can be brought back into view', async ({ page }) => {
    await mountJobs(page, { jobs: [scheduledJob({ job_status: 'cancelled', lost_reason_notes: 'Moving away' })] });

    await expect(page.getByText('No jobs match your filters')).toBeVisible();
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByLabel('Show lost and cancelled jobs').check();

    await expect(header(page, 'Kurt Zollner')).toContainText('Cancelled');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Complete Job
// ─────────────────────────────────────────────────────────────────────────────

test.describe('the completion wizard', () => {
  async function openWizard(page: Page, jobRow = scheduledJob()) {
    const mounted = await mountJobs(page, { jobs: [jobRow] });
    await expandCard(page);
    await page.getByTitle('Complete job with customer signature').click();
    await expect(page.getByRole('heading', { name: 'Complete Job', level: 2 })).toBeVisible();
    return mounted;
  }

  const next = (page: Page) => page.getByRole('button', { name: 'Continue' });

  async function fillDetails(page: Page, price = '350', hours = '4') {
    await page.locator('#final-price').fill(price);
    await page.locator('#hours-worked').fill(hours);
    await page.getByText('Check all').click();
  }

  test('starts on the details step with the customer and job in view', async ({ page }) => {
    await openWizard(page);

    await expect(page.getByRole('heading', { name: 'Job Details & Checklist' })).toBeVisible();
    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await expect(page.getByText('Kurt Zollner').last()).toBeVisible();
    await expect(page.getByText('(423) 368-3950').last()).toBeVisible();
    await expect(page.getByText('Furniture Assembly').last()).toBeVisible();
  });

  test('will not move on until price, hours and the required checks are in', async ({ page }) => {
    await openWizard(page);

    await expect(next(page)).toBeDisabled();

    await page.locator('#final-price').fill('350');
    await expect(next(page)).toBeDisabled();

    // Zero hours is no hours: a completed job has to have worked some.
    await page.locator('#hours-worked').fill('0');
    await expect(next(page)).toBeDisabled();
    await page.locator('#hours-worked').fill('4');
    await expect(next(page)).toBeDisabled();

    // The three required checks, not just any.
    for (const label of ['All furniture assembled correctly', 'Work area cleaned up']) {
      await page.getByText(label).click();
    }
    await expect(next(page)).toBeDisabled();
    await page.getByText('Customer walkthrough completed').click();
    await expect(next(page)).toBeEnabled();
  });

  test('a signature is required unless it is skipped on purpose', async ({ page }) => {
    await openWizard(page);
    await fillDetails(page);
    await next(page).click();

    await expect(page.getByRole('heading', { name: 'Upload Completion Photos' })).toBeVisible();
    await next(page).click();

    await expect(page.getByRole('heading', { name: 'Customer Sign-off' })).toBeVisible();
    await expect(page.getByText('Customer signature required to complete job')).toBeVisible();
    await expect(next(page)).toBeDisabled();

    await page.getByText('Skip signature for this job').click();
    await expect(next(page)).toBeEnabled();
  });

  test('Back returns to the step before without losing what was typed', async ({ page }) => {
    await openWizard(page);
    await fillDetails(page, '425.50', '3.5');
    await next(page).click();
    await expect(page.getByText('Step 2 of 4')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await expect(page.locator('#final-price')).toHaveValue('425.50');
    await expect(page.locator('#hours-worked')).toHaveValue('3.5');
  });

  test('a finished job is saved, signed off and put on the books', async ({ page }) => {
    // 8pm Saturday in Chicago is already Sunday in UTC. The job was finished on
    // the 26th, and that is the date it has to carry.
    await page.clock.setFixedTime(new Date('2026-09-27T01:00:00Z'));

    const mounted = await openWizard(page);
    await fillDetails(page, '350', '4');
    await next(page).click();
    await next(page).click();
    await page.getByText('Skip signature for this job').click();
    await next(page).click();

    await expect(page.getByRole('heading', { name: 'Notes & Follow-up' })).toBeVisible();
    await page.locator('#admin-notes').fill('Customer wants the shelf moved next visit.');
    await page.getByRole('button', { name: 'Complete Job' }).last().click();

    await expect(page.getByText('Job completed successfully!')).toBeVisible();

    // Numbers first: the database refuses a completion date without hours.
    const jobWrites = writesTo(mounted, 'jobs', 'PATCH');
    expect(jobWrites[0].body).toEqual({ hours_worked: 4, final_price: 350 });

    const [completion] = writesTo(mounted, 'job_completions', 'POST');
    expect(rowOf(completion)).toMatchObject({
      job_id: 'job-1',
      customer_name: 'Kurt Zollner',
      final_price: 350,
      admin_notes: 'Customer wants the shelf moved next visit.',
      is_customer_satisfied: true,
      signature_data: '',
    });

    expect(jobWrites[1].body).toMatchObject({
      job_status: 'completed',
      date_completed: '2026-09-26',
      has_signature: false,
    });

    // And it is a finished card now.
    await expect(header(page, 'Kurt Zollner')).toContainText('Completed');
  });

  test('a follow-up reminder is created when asked for', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-27T01:00:00Z'));

    const mounted = await openWizard(page);
    await fillDetails(page);
    await next(page).click();
    await next(page).click();
    await page.getByText('Skip signature for this job').click();
    await next(page).click();

    await page.getByText('Create follow-up reminder').click();
    await page.locator('#reminder-type').selectOption('warranty_check');
    // The default is a week out, counted from the evening of the 26th — not the 27th.
    await expect(page.locator('#reminder-date')).toHaveValue('2026-10-03');
    await page.getByRole('button', { name: 'Complete Job' }).last().click();

    await expect(page.getByText('Job completed successfully!')).toBeVisible();
    const [reminder] = writesTo(mounted, 'job_completion_reminders', 'POST');
    expect(rowOf(reminder)).toMatchObject({
      job_id: 'job-1',
      reminder_type: 'warranty_check',
      scheduled_date: '2026-10-03',
      status: 'pending',
    });
  });

  test('a satisfied customer\'s comment becomes a verified review', async ({ page }) => {
    // Saturday evening in Chicago, Sunday in UTC: the review is dated the same day as the job.
    await page.clock.setFixedTime(new Date('2026-09-27T01:00:00Z'));
    const mounted = await openWizard(page);
    await fillDetails(page);
    await next(page).click();
    await next(page).click();

    await page.locator('#satisfaction-comment').fill('Great work, very tidy.');
    await page.getByText('Skip signature for this job').click();
    await next(page).click();
    await page.getByRole('button', { name: 'Complete Job' }).last().click();

    await expect(page.getByText('Job completed successfully!')).toBeVisible();
    const [review] = writesTo(mounted, 'customer_reviews', 'POST');
    expect(rowOf(review)).toMatchObject({
      author_name: 'Kurt Zollner',
      review_body: 'Great work, very tidy.',
      rating_value: 5,
      is_verified: true,
      source: 'job_completion',
      date_published: '2026-09-26',
    });
  });

  test('no comment, no review', async ({ page }) => {
    const mounted = await openWizard(page);
    await fillDetails(page);
    await next(page).click();
    await next(page).click();
    await page.getByText('Skip signature for this job').click();
    await next(page).click();
    await page.getByRole('button', { name: 'Complete Job' }).last().click();

    await expect(page.getByText('Job completed successfully!')).toBeVisible();
    expect(writesTo(mounted, 'customer_reviews')).toHaveLength(0);
    expect(writesTo(mounted, 'job_completion_reminders')).toHaveLength(0);
  });

  test('a database refusal is shown and the job is not marked complete', async ({ page }) => {
    const mounted = await mountJobs(page, {
      jobs: [scheduledJob()],
      rejectWrite: (w) =>
        w.table === 'job_completions' ? { status: 400, json: { message: 'completion rejected' } } : undefined,
    });
    await expandCard(page);
    await page.getByTitle('Complete job with customer signature').click();
    await fillDetails(page);
    await next(page).click();
    await next(page).click();
    await page.getByText('Skip signature for this job').click();
    await next(page).click();
    await page.getByRole('button', { name: 'Complete Job' }).last().click();

    await expect(page.getByText('completion rejected')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Complete Job', level: 2 })).toBeVisible();
    expect(mounted.db.jobs[0].job_status).toBe('scheduled');
  });

  test('closing the wizard writes nothing', async ({ page }) => {
    const mounted = await openWizard(page);
    await fillDetails(page);

    await page.getByRole('heading', { name: 'Complete Job', level: 2 }).locator('xpath=../..').getByRole('button').first().click();

    await expect(page.getByRole('heading', { name: 'Complete Job', level: 2 })).toHaveCount(0);
    expect(mounted.writes).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edit
// ─────────────────────────────────────────────────────────────────────────────

test.describe('editing a job', () => {
  const field = (page: Page, name: string) => page.locator(`input[name="${name}"]`);

  async function openEdit(page: Page, stubs = {}) {
    const mounted = await mountJobs(page, stubs);
    await expandCard(page);
    await page.getByTitle('Edit job').click();
    await expect(page.getByRole('heading', { name: 'Edit Job' })).toBeVisible();
    return mounted;
  }

  test('opens with the job\'s own details filled in', async ({ page }) => {
    await openEdit(page);

    await expect(field(page, 'client_name')).toHaveValue('Kurt Zollner');
    await expect(field(page, 'client_phone')).toHaveValue('(423) 368-3950');
    await expect(field(page, 'client_email')).toHaveValue('kjzollner21@yahoo.com');
    await expect(field(page, 'date_scheduled')).toHaveValue('2026-09-26');
    await expect(field(page, 'hours_worked')).toHaveValue('4.5');
  });

  test('saves the change, closes, and the card shows it', async ({ page }) => {
    const mounted = await openEdit(page);

    await field(page, 'client_phone').fill('(615) 555-0100');
    await page.getByRole('button', { name: 'Save Job' }).click();

    await expect(page.getByRole('heading', { name: 'Edit Job' })).toHaveCount(0);
    const [update] = writesTo(mounted, 'jobs', 'PATCH');
    expect(update.url).toContain('id=eq.job-1');
    expect(update.body).toMatchObject({ client_name: 'Kurt Zollner', client_phone: '(615) 555-0100' });

    await expect(header(page, 'Kurt Zollner')).toContainText('(615) 555-0100');
  });

  test('saving a scheduled job emails the customer the calendar invite', async ({ page }) => {
    const mounted = await openEdit(page);

    await page.getByRole('button', { name: 'Save Job' }).click();

    await expect.poll(() => mounted.calls.schedule.length).toBe(1);
    expect(mounted.calls.schedule[0].body).toMatchObject({ jobId: 'job-1' });
  });

  test('an unscheduled job sends no invite', async ({ page }) => {
    const mounted = await openEdit(page, { jobs: [quotedJob()] });

    await page.getByRole('button', { name: 'Save Job' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Job' })).toHaveCount(0);

    expect(mounted.calls.schedule).toHaveLength(0);
  });

  test('a failed invite never turns a good save into an error', async ({ page }) => {
    const mounted = await openEdit(page, {
      schedule: () => ({ status: 500, json: { success: false, error: 'mail is down' } }),
    });

    await page.getByRole('button', { name: 'Save Job' }).click();

    await expect(page.getByRole('heading', { name: 'Edit Job' })).toHaveCount(0);
    expect(writesTo(mounted, 'jobs', 'PATCH')).toHaveLength(1);
  });

  test('will not save without a customer name', async ({ page }) => {
    const mounted = await openEdit(page);

    await field(page, 'client_name').fill('   ');
    await page.getByRole('button', { name: 'Save Job' }).click();

    await expect(page.getByText('Customer name is required')).toBeVisible();
    expect(mounted.writes).toHaveLength(0);
  });

  test('a completed job cannot be saved without hours', async ({ page }) => {
    const mounted = await openEdit(page);

    await field(page, 'hours_worked').fill('');
    await page.getByRole('button', { name: 'Save Job' }).click();

    await expect(page.getByText('Hours worked is required and must be greater than 0 when a job is completed.')).toBeVisible();
    expect(mounted.writes).toHaveLength(0);
  });

  test('a refused save is shown and the form stays open', async ({ page }) => {
    const mounted = await openEdit(page, {
      rejectWrite: (w) => (w.table === 'jobs' ? { status: 403, json: { message: 'row-level security' } } : undefined),
    });

    await field(page, 'client_phone').fill('(615) 555-0100');
    await page.getByRole('button', { name: 'Save Job' }).click();

    await expect(page.getByText('row-level security')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit Job' })).toBeVisible();
    expect(mounted.db.jobs[0].client_phone).toBe('(423) 368-3950');
  });

  test('Cancel closes the form without saving', async ({ page }) => {
    const mounted = await openEdit(page);

    await field(page, 'client_phone').fill('(615) 555-0100');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Edit Job' })).toHaveCount(0);
    expect(mounted.writes).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Copy
// ─────────────────────────────────────────────────────────────────────────────

test.describe('copying a job', () => {
  test('starts a repeat job for the same customer with the dates cleared', async ({ page }) => {
    const mounted = await mountJobs(page);
    await expandCard(page);
    await page.getByTitle('Copy job').click();

    await expect(page.getByRole('heading', { name: 'Copy Job' })).toBeVisible();
    await expect(page.locator('input[name="client_name"]')).toHaveValue('Kurt Zollner');
    await expect(page.locator('input[name="client_email"]')).toHaveValue('kjzollner21@yahoo.com');
    // A new visit: nothing about the last one carries over.
    await expect(page.locator('input[name="date_scheduled"]')).toHaveValue('');
    await expect(page.locator('input[name="date_quoted"]')).toHaveValue('');
    await expect(page.locator('input[name="hours_worked"]')).toHaveValue('');
    await expect(page.locator('textarea[name="notes"]')).toHaveValue('Copied from previous job');

    await page.getByRole('button', { name: 'Save Job' }).click();

    await expect(page.getByRole('heading', { name: 'Copy Job' })).toHaveCount(0);
    const [created] = writesTo(mounted, 'jobs', 'POST');
    expect(rowOf(created)).toMatchObject({
      business_id: 'biz-1',
      client_name: 'Kurt Zollner',
      client_email: 'kjzollner21@yahoo.com',
      job_type: 'Furniture Assembly',
      repeat_client: true,
      date_completed: null,
      final_price: null,
    });
    // The original is untouched.
    expect(writesTo(mounted, 'jobs', 'PATCH')).toHaveLength(0);
    await expect(page.getByRole('heading', { level: 3, name: 'Kurt Zollner' })).toHaveCount(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invoices
// ─────────────────────────────────────────────────────────────────────────────

test.describe('invoices on a job', () => {
  const attached = () => [
    invoice({ id: 'inv-1', invoice_number: 'INV-1001', status: 'sent', total_amount: 300, amount_due: 300 }),
    invoice({
      id: 'inv-2',
      invoice_number: 'INV-1002',
      status: 'paid',
      invoice_date: '2026-09-27',
      due_date: null,
      total_amount: 120,
      amount_due: 0,
    }),
  ];

  test('lists each invoice with its status, dates and what is owed', async ({ page }) => {
    await mountJobs(page, { invoices: attached() });
    await expandCard(page);

    await expect(page.getByRole('button', { name: 'Invoices (2)' })).toBeVisible();
    await page.getByRole('button', { name: 'Invoices (2)' }).click();

    await expect(page.getByText('INV-1001')).toBeVisible();
    await expect(page.getByText('Sent', { exact: true })).toBeVisible();
    // Stored as dates; shown as the days they name.
    await expect(page.getByText('Date: Sep 26, 2026')).toBeVisible();
    await expect(page.getByText('Due: Oct 10, 2026')).toBeVisible();
    await expect(page.getByText('$300.00 due')).toBeVisible();

    await expect(page.getByText('INV-1002')).toBeVisible();
    await expect(page.getByText('Paid', { exact: true })).toBeVisible();
    await expect(page.getByText('Date: Sep 27, 2026')).toBeVisible();
    // Nothing owed on the paid one, and no due date to show.
    await expect(page.getByText('$120.00 due')).toHaveCount(0);
  });

  test('a job with no invoices shows no invoice section', async ({ page }) => {
    await mountJobs(page, { invoices: [] });
    await expandCard(page);

    await expect(page.getByText('Final Price')).toBeVisible();
    await expect(page.getByText(/Invoices \(/)).toHaveCount(0);
  });

  test('another job\'s invoices are not listed', async ({ page }) => {
    await mountJobs(page, { invoices: [invoice({ id: 'inv-9', job_id: 'job-other', invoice_number: 'INV-9000' })] });
    await expandCard(page);

    await expect(page.getByText('Final Price')).toBeVisible();
    await expect(page.getByText('INV-9000')).toHaveCount(0);
  });

  test('detach asks first, then unlinks without deleting', async ({ page }) => {
    const mounted = await mountJobs(page, { invoices: attached() });
    await expandCard(page);
    await page.getByRole('button', { name: 'Invoices (2)' }).click();

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('detach invoice INV-1001');
      expect(dialog.message()).toContain('not be deleted');
      void dialog.dismiss();
    });
    await page.getByTitle('Detach from job').first().click();
    expect(mounted.writes).toHaveLength(0);

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTitle('Detach from job').first().click();

    await expect(page.getByRole('button', { name: 'Invoices (1)' })).toBeVisible();
    const [detach] = writesTo(mounted, 'invoices', 'PATCH');
    expect(detach.url).toContain('id=eq.inv-1');
    expect(detach.body).toEqual({ job_id: null });
    expect(writesTo(mounted, 'invoices', 'DELETE')).toHaveLength(0);
    // Still there, just unattached.
    expect(mounted.db.invoices.find((i) => i.id === 'inv-1')).toBeTruthy();
  });

  test('"Create invoice from job" starts an invoice for this customer', async ({ page }) => {
    await mountJobs(page);
    await expandCard(page);
    await page.getByTitle('Create invoice from job').click();

    await expect(page.getByRole('heading', { name: 'Create Invoice' })).toBeVisible();
    await expect(page.locator('input[name="clientName"]')).toHaveValue('Kurt Zollner');
    await expect(page.locator('input[name="clientEmail"]')).toHaveValue('kjzollner21@yahoo.com');
    await expect(page.locator('input[name="clientPhone"]')).toHaveValue('(423) 368-3950');
    await expect(page.locator('textarea[name="clientAddress"]')).toHaveValue('2014 Beamon Drive Franklin, TN 37064');
  });

  test('"Attach existing invoice" offers only invoices with no job, best match first', async ({ page }) => {
    await mountJobs(page, {
      invoices: [
        invoice({ id: 'inv-1', job_id: 'job-1', invoice_number: 'INV-1001' }),
        invoice({
          id: 'inv-2',
          job_id: null,
          invoice_number: 'INV-2000',
          client_name: 'Someone Else',
          client_email: 'else@example.com',
          created_at: '2026-09-28T12:00:00Z',
        }),
        invoice({ id: 'inv-3', job_id: null, invoice_number: 'INV-3000' }),
      ],
    });
    await expandCard(page);
    await page.getByTitle('Attach existing invoice').click();

    await expect(page.getByRole('heading', { name: /Attach Invoice to Job/ })).toBeVisible();
    await expect(page.getByText('Attaching invoice to:')).toContainText('Kurt Zollner');

    // Already on this job, so not on offer.
    await expect(page.getByRole('heading', { name: 'INV-1001' })).toHaveCount(0);

    // The customer's own invoice leads even though the other one is newer.
    const numbers = await page.getByRole('heading', { level: 3, name: /^INV-/ }).allTextContents();
    expect(numbers).toEqual(['INV-3000', 'INV-2000']);
    await expect(page.getByText('Matching Client')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Attach Invoice' })).toBeDisabled();

    await page.getByPlaceholder(/Search by invoice number/).fill('else@example');
    await expect(page.getByRole('heading', { name: 'INV-2000' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'INV-3000' })).toHaveCount(0);
  });

  test('attaching links the chosen invoice to the job', async ({ page }) => {
    const mounted = await mountJobs(page, {
      invoices: [invoice({ id: 'inv-3', job_id: null, invoice_number: 'INV-3000' })],
    });
    await expandCard(page);
    await page.getByTitle('Attach existing invoice').click();

    await page.getByRole('heading', { name: 'INV-3000' }).click();
    await page.getByRole('button', { name: 'Attach Invoice' }).click();

    await expect(page.getByText('Invoice attached successfully!')).toBeVisible();
    const [attach] = writesTo(mounted, 'invoices', 'PATCH');
    expect(attach.url).toContain('id=eq.inv-3');
    expect(attach.body).toEqual({ job_id: 'job-1' });
  });

  test('attaching someone else\'s invoice warns first', async ({ page }) => {
    const mounted = await mountJobs(page, {
      invoices: [
        invoice({
          id: 'inv-2',
          job_id: null,
          invoice_number: 'INV-2000',
          client_name: 'Someone Else',
          client_email: 'else@example.com',
        }),
      ],
    });
    await expandCard(page);
    await page.getByTitle('Attach existing invoice').click();
    await page.getByRole('heading', { name: 'INV-2000' }).click();

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain("customer information doesn't match");
      expect(dialog.message()).toContain('Someone Else');
      void dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Attach Invoice' }).click();

    expect(mounted.writes).toHaveLength(0);
  });

  test('with nothing to attach it says so', async ({ page }) => {
    await mountJobs(page, { invoices: [] });
    await expandCard(page);
    await page.getByTitle('Attach existing invoice').click();

    await expect(page.getByText('No unattached invoices available')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Contractors
// ─────────────────────────────────────────────────────────────────────────────

test.describe('contractors on a job', () => {
  const people = [
    { id: 'c-1', business_id: 'biz-1', name: 'Dana Ruiz', is_active: true },
    { id: 'c-2', business_id: 'biz-1', name: 'Marcus Webb', is_active: true },
  ];

  const paid = () => [
    {
      id: 'jc-1',
      business_id: 'biz-1',
      job_id: 'job-1',
      contractor_id: 'c-1',
      amount_paid: 54.5,
      work_description: 'Assembled the wardrobes',
      payment_date: '2026-09-27',
      payment_method: 'Cash',
      notes: 'Paid at the door',
      is_active: true,
      created_at: '2026-09-27T12:00:00Z',
    },
  ];

  test('an open card with nobody on it offers to add someone', async ({ page }) => {
    await mountJobs(page, { contractors: people });
    await expandCard(page);

    await expect(page.getByRole('button', { name: /Contractors \(0\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Contractor' })).toBeVisible();
  });

  test('shows who was paid, how much, for what and when', async ({ page }) => {
    await mountJobs(page, { contractors: people, jobContractors: paid() });
    await expandCard(page);

    await expect(page.getByRole('button', { name: /Contractors \(1\)/ })).toContainText('$54.50 paid');
    await expect(page.getByText('Dana Ruiz')).toBeVisible();
    await expect(page.getByText('Assembled the wardrobes')).toBeVisible();
    // A date column: the 27th, not the 26th.
    await expect(page.getByText('Paid Sep 27, 2026')).toBeVisible();
    await expect(page.getByText('Cash', { exact: true })).toBeVisible();
    await expect(page.getByText('Paid at the door')).toBeVisible();
  });

  test('adding a contractor records the payment', async ({ page }) => {
    const mounted = await mountJobs(page, { contractors: people });
    await expandCard(page);
    await page.getByRole('button', { name: 'Add Contractor' }).click();

    await expect(page.getByRole('heading', { name: 'Add Contractor to Job' })).toBeVisible();
    await page.locator('select').first().selectOption('c-2');
    await page.getByPlaceholder('0.00').fill('80');
    await page.getByPlaceholder('e.g. Assembled 3 dressers').fill('Mounted the TV');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Add Contractor to Job' })).toHaveCount(0);
    const [created] = writesTo(mounted, 'job_contractors', 'POST');
    expect(rowOf(created)).toMatchObject({
      job_id: 'job-1',
      business_id: 'biz-1',
      contractor_id: 'c-2',
      amount_paid: 80,
      work_description: 'Mounted the TV',
    });

    // The card now shows them, and what they cost comes out of the profit.
    await expect(page.getByText('Marcus Webb')).toBeVisible();
    await expect(tile(page, 'Contractor Pay')).toContainText('$80.00');
  });

  test('asks for a contractor and a real amount first', async ({ page }) => {
    const mounted = await mountJobs(page, { contractors: people });
    await expandCard(page);
    await page.getByRole('button', { name: 'Add Contractor' }).click();

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Please select a contractor')).toBeVisible();

    await page.locator('select').first().selectOption('c-1');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Please enter a valid amount paid')).toBeVisible();

    await page.getByPlaceholder('0.00').fill('-5');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Please enter a valid amount paid')).toBeVisible();

    expect(mounted.writes).toHaveLength(0);
  });

  test('editing a payment changes it', async ({ page }) => {
    const mounted = await mountJobs(page, { contractors: people, jobContractors: paid() });
    await expandCard(page);

    await page.getByTitle('Edit payment').click();
    await expect(page.getByRole('heading', { name: 'Edit Contractor Payment' })).toBeVisible();
    await page.getByPlaceholder('0.00').fill('60');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Edit Contractor Payment' })).toHaveCount(0);
    const [update] = writesTo(mounted, 'job_contractors', 'PATCH');
    expect(update.url).toContain('id=eq.jc-1');
    expect(update.body).toMatchObject({ amount_paid: 60 });
    await expect(page.getByRole('button', { name: /Contractors \(1\)/ })).toContainText('$60.00 paid');
  });

  test('removing a contractor asks first and deletes the payment record', async ({ page }) => {
    const mounted = await mountJobs(page, { contractors: people, jobContractors: paid() });
    await expandCard(page);

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Remove Dana Ruiz from this job?');
      void dialog.dismiss();
    });
    await page.getByTitle('Remove from job').click();
    expect(mounted.deletes).toHaveLength(0);

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTitle('Remove from job').click();

    await expect(page.getByText('No contractors on this job yet.')).toBeVisible();
    expect(mounted.deletes).toHaveLength(1);
    expect(mounted.deletes[0]).toContain('id=eq.jc-1');
    // And the profit is whole again.
    await expect(page.getByText('Contractor Pay')).toHaveCount(0);
  });
});
