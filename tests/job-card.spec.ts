import { test, expect, type Page, type Request } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

/**
 * The admin job card is what Nick opens to run a day: who the customer is, where
 * the work is, what it paid, how long the drive is, and whether the customer has
 * been reminded. Most of it is not on the card itself — the drive time, the
 * reminder email and the follow-up email are each fetched from an edge function
 * the moment a card opens — so when a function is unreachable the card does not
 * crash, it quietly shows "Failed to send a request to the Edge Function" in
 * place of the information.
 *
 * That is exactly how this broke. Every edge function's CORS allow-list had
 * `X-Customer-Info` where the Supabase client sends `x-client-info`, so the
 * browser refused every preflight and each panel went blank. Nothing else
 * noticed: the page rendered, typecheck passed, and the request never left the
 * browser.
 *
 * These specs mount the shipped Jobs page against stubbed network responses and
 * cover each thing the card shows and each button on it. The last group is the
 * one aimed at that failure: it captures the headers the browser really sends to
 * each function and checks every one against the Access-Control-Allow-Headers
 * the function source declares.
 */

// A US zone on purpose. `date_completed` is a plain date, and parsing '2026-09-26'
// as UTC midnight shows the previous day to anyone west of Greenwich, which is
// where the business is.
test.use({ timezoneId: 'America/Chicago' });

type Row = Record<string, unknown>;

/** A 1x1 PNG, standing in for the Mapbox route image the edge function returns. */
const MAP_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const FUNCTION_NAMES = {
  travel: 'job-travel-estimate',
  reminder: 'send-customer-job-reminders',
  followup: 'send-followup-email',
} as const;

function job(overrides: Row = {}): Row {
  return {
    id: 'job-1',
    business_id: 'biz-1',
    client_id: 'client-1',
    client_name: 'Kurt Zollner',
    client_phone: '(423) 368-3950',
    client_email: 'kjzollner21@yahoo.com',
    client_address: '2014 Beamon Drive Franklin, TN 37064',
    service_address: null,
    client_type: 'residential',
    job_type: 'Furniture Assembly',
    job_description: null,
    location_city: 'Franklin',
    job_status: 'completed',
    date_quoted: '2026-09-11',
    date_scheduled: '2026-09-26',
    date_completed: '2026-09-26',
    hours_worked: 4.5,
    quoted_price: 300,
    final_price: 300,
    materials_cost: 45.5,
    has_signature: true,
    is_free: false,
    is_active: true,
    repeat_client: false,
    created_at: '2026-09-11T12:00:00Z',
    updated_at: '2026-09-26T12:00:00Z',
    ...overrides,
  };
}

function travelOk(overrides: Row = {}): Row {
  return {
    status: 'ok',
    originAddress: '10 Home Base Ln, Spring Hill, TN',
    destinationAddress: '2014 Beamon Drive Franklin, TN 37064',
    durationSeconds: 24 * 60,
    distanceMeters: 12.8 * 1609.344,
    departureBufferMinutes: 10,
    leaveBy: {
      time: '10:56',
      daysEarlier: 0,
      driveMinutes: 24,
      bufferMinutes: 10,
      leadMinutes: 34,
      label: '10:56 AM (24 min drive + 10 min buffer)',
    },
    mapImage: MAP_PNG,
    cached: false,
    refreshedAt: '2026-09-25T12:00:00Z',
    ...overrides,
  };
}

function reminderPreview(overrides: Row = {}): Row {
  return {
    subject: 'Reminder: your appointment tomorrow',
    html: '<p>See you tomorrow at 11 AM.</p>',
    text: 'See you tomorrow at 11 AM.',
    recipient: 'kjzollner21@yahoo.com',
    status: 'scheduled',
    reason: null,
    // 5:00 PM on the business's clock (CDT, UTC-5).
    sendAt: '2026-09-25T22:00:00Z',
    sentAt: null,
    timeZone: 'America/Chicago',
    ...overrides,
  };
}

function followupPreview(overrides: Row = {}): Row {
  return {
    subject: 'Thanks, Kurt — how did we do?',
    html: '<p>Leave us a Google review.</p>',
    text: 'Leave us a Google review.',
    recipient: 'kjzollner21@yahoo.com',
    status: 'scheduled',
    reason: null,
    sendAt: '2026-09-26T22:00:00Z',
    sentAt: null,
    timeZone: 'America/Chicago',
    ...overrides,
  };
}

interface Call {
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

interface Stubs {
  jobs?: Row[];
  /** Per-call answers; a function returns what the edge function would. */
  travel?: (call: Call) => { status?: number; json: unknown };
  reminder?: (call: Call) => { status?: number; json: unknown };
  followup?: (call: Call) => { status?: number; json: unknown };
  jobContractors?: Row[];
}

interface Mounted {
  calls: Record<keyof typeof FUNCTION_NAMES, Call[]>;
  deletes: string[];
}

function readCall(request: Request): Call {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(request.postData() || '{}');
  } catch {
    // an unreadable body is recorded as empty
  }
  return { headers: request.headers(), body };
}

async function stubNetwork(page: Page, stubs: Stubs): Promise<Mounted> {
  const mounted: Mounted = {
    calls: { travel: [], reminder: [], followup: [] },
    deletes: [],
  };

  // Everything not named below is an empty table, so an unrelated query never
  // takes the page down.
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));

  await page.route('**/rest/v1/business_info*', (route) =>
    route.fulfill({
      json: [{ id: 'biz-1', name: 'Boxed2Built', street_address: '10 Home Base Ln', phone: '', email: '' }],
    }),
  );

  await page.route('**/rest/v1/jobs*', async (route) => {
    const request = route.request();
    if (request.method() === 'DELETE') {
      mounted.deletes.push(request.url());
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ json: stubs.jobs ?? [job()] });
  });

  await page.route('**/rest/v1/job_contractors*', (route) =>
    route.fulfill({ json: stubs.jobContractors ?? [] }),
  );

  for (const [key, name] of Object.entries(FUNCTION_NAMES) as [keyof typeof FUNCTION_NAMES, string][]) {
    await page.route(`**/functions/v1/${name}`, async (route) => {
      const call = readCall(route.request());
      mounted.calls[key].push(call);

      const answer = stubs[key]?.(call) ?? defaultAnswer(key, call);
      return route.fulfill({ status: answer.status ?? 200, json: answer.json as object });
    });
  }

  return mounted;
}

/** What each function says when a spec does not care. */
function defaultAnswer(key: keyof typeof FUNCTION_NAMES, call: Call): { json: unknown } {
  if (key === 'travel') return { json: travelOk() };

  const preview = key === 'reminder' ? reminderPreview() : followupPreview();
  if (call.body.preview) return { json: { preview } };

  // A send: the shape both send paths read their result from.
  return { json: { sent: 1, results: [{ sent: true, to: call.body.test ? 'nick@boxed2built.com' : 'kjzollner21@yahoo.com' }] } };
}

async function mountJobs(page: Page, stubs: Stubs = {}): Promise<Mounted> {
  const mounted = await stubNetwork(page, stubs);
  await page.goto('/tests/harness/job-card.html');
  await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
  return mounted;
}

async function mountFollowup(page: Page, stubs: Stubs = {}): Promise<Mounted> {
  const mounted = await stubNetwork(page, stubs);
  await page.goto('/tests/harness/job-card.html?view=followup');
  await expect(page.getByText('Post-Job Follow-Up', { exact: false }).first()).toBeVisible();
  return mounted;
}

function header(page: Page, name: string) {
  return page.getByRole('button', { name: new RegExp(name) });
}

/** Opens a card. Cards start collapsed and only mount their panels once open. */
async function expandCard(page: Page, name = 'Kurt Zollner') {
  const toggle = header(page, name);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

/** One of the small labelled tiles inside an open card, found by its label. */
function tile(page: Page, label: string) {
  // Starts-with rather than exact: the Work Location label carries a badge
  // ("Different address") inside the same paragraph.
  return page.locator('p', { hasText: new RegExp(`^${label}`) }).locator('xpath=..').first();
}

// ─────────────────────────────────────────────────────────────────────────────
// The card at a glance
// ─────────────────────────────────────────────────────────────────────────────

test.describe('the card at a glance', () => {
  test('a collapsed card shows who, what, where and where the job stands', async ({ page }) => {
    await mountJobs(page);

    await expect(page.getByRole('heading', { level: 3, name: 'Kurt Zollner' })).toBeVisible();
    const card = header(page, 'Kurt Zollner');
    await expect(card).toContainText('Completed');
    await expect(card).toContainText('Signed Off');
    await expect(card).toContainText('(423) 368-3950');
    await expect(card).toContainText('kjzollner21@yahoo.com');
    await expect(card).toContainText('Furniture Assembly');
    await expect(card).toContainText('2014 Beamon Drive Franklin, TN 37064');

    // Nothing is fetched for a card nobody opened — each panel is an edge
    // function call, and a page of collapsed rows must cost none.
    await expect(page.getByText('Drive From Home Base')).toHaveCount(0);
    await expect(page.getByText('Customer Reminder Email')).toHaveCount(0);
  });

  test('a card opens and closes', async ({ page }) => {
    await mountJobs(page);

    await expandCard(page);
    await expect(page.getByText('Final Price')).toBeVisible();

    await header(page, 'Kurt Zollner').click();
    await expect(header(page, 'Kurt Zollner')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Final Price')).toHaveCount(0);
  });

  test('the badges say what is special about a job', async ({ page }) => {
    await mountJobs(page, {
      jobs: [
        job({ id: 'j-free', client_name: 'Free Friend', is_free: true, has_signature: false }),
        job({ id: 'j-biz', client_name: 'Acme Corp', client_type: 'business', repeat_client: true, has_signature: false }),
        job({ id: 'j-hours', client_name: 'No Hours', hours_worked: null, has_signature: false }),
      ],
    });

    await expect(header(page, 'Free Friend')).toContainText('Free');
    await expect(header(page, 'Acme Corp')).toContainText('Business');
    await expect(header(page, 'Acme Corp')).toContainText('Repeat Customer');
    await expect(header(page, 'No Hours')).toContainText('Missing Hours');
    await expect(header(page, 'Free Friend')).not.toContainText('Signed Off');
  });

  test('the summary tiles at the top total the jobs', async ({ page }) => {
    await mountJobs(page, {
      jobs: [
        job({ id: 'a', client_name: 'Job A', final_price: 300, materials_cost: 50, hours_worked: 4 }),
        job({ id: 'b', client_name: 'Job B', final_price: 200, materials_cost: 20, hours_worked: 2 }),
      ],
    });

    const totalJobs = page.locator('p', { hasText: /^Total Jobs$/ }).locator('xpath=../..');
    await expect(totalJobs).toContainText('2');
    await expect(page.locator('p', { hasText: /^Revenue$/ }).locator('xpath=../..')).toContainText('$500.00');
    // 500 revenue - 70 materials
    await expect(page.locator('p', { hasText: /^Profit$/ }).locator('xpath=../..')).toContainText('$430.00');
    // 430 profit over 6 hours
    await expect(page.locator('p', { hasText: /^Avg Rate$/ }).locator('xpath=../..')).toContainText('$71.67/hr');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// An open card: the facts about the job
// ─────────────────────────────────────────────────────────────────────────────

test.describe('an open card', () => {
  test('lists the job type, location, completion date and hours', async ({ page }) => {
    await mountJobs(page);
    await expandCard(page);

    await expect(tile(page, 'Job Type')).toContainText('Furniture Assembly');
    await expect(tile(page, 'Location')).toContainText('Franklin');
    await expect(tile(page, 'Hours Worked')).toContainText('4.50 hrs');
  });

  test('shows the completion date as the day it was stored, not the day before', async ({ page }) => {
    // date_completed is a date column, so it arrives as '2026-09-26'. Read as
    // UTC midnight and printed in a US zone, that became Sep 25 — the day
    // before the job was done.
    await mountJobs(page);
    await expandCard(page);

    await expect(tile(page, 'Completed')).toContainText('Sep 26, 2026');
  });

  test('says when a job has no completion date yet', async ({ page }) => {
    await mountJobs(page, {
      jobs: [job({ date_completed: null, job_status: 'scheduled', has_signature: false })],
    });
    await expandCard(page);

    await expect(tile(page, 'Completed')).toContainText('Not set');
  });

  test('shows the client address and says the work was done there too', async ({ page }) => {
    await mountJobs(page);
    await expandCard(page);

    await expect(tile(page, 'Client Address')).toContainText('2014 Beamon Drive Franklin, TN 37064');
    await expect(tile(page, 'Work Location')).toContainText('2014 Beamon Drive Franklin, TN 37064');
    await expect(page.getByText('Same as customer address')).toBeVisible();
    await expect(page.getByText('Different address')).toHaveCount(0);
  });

  test('flags work done somewhere other than the customer\'s address', async ({ page }) => {
    await mountJobs(page, { jobs: [job({ service_address: '99 Rental Rd, Spring Hill, TN 37174' })] });
    await expandCard(page);

    await expect(tile(page, 'Client Address')).toContainText('2014 Beamon Drive Franklin, TN 37064');
    await expect(tile(page, 'Work Location')).toContainText('99 Rental Rd, Spring Hill, TN 37174');
    await expect(page.getByText('Different address')).toBeVisible();
    await expect(page.getByText('Same as customer address')).toHaveCount(0);
  });

  test('each address opens turn-by-turn directions', async ({ page }) => {
    await mountJobs(page);
    await expandCard(page);

    const link = tile(page, 'Work Location').getByRole('link', { name: '2014 Beamon Drive Franklin, TN 37064' });
    await expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=2014%20Beamon%20Drive%20Franklin%2C%20TN%2037064',
    );
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('shows the description when there is one', async ({ page }) => {
    await mountJobs(page, { jobs: [job({ job_description: 'Two IKEA wardrobes and a desk.' })] });
    await expandCard(page);

    await expect(page.getByText('Two IKEA wardrobes and a desk.')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The money
// ─────────────────────────────────────────────────────────────────────────────

test.describe('the money', () => {
  test('shows price, materials, net profit and the hourly rate', async ({ page }) => {
    await mountJobs(page);
    await expandCard(page);

    await expect(tile(page, 'Final Price')).toContainText('$300.00');
    await expect(tile(page, 'Materials Cost')).toContainText('$45.50');
    await expect(tile(page, 'Net Profit')).toContainText('$254.50');
    // 254.50 over 4.5 hours
    await expect(tile(page, 'Hourly Rate')).toContainText('$56.56/hr');
    await expect(page.getByText('Contractor Pay')).toHaveCount(0);
  });

  test('takes contractor pay out of the profit', async ({ page }) => {
    await mountJobs(page, { jobContractors: [{ job_id: 'job-1', amount_paid: 54.5 }] });
    await expandCard(page);

    await expect(tile(page, 'Contractor Pay')).toContainText('$54.50');
    // 300 - 45.50 - 54.50
    await expect(tile(page, 'Net Profit')).toContainText('$200.00');
    // 200 over 4.5 hours
    await expect(tile(page, 'Hourly Rate')).toContainText('$44.44/hr');
  });

  test('a free job tracks no money', async ({ page }) => {
    await mountJobs(page, { jobs: [job({ is_free: true })] });
    await expandCard(page);

    await expect(page.getByText('Free Job — no financial tracking')).toBeVisible();
    await expect(page.getByText('Final Price')).toHaveCount(0);
    await expect(page.getByText('Net Profit')).toHaveCount(0);
  });

  test('a completed job without hours is called out on the card', async ({ page }) => {
    await mountJobs(page, { jobs: [job({ hours_worked: null })] });
    await expandCard(page);

    await expect(page.getByText('This completed job is missing hours worked.')).toBeVisible();
    await expect(page.getByText(/1 completed job is missing hours worked/)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The buttons
// ─────────────────────────────────────────────────────────────────────────────

test.describe('the action buttons', () => {
  test('a finished, signed job offers invoice, attach, copy, edit and delete', async ({ page }) => {
    await mountJobs(page);
    await expandCard(page);

    for (const title of ['Create invoice from job', 'Attach existing invoice', 'Copy job', 'Edit job', 'Delete job']) {
      await expect(page.getByTitle(title)).toBeVisible();
    }
    // Already signed off, and already done: nothing left to complete, lose or cancel.
    await expect(page.getByTitle('Complete job with customer signature')).toHaveCount(0);
    await expect(page.getByTitle('Mark job as lost')).toHaveCount(0);
    await expect(page.getByTitle('Cancel job')).toHaveCount(0);
  });

  test('a scheduled job can be completed, marked lost or cancelled', async ({ page }) => {
    await mountJobs(page, {
      jobs: [job({ job_status: 'scheduled', date_completed: null, has_signature: false })],
    });
    await expandCard(page);

    await expect(page.getByTitle('Complete job with customer signature')).toBeVisible();
    await expect(page.getByTitle('Mark job as lost')).toBeVisible();
    await expect(page.getByTitle('Cancel job')).toBeVisible();
  });

  test('a quote can be marked lost but not cancelled', async ({ page }) => {
    await mountJobs(page, {
      jobs: [job({ job_status: 'quoted', date_scheduled: null, date_completed: null, has_signature: false })],
    });
    await expandCard(page);

    await expect(page.getByTitle('Mark job as lost')).toBeVisible();
    await expect(page.getByTitle('Cancel job')).toHaveCount(0);
    await expect(page.getByTitle('Complete job with customer signature')).toHaveCount(0);
  });

  test('a lost job is hidden until asked for, and offers only delete', async ({ page }) => {
    await mountJobs(page, {
      jobs: [job({ job_status: 'lost', date_completed: null, has_signature: false, lost_reason_category: 'Price' })],
    });

    await expect(page.getByText('No jobs match your filters')).toBeVisible();

    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByLabel('Show lost and cancelled jobs').check();
    await expect(header(page, 'Kurt Zollner')).toContainText('Lost');
    await expect(header(page, 'Kurt Zollner')).toContainText('Price');

    await expandCard(page);
    await expect(page.getByTitle('Delete job')).toBeVisible();
    await expect(page.getByTitle('Edit job')).toHaveCount(0);
    await expect(page.getByTitle('Copy job')).toHaveCount(0);
  });

  test('delete asks first, and does nothing when declined', async ({ page }) => {
    const mounted = await mountJobs(page);
    await expandCard(page);

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Delete this job?');
      void dialog.dismiss();
    });
    await page.getByTitle('Delete job').click();

    await expect(page.getByTitle('Delete job')).toBeVisible();
    expect(mounted.deletes).toHaveLength(0);
  });

  test('delete removes the job once confirmed', async ({ page }) => {
    const mounted = await mountJobs(page);
    await expandCard(page);

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTitle('Delete job').click();

    await expect(page.getByText('Job deleted successfully!')).toBeVisible();
    expect(mounted.deletes).toHaveLength(1);
    expect(mounted.deletes[0]).toContain('id=eq.job-1');
  });

  test('edit opens the job form', async ({ page }) => {
    await mountJobs(page);
    await expandCard(page);

    await page.getByTitle('Edit job').click();
    await expect(page.getByRole('heading', { name: /Edit Job/i })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Finding jobs
// ─────────────────────────────────────────────────────────────────────────────

test.describe('finding a job', () => {
  const several = () => [
    job({ id: 'a', client_name: 'Kurt Zollner', client_email: 'kurt@example.com' }),
    job({
      id: 'b',
      client_name: 'Mike Edwards',
      client_email: 'mike@example.com',
      client_phone: '(615) 828-8778',
      client_address: '453 Ridgestone Drive, Franklin, TN',
      job_type: 'TV Mounting',
      job_status: 'quoted',
      date_scheduled: null,
      date_completed: null,
      has_signature: false,
      location_city: 'Brentwood',
    }),
  ];

  test('search narrows by name, phone, email, address and job type', async ({ page }) => {
    await mountJobs(page, { jobs: several() });
    const search = page.getByPlaceholder(/Search by customer name/);

    for (const [term, shown, hidden] of [
      ['edwards', 'Mike Edwards', 'Kurt Zollner'],
      ['615', 'Mike Edwards', 'Kurt Zollner'],
      ['kurt@example', 'Kurt Zollner', 'Mike Edwards'],
      ['ridgestone', 'Mike Edwards', 'Kurt Zollner'],
      ['tv mounting', 'Mike Edwards', 'Kurt Zollner'],
    ] as const) {
      await search.fill(term);
      await expect(header(page, shown)).toBeVisible();
      await expect(header(page, hidden)).toHaveCount(0);
    }

    await search.fill('nobody by that name');
    await expect(page.getByText('No jobs match your filters')).toBeVisible();
  });

  test('the missing-hours warning filters to the jobs that need hours', async ({ page }) => {
    await mountJobs(page, {
      jobs: [job({ id: 'a', client_name: 'Has Hours' }), job({ id: 'b', client_name: 'No Hours', hours_worked: null })],
    });

    await expect(page.getByText(/1 completed job is missing hours worked/)).toBeVisible();
    await page.getByRole('button', { name: 'Show Missing Hours Only' }).click();
    await expect(header(page, 'No Hours')).toBeVisible();
    await expect(header(page, 'Has Hours')).toHaveCount(0);

    await page.getByRole('button', { name: 'Show All Jobs' }).click();
    await expect(header(page, 'Has Hours')).toBeVisible();
  });

  test('an empty list offers to add the first job', async ({ page }) => {
    await mountJobs(page, { jobs: [] });

    await expect(page.getByText('No jobs yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Your First Job' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drive From Home Base
// ─────────────────────────────────────────────────────────────────────────────

test.describe('drive from home base', () => {
  test('shows the route, the drive time, the distance and when to leave', async ({ page }) => {
    const mounted = await mountJobs(page);
    await expandCard(page);

    await expect(page.getByText('Drive From Home Base')).toBeVisible();
    await expect(page.getByRole('img', { name: /Route from 10 Home Base Ln/ })).toBeVisible();
    await expect(page.getByText('24 min', { exact: true })).toBeVisible();
    await expect(page.getByText('12.8 mi each way')).toBeVisible();
    await expect(page.getByText('Leave by 10:56 AM')).toBeVisible();
    await expect(page.getByText('24 min drive + 10 min buffer')).toBeVisible();

    // The id goes up, never the address: the function resolves it server-side.
    expect(mounted.calls.travel).toHaveLength(1);
    expect(mounted.calls.travel[0].body).toEqual({ jobId: 'job-1' });
  });

  test('the map opens turn-by-turn directions', async ({ page }) => {
    await mountJobs(page);
    await expandCard(page);

    const link = page.getByTitle('Open turn-by-turn directions');
    await expect(link).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=2014%20Beamon/);
  });

  test('does not offer a leave-by time when the job has no start hour', async ({ page }) => {
    await mountJobs(page, { travel: () => ({ json: travelOk({ leaveBy: null }) }) });
    await expandCard(page);

    await expect(page.getByText('12.8 mi each way')).toBeVisible();
    await expect(page.getByText(/Leave by/)).toHaveCount(0);
  });

  test('a leave-by before midnight says it is the day before', async ({ page }) => {
    await mountJobs(page, {
      travel: () => ({
        json: travelOk({
          leaveBy: { time: '22:45', daysEarlier: 1, driveMinutes: 90, bufferMinutes: 15, leadMinutes: 105, label: '' },
        }),
      }),
    });
    await expandCard(page);

    await expect(page.getByText('Leave by 10:45 PM the day before')).toBeVisible();
  });

  test('a failed lookup says so and Try again recovers', async ({ page }) => {
    let attempts = 0;
    await mountJobs(page, {
      travel: () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, json: { error: 'Mapbox is not answering' } }
          : { json: travelOk() };
      },
    });
    await expandCard(page);

    await expect(page.getByText('Mapbox is not answering')).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).first().click();

    await expect(page.getByText('12.8 mi each way')).toBeVisible();
    await expect(page.getByText('Mapbox is not answering')).toHaveCount(0);
  });

  test('an address Mapbox cannot place says to check the spelling', async ({ page }) => {
    await mountJobs(page, { travel: () => ({ json: travelOk({ status: 'not_found', mapImage: null }) }) });
    await expandCard(page);

    await expect(page.getByText(/Couldn't find this address on the map/)).toBeVisible();
  });

  test('no drivable route says so', async ({ page }) => {
    await mountJobs(page, { travel: () => ({ json: travelOk({ status: 'no_route', mapImage: null }) }) });
    await expandCard(page);

    await expect(page.getByText('No drivable route to this address.')).toBeVisible();
  });

  test('without a home base set, it points at Mileage Settings', async ({ page }) => {
    await mountJobs(page, { travel: () => ({ json: travelOk({ status: 'no_address', mapImage: null }) }) });
    await expandCard(page);

    await expect(page.getByText(/Set your starting address on the/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mileage Settings' })).toHaveAttribute('href', '/admin/mileage-settings');
  });

  test('a job with no address asks for no drive time at all', async ({ page }) => {
    const mounted = await mountJobs(page, {
      jobs: [job({ client_address: null, service_address: null })],
    });
    await expandCard(page);

    await expect(page.getByText('Final Price')).toBeVisible();
    await expect(page.getByText('Drive From Home Base')).toHaveCount(0);
    expect(mounted.calls.travel).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Customer Reminder Email
// ─────────────────────────────────────────────────────────────────────────────

test.describe('customer reminder email', () => {
  const scheduledJob = () => [job({ job_status: 'scheduled', date_completed: null, has_signature: false })];

  test('says when it goes out and who it goes to', async ({ page }) => {
    const mounted = await mountJobs(page, { jobs: scheduledJob() });
    await expandCard(page);

    await expect(page.getByText('Customer Reminder Email')).toBeVisible();
    await expect(page.getByText('Goes out Fri, Sep 25 at 5:00 PM')).toBeVisible();
    await expect(page.getByText('to kjzollner21@yahoo.com')).toBeVisible();

    expect(mounted.calls.reminder[0].body).toEqual({ jobId: 'job-1', preview: true });
  });

  test('previews the email the customer will get', async ({ page }) => {
    await mountJobs(page, { jobs: scheduledJob() });
    await expandCard(page);

    await page.getByRole('button', { name: 'Preview email' }).click();
    await expect(page.getByText('Reminder: your appointment tomorrow')).toBeVisible();
    await expect(
      page.frameLocator('iframe[title="Customer reminder email preview"]').getByText('See you tomorrow at 11 AM.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Hide preview' }).click();
    await expect(page.locator('iframe[title="Customer reminder email preview"]')).toHaveCount(0);
  });

  test('"Send test to me" mails the admin, never the customer', async ({ page }) => {
    const mounted = await mountJobs(page, { jobs: scheduledJob() });
    await expandCard(page);

    await page.getByRole('button', { name: 'Send test to me' }).click();

    await expect(page.getByText('Test copy sent to nick@boxed2built.com — the customer was not emailed.')).toBeVisible();
    const send = mounted.calls.reminder.at(-1)!;
    expect(send.body).toEqual({ jobId: 'job-1', test: true });
  });

  test('"Send it now" confirms with the customer\'s address first', async ({ page }) => {
    const mounted = await mountJobs(page, { jobs: scheduledJob() });
    await expandCard(page);

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('kjzollner21@yahoo.com');
      void dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Send it now' }).click();
    await expect(page.getByRole('button', { name: 'Send it now' })).toBeEnabled();
    // Declined: only the preview was ever requested.
    expect(mounted.calls.reminder).toHaveLength(1);

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Send it now' }).click();

    await expect(page.getByText('Sent to kjzollner21@yahoo.com.')).toBeVisible();
    expect(mounted.calls.reminder.some((c) => c.body.force === true && c.body.jobId === 'job-1')).toBe(true);
  });

  test('an already-sent reminder says when, and warns before sending again', async ({ page }) => {
    await mountJobs(page, {
      jobs: scheduledJob(),
      reminder: (call) =>
        call.body.preview
          ? { json: { preview: reminderPreview({ status: 'sent', sentAt: '2026-09-25T22:00:00Z' }) } }
          : { json: { sent: 1, results: [{ sent: true, to: 'kjzollner21@yahoo.com' }] } },
    });
    await expandCard(page);

    await expect(page.getByText('Sent Fri, Sep 25 at 5:00 PM')).toBeVisible();

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('has already been reminded');
      void dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Send again' }).click();
  });

  test('a blocked reminder says why and offers no send button', async ({ page }) => {
    await mountJobs(page, {
      jobs: scheduledJob(),
      reminder: () => ({
        json: { preview: reminderPreview({ status: 'blocked', reason: 'no_client_email', recipient: null }) },
      }),
    });
    await expandCard(page);

    await expect(page.getByText('There is no usable email address on this job.')).toBeVisible();
    await expect(page.getByText('Fix this on the job and the reminder picks it up automatically.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send it now|Send again/ })).toHaveCount(0);
    // A test copy still goes to the admin, so the email can be checked.
    await expect(page.getByRole('button', { name: 'Send test to me' })).toBeVisible();
  });

  test('a job with no date has no reminder to show', async ({ page }) => {
    await mountJobs(page, {
      jobs: [job({ date_scheduled: null, job_status: 'quoted', date_completed: null, has_signature: false })],
    });
    await expandCard(page);

    await expect(page.getByText('Final Price')).toBeVisible();
    await expect(page.getByText('Customer Reminder Email')).toHaveCount(0);
  });

  test('a failed load says so and Try again recovers', async ({ page }) => {
    let attempts = 0;
    await mountJobs(page, {
      jobs: scheduledJob(),
      reminder: (call) => {
        if (!call.body.preview) return { json: {} };
        attempts += 1;
        return attempts === 1
          ? { status: 500, json: { error: 'The reminder service is down' } }
          : { json: { preview: reminderPreview() } };
      },
    });
    await expandCard(page);

    await expect(page.getByText('The reminder service is down')).toBeVisible();
    const panel = page.locator('div', { hasText: 'Customer Reminder Email' }).last();
    await panel.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByText('Goes out Fri, Sep 25 at 5:00 PM')).toBeVisible();
  });

  test('a send the server refuses is reported, not swallowed', async ({ page }) => {
    await mountJobs(page, {
      jobs: scheduledJob(),
      reminder: (call) =>
        call.body.preview
          ? { json: { preview: reminderPreview() } }
          : { json: { sent: 0, results: [{ sent: false, reason: 'no_client_email' }] } },
    });
    await expandCard(page);

    await page.getByRole('button', { name: 'Send test to me' }).click();
    await expect(page.getByText('Not sent (no_client_email)')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Post-Job Follow-Up
// ─────────────────────────────────────────────────────────────────────────────

test.describe('post-job follow-up email', () => {
  test('says when it goes out and who it goes to', async ({ page }) => {
    const mounted = await mountFollowup(page);

    await expect(page.getByText('Goes out Sat, Sep 26 at 5:00 PM')).toBeVisible();
    await expect(page.getByText('to kjzollner21@yahoo.com')).toBeVisible();
    expect(mounted.calls.followup[0].body).toEqual({ jobId: 'job-1', preview: true });
  });

  test('previews the email with its subject', async ({ page }) => {
    await mountFollowup(page);

    await page.getByRole('button', { name: 'Preview email' }).click();
    await expect(page.getByText('Thanks, Kurt — how did we do?')).toBeVisible();
    await expect(page.frameLocator('iframe').getByText('Leave us a Google review.')).toBeVisible();
  });

  test('"Send test to me" mails the admin, not the client', async ({ page }) => {
    const mounted = await mountFollowup(page);

    await page.getByRole('button', { name: 'Send test to me' }).click();

    await expect(page.getByText(/Test copy sent to nick@boxed2built\.com/)).toBeVisible();
    expect(mounted.calls.followup.at(-1)!.body).toEqual({ jobId: 'job-1', test: true });
  });

  test('"Send it now" confirms first, then sends', async ({ page }) => {
    const mounted = await mountFollowup(page);

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('kjzollner21@yahoo.com');
      void dialog.accept();
    });
    await page.getByRole('button', { name: 'Send it now' }).click();

    await expect(page.getByText('Sent to kjzollner21@yahoo.com.')).toBeVisible();
    expect(mounted.calls.followup.some((c) => c.body.force === true)).toBe(true);
  });

  test('a failed load says so and Try again recovers', async ({ page }) => {
    let attempts = 0;
    await mountFollowup(page, {
      followup: (call) => {
        if (!call.body.preview) return { json: {} };
        attempts += 1;
        return attempts === 1
          ? { status: 500, json: { error: 'The follow-up service is down' } }
          : { json: { preview: followupPreview() } };
      },
    });

    await expect(page.getByText('The follow-up service is down')).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('Goes out Sat, Sep 26 at 5:00 PM')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The browser-to-function contract
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything above runs against a stub on the same origin, where the browser
 * never checks CORS — so none of it could have caught the outage. This is the
 * part that can.
 *
 * A cross-origin request carrying any header outside the browser's small safe
 * list is preceded by a preflight, and the browser sends the real request only
 * if the function's Access-Control-Allow-Headers names every one of them. The
 * cards call their functions with supabase-js, which adds x-client-info, apikey,
 * authorization and two correlation headers. So: capture what the card really
 * sends, and hold it against what the function's source says it will accept.
 */
const CORS_RELEVANT = /^(x-|authorization$|apikey$|content-type$|prefer$)/;

function allowedHeadersFor(functionName: string): string[] {
  const file = new URL(`../supabase/functions/${functionName}/index.ts`, import.meta.url);
  expect(existsSync(file), `supabase/functions/${functionName}/index.ts should exist`).toBe(true);

  const source = readFileSync(file, 'utf8');
  const match = source.match(/Access-Control-Allow-Headers['"]?\s*:\s*(['"`])([^'"`]*)\1/i);
  expect(match, `${functionName} should declare Access-Control-Allow-Headers`).not.toBeNull();

  return match![2].split(',').map((h) => h.trim().toLowerCase());
}

function sentHeaders(call: Call): string[] {
  return Object.keys(call.headers)
    .map((h) => h.toLowerCase())
    .filter((h) => CORS_RELEVANT.test(h));
}

test.describe('what the browser sends is what each function allows', () => {
  test('drive time and the reminder email', async ({ page }) => {
    const mounted = await mountJobs(page, {
      jobs: [job({ job_status: 'scheduled', date_completed: null, has_signature: false })],
    });
    await expandCard(page);
    await expect(page.getByText('12.8 mi each way')).toBeVisible();
    await expect(page.getByText('Goes out Fri, Sep 25 at 5:00 PM')).toBeVisible();

    for (const key of ['travel', 'reminder'] as const) {
      const name = FUNCTION_NAMES[key];
      const call = mounted.calls[key][0];
      const sent = sentHeaders(call);

      // The client really does send these. If it stopped, this test would pass
      // for the wrong reason.
      expect(sent, `${name}: the client should send its identifying headers`).toEqual(
        expect.arrayContaining(['authorization', 'apikey', 'x-client-info']),
      );

      const allowed = allowedHeadersFor(name);
      const refused = sent.filter((h) => !allowed.includes(h));
      expect(refused, `${name} would have its preflight refused for: ${refused.join(', ')}`).toEqual([]);
    }
  });

  test('the post-job follow-up email', async ({ page }) => {
    const mounted = await mountFollowup(page);
    await expect(page.getByText('Goes out Sat, Sep 26 at 5:00 PM')).toBeVisible();

    const name = FUNCTION_NAMES.followup;
    const sent = sentHeaders(mounted.calls.followup[0]);
    expect(sent).toEqual(expect.arrayContaining(['authorization', 'apikey', 'x-client-info']));

    const allowed = allowedHeadersFor(name);
    const refused = sent.filter((h) => !allowed.includes(h));
    expect(refused, `${name} would have its preflight refused for: ${refused.join(', ')}`).toEqual([]);
  });
});
