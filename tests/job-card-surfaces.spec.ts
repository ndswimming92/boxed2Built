import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  FUNCTION_NAMES,
  allowedHeadersFor,
  expandCard,
  header,
  job,
  mountJobs,
  mountView,
  rowOf,
  scheduledJob,
  sentHeaders,
  signInAsAdmin,
  signInAsPortalCustomer,
  tile,
  writesTo,
} from './support/jobCardStubs';

/**
 * Everything around the job card that the first two specs do not reach: how the
 * list is narrowed and masked, how it leaves and enters the app as CSV, the
 * calendar link, the phone layout, the other places the drive-time and email
 * panels appear, and the customer's own view of a job in the portal.
 *
 * Several of these exist because the same fault — a date column read as UTC
 * midnight and printed in a US zone, one day early — showed up in more than one
 * place: the card, the dialogs, the invoice list, the CSV export and the
 * portal. Each is held here against a US-timezone browser.
 */

test.use({ timezoneId: 'America/Chicago' });

// ─────────────────────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────────────────────

test.describe('filtering the list', () => {
  const several = () => [
    job({ id: 'done', client_name: 'Done Dana', job_status: 'completed', location_city: 'Franklin' }),
    job({
      id: 'booked',
      client_name: 'Booked Ben',
      job_status: 'scheduled',
      date_completed: null,
      has_signature: false,
      location_city: 'Spring Hill',
    }),
    job({
      id: 'quote',
      client_name: 'Quoted Quinn',
      job_status: 'quoted',
      date_scheduled: null,
      date_completed: null,
      has_signature: false,
      location_city: 'Franklin',
    }),
    job({
      id: 'gone',
      client_name: 'Lost Lee',
      job_status: 'lost',
      date_completed: null,
      has_signature: false,
      location_city: 'Brentwood',
    }),
  ];

  test('the status filter keeps one stage of the pipeline', async ({ page }) => {
    await mountJobs(page, { jobs: several() });
    await page.getByRole('button', { name: 'Filters' }).click();

    await page.locator('select[name="statusFilter"]').selectOption('Scheduled');
    await expect(header(page, 'Booked Ben')).toBeVisible();
    await expect(header(page, 'Done Dana')).toHaveCount(0);
    await expect(header(page, 'Quoted Quinn')).toHaveCount(0);

    await page.locator('select[name="statusFilter"]').selectOption('Completed');
    await expect(header(page, 'Done Dana')).toBeVisible();
    await expect(header(page, 'Booked Ben')).toHaveCount(0);

    await page.locator('select[name="statusFilter"]').selectOption('All');
    await expect(header(page, 'Booked Ben')).toBeVisible();
    await expect(header(page, 'Done Dana')).toBeVisible();
  });

  test('the location filter lists every city in use and narrows to one', async ({ page }) => {
    await mountJobs(page, { jobs: several() });
    await page.getByRole('button', { name: 'Filters' }).click();

    const options = await page.locator('select[name="locationFilter"] option').allTextContents();
    expect(options).toEqual(['All Locations', 'Franklin', 'Spring Hill', 'Brentwood']);

    await page.locator('select[name="locationFilter"]').selectOption('Spring Hill');
    await expect(header(page, 'Booked Ben')).toBeVisible();
    await expect(header(page, 'Done Dana')).toHaveCount(0);
  });

  test('filters and search work together', async ({ page }) => {
    await mountJobs(page, { jobs: several() });
    await page.getByRole('button', { name: 'Filters' }).click();

    await page.locator('select[name="locationFilter"]').selectOption('Franklin');
    await expect(header(page, 'Done Dana')).toBeVisible();
    await expect(header(page, 'Quoted Quinn')).toBeVisible();

    await page.getByPlaceholder(/Search by customer name/).fill('quinn');
    await expect(header(page, 'Quoted Quinn')).toBeVisible();
    await expect(header(page, 'Done Dana')).toHaveCount(0);
  });

  test('lost and cancelled jobs only appear in the status list when asked for', async ({ page }) => {
    await mountJobs(page, { jobs: several() });
    await page.getByRole('button', { name: 'Filters' }).click();

    expect(await page.locator('select[name="statusFilter"] option').allTextContents()).not.toContain('Lost');
    await expect(header(page, 'Lost Lee')).toHaveCount(0);

    await page.getByLabel('Show lost and cancelled jobs').check();
    expect(await page.locator('select[name="statusFilter"] option').allTextContents()).toEqual(
      expect.arrayContaining(['Lost', 'Cancelled']),
    );
    await expect(header(page, 'Lost Lee')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Privacy mode
// ─────────────────────────────────────────────────────────────────────────────

test.describe('privacy mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('admin-privacy-mode-enabled', 'true'));
  });

  test('hides every dollar figure on the page, and only those', async ({ page }) => {
    await mountJobs(page, {
      invoices: [
        {
          id: 'inv-1',
          business_id: 'biz-1',
          job_id: 'job-1',
          invoice_number: 'INV-1001',
          invoice_type: 'invoice',
          status: 'sent',
          invoice_date: '2026-09-26',
          due_date: null,
          total_amount: 300,
          amount_due: 300,
          is_active: true,
          created_at: '2026-09-26T12:00:00Z',
        },
      ],
      jobContractors: [
        { id: 'jc-1', business_id: 'biz-1', job_id: 'job-1', contractor_id: 'c-1', amount_paid: 54.5, is_active: true },
      ],
    });

    // The summary tiles.
    await expect(page.locator('p', { hasText: /^Revenue$/ }).locator('xpath=../..')).toContainText('$••••');
    await expect(page.locator('p', { hasText: /^Avg Rate$/ }).locator('xpath=../..')).toContainText('$••••/hr');

    await expandCard(page);
    await expect(tile(page, 'Final Price')).toContainText('$••••');
    await expect(tile(page, 'Materials Cost')).toContainText('$••••');
    await expect(tile(page, 'Contractor Pay')).toContainText('$••••');
    await expect(tile(page, 'Net Profit')).toContainText('$••••');
    await expect(tile(page, 'Hourly Rate')).toContainText('$••••/hr');

    await page.getByRole('button', { name: /Invoices \(1\)/ }).click();
    await expect(page.getByText('$••••').first()).toBeVisible();

    // No real figure leaks anywhere on the page.
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\$300\.00|\$45\.50|\$254\.50|\$54\.50/);

    // Things that are not money stay readable.
    await expect(tile(page, 'Hours Worked')).toContainText('4.50 hrs');
    await expect(page.getByText('Total Jobs')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Export and import
// ─────────────────────────────────────────────────────────────────────────────

test.describe('exporting jobs', () => {
  test('downloads a CSV of every job with its real dates', async ({ page }) => {
    await mountJobs(page, {
      jobs: [
        job({ job_description: 'Two wardrobes, one desk', notes: 'Said "thanks"' }),
        job({ id: 'job-2', client_name: 'Mike Edwards', date_completed: null, date_scheduled: '2026-10-02', job_status: 'scheduled' }),
      ],
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export' }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^jobs-export-\d{4}-\d{2}-\d{2}-\d{6}\.csv$/);
    const csv = readFileSync((await download.path())!, 'utf8');
    const [headerRow, ...rows] = csv.split('\n');

    expect(headerRow.split(',').slice(0, 3)).toEqual(['Customer Name', 'Customer Phone', 'Customer Email']);
    expect(rows).toHaveLength(2);

    const kurt = rows.find((r) => r.startsWith('Kurt Zollner'))!;
    // An address with a comma in it is quoted, not split across two columns.
    expect(kurt).toContain('"2014 Beamon Drive Franklin, TN 37064"');
    expect(kurt).toContain('"Two wardrobes, one desk"');
    expect(kurt).toContain('"Said ""thanks"""');
    // Quoted on the 11th, finished on the 26th. Read as UTC midnight these
    // came out as the 10th and the 25th.
    expect(kurt).toContain('09/11/2026');
    expect(kurt).toContain('09/26/2026');
    expect(kurt).toContain('Completed');
    expect(kurt).toContain('300');

    expect(rows.find((r) => r.startsWith('Mike Edwards'))).toContain('10/02/2026');

    await expect(page.getByText('Exported 2 jobs successfully!')).toBeVisible();
  });
});

test.describe('importing jobs', () => {
  const stubs = {
    tables: {
      service_areas: [{ id: 'sa-1', city_name: 'Spring Hill', is_active: true }],
      payment_methods: [{ id: 'pm-1', business_id: 'biz-1', method_name: 'Cash', is_active: true }],
    },
    jobs: [],
  };

  async function openImport(page: import('@playwright/test').Page, extra = {}) {
    const mounted = await mountJobs(page, { ...stubs, ...extra });
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByRole('heading', { name: 'Import Jobs', level: 2 })).toBeVisible();
    return mounted;
  }

  const upload = (page: import('@playwright/test').Page, name: string, content: string) =>
    page.locator('input[type="file"]').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(content) });

  test('the template it hands out is one it accepts', async ({ page }) => {
    const mounted = await openImport(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV Template' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('job-import-template.csv');
    const template = readFileSync((await download.path())!, 'utf8');

    await upload(page, 'jobs.csv', template);

    await expect(page.getByText('Ready to Import')).toBeVisible();
    await expect(page.getByText('1 job validated successfully')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Import' }).click();

    await expect(page.getByText('Import Successful!')).toBeVisible();
    const [insert] = writesTo(mounted, 'jobs', 'POST');
    expect(Array.isArray(insert.body)).toBe(true);
    expect(rowOf(insert)).toMatchObject({
      business_id: 'biz-1',
      client_name: 'John Smith',
      job_type: 'Furniture Assembly',
      location_city: 'Spring Hill',
      payment_method: 'Cash',
      // 1/20/2025 in the template: the day it says, not the day before.
      date_completed: '2025-01-20',
      final_price: 150,
    });

    await expect(page.getByText('Successfully imported 1 jobs!')).toBeVisible({ timeout: 10_000 });
  });

  async function templateParts(page: import('@playwright/test').Page) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV Template' }).click(),
    ]);
    const [head, row] = readFileSync((await download.path())!, 'utf8').split('\n');
    return { head, row };
  }

  test('a row with no customer name is refused with the row and the reason', async ({ page }) => {
    const mounted = await openImport(page);
    const { head, row } = await templateParts(page);

    await upload(page, 'broken.csv', `${head}\n${row.replace('John Smith', '')}`);

    await expect(page.getByRole('heading', { name: 'Validation Errors Found' })).toBeVisible();
    await expect(page.getByText('Found 1 error in 1 row')).toBeVisible();
    const error = page.getByRole('row', { name: /Customer Name/ });
    await expect(error).toContainText('2');
    await expect(error).toContainText('This field is required');
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toHaveCount(0);
    expect(writesTo(mounted, 'jobs')).toHaveLength(0);
  });

  test('a date that is not a date is refused, and shown as typed', async ({ page }) => {
    const mounted = await openImport(page);
    const { head, row } = await templateParts(page);

    await upload(page, 'broken.csv', `${head}\n${row.replace('1/15/2025', 'sometime in May')}`);

    await expect(page.getByRole('heading', { name: 'Validation Errors Found' })).toBeVisible();
    const error = page.getByRole('row', { name: /Date Quoted/ });
    await expect(error).toContainText('Invalid date format. Use MM/DD/YYYY or YYYY-MM-DD');
    await expect(error).toContainText('sometime in May');
    expect(writesTo(mounted, 'jobs')).toHaveLength(0);
  });

  test('the error report can be downloaded to fix the file', async ({ page }) => {
    await openImport(page);
    const { head, row } = await templateParts(page);
    await upload(page, 'broken.csv', `${head}\n${row.replace('John Smith', '')}`);

    const [report] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download.*Error Report/i }).click(),
    ]);

    expect(report.suggestedFilename()).toBe('import-errors.csv');
    expect(readFileSync((await report.path())!, 'utf8')).toContain('This field is required');
  });

  test('only CSV files are taken', async ({ page }) => {
    await openImport(page);

    await upload(page, 'jobs.xlsx', 'not a csv');

    await expect(page.getByText('Please select a CSV file')).toBeVisible();
  });

  test('an empty file says so', async ({ page }) => {
    await openImport(page);

    await upload(page, 'empty.csv', '');

    await expect(page.getByText('CSV file is empty or has no data rows')).toBeVisible();
  });

  test('a refused insert is reported and nothing is lost', async ({ page }) => {
    const mounted = await openImport(page, {
      rejectWrite: (w: { table: string }) => (w.table === 'jobs' ? { status: 400, json: { message: 'import rejected' } } : undefined),
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV Template' }).click(),
    ]);
    await upload(page, 'jobs.csv', readFileSync((await download.path())!, 'utf8'));
    await page.getByRole('button', { name: 'Confirm Import' }).click();

    await expect(page.getByText('import rejected')).toBeVisible();
    expect(mounted.db.jobs).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Calendar link
// ─────────────────────────────────────────────────────────────────────────────

test.describe('the calendar subscription', () => {
  // The Calendar button only opens for an admin whose organization has loaded.
  async function mountAsAdmin(page: import('@playwright/test').Page) {
    const tables = await signInAsAdmin(page);
    return mountJobs(page, { tables });
  }

  test('the first time it is opened it makes a private link', async ({ page }) => {
    const mounted = await mountAsAdmin(page);

    await page.getByRole('button', { name: 'Calendar' }).click();

    await expect(page.getByRole('heading', { name: 'Subscribe to your job calendar' })).toBeVisible();
    const link = page.locator('input[readonly]');
    await expect(link).toHaveValue(/\/functions\/v1\/job-calendar-feed\?token=[0-9a-f]{48}$/);

    // The token is what guards the feed, so it is random, not guessable.
    const [created] = writesTo(mounted, 'calendar_feed_tokens', 'POST');
    expect(rowOf(created).token).toMatch(/^[0-9a-f]{48}$/);

    await expect(page.getByText(/Anyone with this link can read your job schedule/)).toBeVisible();
    await expect(page.getByText('Apple Calendar / iPhone:')).toBeVisible();
    await expect(page.getByText('Google Calendar:')).toBeVisible();
  });

  test('offers the same link as a one-click subscription', async ({ page }) => {
    await mountAsAdmin(page);
    await page.getByRole('button', { name: 'Calendar' }).click();

    const subscribe = page.locator('a[href^="webcal://"]');
    await expect(subscribe).toHaveAttribute('href', /^webcal:\/\/.*\/functions\/v1\/job-calendar-feed\?token=[0-9a-f]{48}$/);
  });

  test('copying the link says so', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mountAsAdmin(page);
    await page.getByRole('button', { name: 'Calendar' }).click();
    const url = await page.locator('input[readonly]').inputValue();

    await page.getByRole('button', { name: 'Copy', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  });

  test('rotating asks first, then retires the old link and makes a new one', async ({ page }) => {
    const mounted = await mountAsAdmin(page);
    await page.getByRole('button', { name: 'Calendar' }).click();
    const before = await page.locator('input[readonly]').inputValue();

    await page.getByRole('button', { name: 'Rotate link' }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    expect(writesTo(mounted, 'calendar_feed_tokens', 'PATCH')).toHaveLength(0);

    await page.getByRole('button', { name: 'Rotate link' }).click();
    await page.getByRole('button', { name: 'Yes, rotate it' }).click();

    await expect(page.locator('input[readonly]')).not.toHaveValue(before);
    const [revoke] = writesTo(mounted, 'calendar_feed_tokens', 'PATCH');
    expect(revoke.body).toEqual({ is_active: false });
  });

  test('closes', async ({ page }) => {
    await mountAsAdmin(page);
    await page.getByRole('button', { name: 'Calendar' }).click();

    await page.getByRole('button', { name: 'Close', exact: true }).first().click();

    await expect(page.getByRole('heading', { name: 'Subscribe to your job calendar' })).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A phone
// ─────────────────────────────────────────────────────────────────────────────

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  const noSideScroll = async (page: import('@playwright/test').Page) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the page should not scroll sideways').toBeLessThanOrEqual(1);
  };

  test('the list and an open card fit the screen', async ({ page }) => {
    await mountJobs(page, {
      jobs: [
        job({
          client_email: 'a.very.long.email.address.for.testing@example-company-name.com',
          client_address: '123456 Extraordinarily Long Street Name Boulevard, Spring Hill, TN 37174',
        }),
      ],
    });
    await noSideScroll(page);

    await expandCard(page);
    await expect(tile(page, 'Final Price')).toBeVisible();
    await expect(page.getByTitle('Edit job')).toBeVisible();
    await noSideScroll(page);
  });

  test('every action stays within reach', async ({ page }) => {
    await mountJobs(page, { jobs: [scheduledJob()] });
    await expandCard(page);

    for (const title of [
      'Complete job with customer signature',
      'Mark job as lost',
      'Cancel job',
      'Create invoice from job',
      'Attach existing invoice',
      'Copy job',
      'Edit job',
      'Delete job',
    ]) {
      const button = page.getByTitle(title);
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      expect(box, `${title} should be on screen`).not.toBeNull();
      expect(box!.x + box!.width, `${title} should not run off the right edge`).toBeLessThanOrEqual(391);
    }
    await noSideScroll(page);
  });

  test('the drive-time and reminder panels fit', async ({ page }) => {
    await mountJobs(page, { jobs: [scheduledJob()] });
    await expandCard(page);

    await expect(page.getByText('12.8 mi each way')).toBeVisible();
    await expect(page.getByText('Goes out Fri, Sep 25 at 5:00 PM')).toBeVisible();
    await noSideScroll(page);
  });

  test('the edit form opens and can be saved', async ({ page }) => {
    const mounted = await mountJobs(page);
    await expandCard(page);
    await page.getByTitle('Edit job').click();

    const save = page.getByRole('button', { name: 'Save Job' });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeVisible();
    await save.click();

    await expect(page.getByRole('heading', { name: 'Edit Job' })).toHaveCount(0);
    expect(writesTo(mounted, 'jobs', 'PATCH')).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bookings: the same drive-time card
// ─────────────────────────────────────────────────────────────────────────────

test.describe('a booking\'s drive time', () => {
  const booking = (overrides = {}) => ({
    id: 'booking-1',
    status: 'pending',
    booking_date: '2026-10-10',
    start_time: '10:00:00',
    end_time: '12:00:00',
    duration_minutes: 120,
    customer_name: 'Pat Jones',
    customer_email: 'pat@example.com',
    customer_phone: '(615) 555-0111',
    service_name: 'Furniture Assembly',
    pieces: 3,
    service_address: '45 Maple Ct, Franklin, TN 37064',
    notes: null,
    photo_paths: [],
    created_at: '2026-10-01T12:00:00Z',
    ...overrides,
  });

  test('is fetched only when asked for', async ({ page }) => {
    const mounted = await mountView(page, 'bookings', { tables: { bookings: [booking()] } });

    await expect(page.getByText('Pat Jones')).toBeVisible();
    await expect(page.getByText('Sat, Oct 10 · ')).toBeVisible();
    expect(mounted.calls.travel).toHaveLength(0);

    await page.getByRole('button', { name: 'Drive time from home base' }).click();

    await expect(page.getByText('12.8 mi each way')).toBeVisible();
    await expect(page.getByText('Drive From Home Base')).toBeVisible();
    // The booking's id goes up, never its address.
    expect(mounted.calls.travel).toHaveLength(1);
    expect(mounted.calls.travel[0].body).toEqual({ bookingId: 'booking-1' });

    await page.getByRole('button', { name: 'Hide drive time' }).click();
    await expect(page.getByText('Drive From Home Base')).toHaveCount(0);
  });

  test('a failed lookup says so and Try again recovers', async ({ page }) => {
    let attempts = 0;
    await mountView(page, 'bookings', {
      tables: { bookings: [booking()] },
      travel: () => {
        attempts += 1;
        return attempts === 1 ? { status: 500, json: { error: 'Mapbox is not answering' } } : { json: { status: 'ok', durationSeconds: 1800, distanceMeters: 16093, mapImage: null, departureBufferMinutes: 10, leaveBy: null } };
      },
    });

    await page.getByRole('button', { name: 'Drive time from home base' }).click();
    await expect(page.getByText('Mapbox is not answering')).toBeVisible();

    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('30 min', { exact: true })).toBeVisible();
  });

  test('a booking with no address has no drive time to offer', async ({ page }) => {
    await mountView(page, 'bookings', { tables: { bookings: [booking({ service_address: null })] } });

    await expect(page.getByText('Pat Jones')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Drive time from home base' })).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The client profile: reminder and follow-up panels for each of their jobs
// ─────────────────────────────────────────────────────────────────────────────

test.describe('a client\'s profile', () => {
  // The profile decides what is "upcoming" and what is "recent" by today's date.
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-05T17:00:00Z'));
  });

  const history = () => [
    job({
      id: 'job-future',
      job_status: 'scheduled',
      date_scheduled: '2026-10-10',
      date_completed: null,
      has_signature: false,
    }),
    job({ id: 'job-past', job_status: 'completed', date_scheduled: '2026-09-26' }),
    job({ id: 'job-quote', job_status: 'quoted', date_scheduled: '2026-10-12', date_completed: null }),
    job({ id: 'job-lost', job_status: 'lost', date_scheduled: '2026-10-13', date_completed: null }),
    job({ id: 'job-old', job_status: 'completed', date_scheduled: '2026-03-01' }),
  ];

  test('lists a reminder for each upcoming job and a follow-up for each recent one', async ({ page }) => {
    const mounted = await mountView(page, 'client', { jobs: history() });

    await expect(page.getByRole('heading', { name: 'Upcoming Appointment Reminders' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Post-Job Follow-Ups' })).toBeVisible();

    // Each panel is labelled with the job and the day it is for — the 26th, not the 25th.
    await expect(page.getByText('Furniture Assembly — Oct 10, 2026')).toHaveCount(2);
    await expect(page.getByText('Furniture Assembly — Sep 26, 2026')).toHaveCount(1);

    await expect(page.getByText('Customer Reminder Email')).toHaveCount(1);
    expect(mounted.calls.reminder.map((c) => c.body.jobId)).toEqual(['job-future']);

    // Newest first, and quotes, lost jobs and jobs older than the follow-up window are left out.
    await expect.poll(() => mounted.calls.followup.map((c) => c.body.jobId).sort()).toEqual(['job-future', 'job-past']);
  });

  test('says when each email goes out', async ({ page }) => {
    await mountView(page, 'client', { jobs: history() });

    await expect(page.getByText('Goes out Fri, Sep 25 at 5:00 PM')).toBeVisible();
    await expect(page.getByText('Goes out Sat, Sep 26 at 5:00 PM').first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The customer portal
// ─────────────────────────────────────────────────────────────────────────────

test.describe('the customer portal: my jobs', () => {
  const mine = () => [
    job({ id: 'job-1', job_type: 'Furniture Assembly', job_description: 'Two wardrobes', job_status: 'in_progress', date_scheduled: '2026-09-26', location_city: 'Franklin' }),
    job({ id: 'job-2', job_type: 'TV Mounting', job_description: null, job_status: 'scheduled', date_scheduled: null, location_city: null }),
  ];

  test('lists each job with its status, date and place', async ({ page }) => {
    await signInAsPortalCustomer(page);
    await mountView(page, 'portal-jobs', { jobs: mine() });

    await expect(page.getByRole('link', { name: 'Furniture Assembly' })).toBeVisible();
    const first = page.getByRole('row', { name: /Furniture Assembly/ });
    await expect(first).toContainText('Two wardrobes');
    await expect(first).toContainText('in progress');
    // A date column: the 26th, as the customer was told, not the 25th.
    await expect(first).toContainText('9/26/2026');
    await expect(first).toContainText('Franklin');

    const second = page.getByRole('row', { name: /TV Mounting/ });
    await expect(second).toContainText('No description');
    await expect(second).toContainText('N/A');
  });

  test('an account with no jobs says so', async ({ page }) => {
    await signInAsPortalCustomer(page);
    await mountView(page, 'portal-jobs', { jobs: [] });

    await expect(page.getByText('No jobs found yet.')).toBeVisible();
  });

  test('a failed load says so and Retry recovers', async ({ page }) => {
    await signInAsPortalCustomer(page);
    let failing = true;
    await mountView(page, 'portal-jobs', {
      jobs: mine(),
      rejectRead: (table) => (table === 'jobs' && failing ? { status: 500, json: { message: 'database is down' } } : undefined),
    });

    await expect(page.getByText(/database is down|Failed to fetch jobs/)).toBeVisible();
    failing = false;
    await page.getByRole('button', { name: 'Retry' }).click();

    await expect(page.getByRole('link', { name: 'Furniture Assembly' })).toBeVisible();
  });

  test('a job opens to its details', async ({ page }) => {
    await signInAsPortalCustomer(page);
    await mountView(page, 'portal-jobs', { jobs: mine() });

    await page.getByRole('link', { name: 'Furniture Assembly' }).click();

    await expect(page.getByRole('heading', { name: 'Furniture Assembly', level: 3 })).toBeVisible();
  });
});

test.describe('the customer portal: a job', () => {
  async function openJob(page: import('@playwright/test').Page, stubs = {}) {
    await signInAsPortalCustomer(page);
    return mountView(page, 'portal-job', {
      jobs: [
        job({
          job_type: 'Furniture Assembly',
          job_description: 'Two wardrobes',
          job_status: 'completed',
          date_scheduled: '2026-09-26',
          date_completed: '2026-09-26',
          quoted_price: 280,
          final_price: 300,
          location_city: 'Franklin',
        }),
      ],
      ...stubs,
    });
  }

  const field = (page: import('@playwright/test').Page, label: string) =>
    page.locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('xpath=..');

  test('shows what the customer needs to know about it', async ({ page }) => {
    await openJob(page);

    await expect(page.getByRole('heading', { name: 'Furniture Assembly', level: 3 })).toBeVisible();
    await expect(page.getByText('Two wardrobes')).toBeVisible();
    await expect(field(page, 'Status')).toContainText('completed');
    await expect(field(page, 'Scheduled date')).toContainText('9/26/2026');
    await expect(field(page, 'Completed date')).toContainText('9/26/2026');
    await expect(field(page, 'Location')).toContainText('Franklin');
    await expect(field(page, 'Quoted price')).toContainText('$280.00');
    await expect(field(page, 'Final price')).toContainText('$300.00');
  });

  test('says "N/A" for what is not known yet', async ({ page }) => {
    await signInAsPortalCustomer(page);
    await mountView(page, 'portal-job', {
      jobs: [job({ date_completed: null, final_price: null, location_city: null, job_description: null })],
    });

    await expect(field(page, 'Completed date')).toContainText('N/A');
    await expect(field(page, 'Final price')).toContainText('N/A');
    await expect(field(page, 'Location')).toContainText('N/A');
    await expect(page.getByText('No description provided.')).toBeVisible();
  });

  test('a customer can send a note, which is held for the team', async ({ page }) => {
    const mounted = await openJob(page);
    await page.route('**/rest/v1/rpc/submit_job_customer_action_request', async (route) => {
      mounted.db.job_customer_action_requests = [
        {
          id: 'req-1',
          job_id: 'job-1',
          action_type: 'add_note',
          request_message: 'Please bring the extra screws.',
          request_state: 'pending',
          created_at: '2026-10-05T12:00:00Z',
        },
      ];
      mounted.writes.push({ table: 'rpc', method: 'POST', url: route.request().url(), body: JSON.parse(route.request().postData() || '{}') });
      return route.fulfill({ json: mounted.db.job_customer_action_requests[0] });
    });

    await expect(page.getByText('No action requests yet.')).toBeVisible();
    await page.getByPlaceholder('Add context for your request').fill('Please bring the extra screws.');
    await page.getByRole('button', { name: 'Submit request' }).click();

    await expect(page.getByText('Please bring the extra screws.').last()).toBeVisible();
    await expect(page.getByText(/You currently have a pending request \(Job note\)/)).toBeVisible();
    await expect(page.getByText('No action requests yet.')).toHaveCount(0);

    // (the portal makes other RPC calls of its own on load)
    const send = writesTo(mounted, 'rpc', 'POST').find((w) => w.url.includes('submit_job_customer_action_request'))!;
    expect(send.body).toMatchObject({
      p_job_id: 'job-1',
      p_action_type: 'add_note',
      p_request_message: 'Please bring the extra screws.',
    });
  });

  test('a reschedule request asks for the new time', async ({ page }) => {
    await openJob(page);

    await page.getByLabel('Action type').selectOption('request_reschedule');

    await expect(page.getByLabel('Requested new date/time')).toBeVisible();
    await page.getByLabel('Action type').selectOption('cancel_request');
    await expect(page.getByLabel('Requested new date/time')).toHaveCount(0);
  });

  test('earlier requests are listed with where they stand', async ({ page }) => {
    await openJob(page, {
      tables: {
        job_customer_action_requests: [
          {
            id: 'req-1',
            job_id: 'job-1',
            action_type: 'request_reschedule',
            request_message: 'Can we move it a day?',
            request_state: 'approved',
            moderation_note: 'Moved to Saturday.',
            created_at: '2026-09-20T12:00:00Z',
          },
        ],
      },
    });

    await expect(page.getByText('Reschedule request approved')).toBeVisible();
    await expect(page.getByText('approved', { exact: true })).toBeVisible();
    await expect(page.getByText('Can we move it a day?')).toBeVisible();
    await expect(page.getByText('Team note: Moved to Saturday.')).toBeVisible();
  });

  test('a job that cannot be found says so', async ({ page }) => {
    await signInAsPortalCustomer(page);
    await mountView(page, 'portal-job', { jobs: [] });

    await expect(page.getByText('Requested record was not found.')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// What the browser sends, for the functions these surfaces call
// ─────────────────────────────────────────────────────────────────────────────

test.describe('what the browser sends is what each function allows', () => {
  test('saving a scheduled job: the calendar invite', async ({ page }) => {
    const mounted = await mountJobs(page);
    await expandCard(page);
    await page.getByTitle('Edit job').click();
    await page.getByRole('button', { name: 'Save Job' }).click();
    await expect.poll(() => mounted.calls.schedule.length).toBe(1);

    const name = FUNCTION_NAMES.schedule;
    const sent = sentHeaders(mounted.calls.schedule[0]);
    const refused = sent.filter((h) => !allowedHeadersFor(name).includes(h));
    expect(refused, `${name} would have its preflight refused for: ${refused.join(', ')}`).toEqual([]);
  });

  test('a booking\'s drive time', async ({ page }) => {
    const mounted = await mountView(page, 'bookings', {
      tables: {
        bookings: [
          {
            id: 'booking-1',
            status: 'pending',
            booking_date: '2026-10-10',
            start_time: '10:00:00',
            end_time: '12:00:00',
            duration_minutes: 120,
            customer_name: 'Pat Jones',
            customer_email: 'pat@example.com',
            service_address: '45 Maple Ct, Franklin, TN 37064',
            photo_paths: [],
            created_at: '2026-10-01T12:00:00Z',
          },
        ],
      },
    });
    await page.getByRole('button', { name: 'Drive time from home base' }).click();
    await expect(page.getByText('12.8 mi each way')).toBeVisible();

    const sent = sentHeaders(mounted.calls.travel[0]);
    expect(sent).toEqual(expect.arrayContaining(['authorization', 'apikey', 'x-client-info']));
    const refused = sent.filter((h) => !allowedHeadersFor(FUNCTION_NAMES.travel).includes(h));
    expect(refused).toEqual([]);
  });
});
