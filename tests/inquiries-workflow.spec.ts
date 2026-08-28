import { test, expect, type Page } from '@playwright/test';

/**
 * The Inquiries page is a working list. Everything submitted stayed on it
 * forever — a converted job the customer had already been called about sat
 * beside the submission still waiting on a first reply, and a good month of
 * bookings buried the one lead that needed answering.
 *
 * An inquiry now leaves the default view once both halves of "done" are true:
 * it became a job, and the customer heard back. These tests fix that rule
 * against the shipped page, including the two ways contact gets recorded —
 * the Reached Out button (first_responded_at) and an invoice send, which logs
 * a communication and never touches first_responded_at.
 */

const HOUR = 3_600_000;
const submitted = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR).toISOString();

type Row = Record<string, unknown>;

function inquiry(overrides: Row): Row {
  return {
    business_id: 'biz-1',
    client_id: null,
    client_email: 'customer@example.com',
    client_phone: '(763) 555-0100',
    furniture_type: 'Desk',
    pieces: 1,
    preferred_date: null,
    preferred_time_slot: null,
    notes: null,
    user_city: 'Spring Hill',
    estimated_price: '$185',
    estimated_time: '2 hours',
    submission_date: submitted(6),
    status: 'pending',
    source: 'contact_form',
    viewed: true,
    converted_job_id: null,
    last_contact_date: null,
    contact_method: null,
    contact_notes: null,
    response_count: 0,
    first_responded_at: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    referral_source: null,
    furniture_photo_url: null,
    furniture_image_path: null,
    client_type: 'residential',
    is_test: false,
    is_active: true,
    created_at: submitted(6),
    updated_at: submitted(6),
    ...overrides,
  };
}

/** One of each state the list has to tell apart. */
function seedRows(): Row[] {
  return [
    inquiry({ id: 'i-new', client_name: 'Dana Ruiz' }),
    inquiry({
      id: 'i-chased',
      client_name: 'Marcus Webb',
      first_responded_at: submitted(5),
      last_contact_date: submitted(5),
      response_count: 1,
    }),
    inquiry({
      id: 'i-booked',
      client_name: 'Tom Nguyen',
      status: 'converted_to_job',
      converted_job_id: 'job-1',
    }),
    inquiry({
      id: 'i-done',
      client_name: 'Hill Angel',
      status: 'converted_to_job',
      converted_job_id: 'job-2',
      first_responded_at: submitted(4),
      last_contact_date: submitted(4),
      response_count: 1,
    }),
    inquiry({
      id: 'i-invoiced',
      client_name: 'Priya Shah',
      status: 'converted_to_job',
      converted_job_id: 'job-3',
      // Sending an invoice logs a communication: contact without a first
      // response ever being stamped.
      last_contact_date: submitted(3),
      response_count: 1,
    }),
    inquiry({ id: 'i-spam', client_name: 'Casey Lind', status: 'archived' }),
  ];
}

/**
 * Serves the seeded rows and applies writes to them, so a card action is
 * followed by a refetch that actually reflects it.
 */
async function mountInquiries(page: Page): Promise<Row[]> {
  const rows = seedRows();

  await page.route('**/rest/v1/business_info*', (route) => route.fulfill({ json: [{ id: 'biz-1' }] }));

  await page.route('**/rest/v1/form_inquiries*', async (route) => {
    const request = route.request();
    const singleId = /[?&]id=eq\.([^&]+)/.exec(request.url())?.[1];

    if (request.method() === 'PATCH') {
      const row = rows.find((r) => r.id === singleId);
      Object.assign(row!, JSON.parse(request.postData() || '{}'));
      return route.fulfill({ json: row });
    }

    // markAsReachedOut reads the row back before updating it. maybeSingle()
    // on a GET still expects the array PostgREST would send.
    if (singleId) {
      return route.fulfill({ json: rows.filter((r) => r.id === singleId) });
    }

    return route.fulfill({ json: rows });
  });

  await page.goto('/tests/harness/inquiries.html');
  await expect(page.getByRole('heading', { name: 'Form Inquiries' })).toBeVisible();
  return rows;
}

function card(page: Page, name: string) {
  return page.getByRole('heading', { level: 3, name });
}

function hiddenNote(page: Page) {
  return page.getByText(/wrapped-up (inquiry is|inquiries are) hidden/);
}

test('converted inquiries the customer has heard from drop off the list', async ({ page }) => {
  await mountInquiries(page);

  // Still asking something of you.
  await expect(card(page, 'Dana Ruiz')).toBeVisible();
  await expect(card(page, 'Marcus Webb')).toBeVisible();
  await expect(card(page, 'Tom Nguyen')).toBeVisible();

  // Finished, or dismissed.
  await expect(card(page, 'Hill Angel')).toHaveCount(0);
  await expect(card(page, 'Priya Shah')).toHaveCount(0);
  await expect(card(page, 'Casey Lind')).toHaveCount(0);

  await expect(hiddenNote(page)).toContainText('2 wrapped-up inquiries are hidden');
});

test('a booked inquiry says why it is still there', async ({ page }) => {
  await mountInquiries(page);

  await expect(page.getByText('Booked — reach out to wrap this up')).toBeVisible();
});

test('the hidden ones are one click away and nothing is deleted', async ({ page }) => {
  await mountInquiries(page);

  await page.getByRole('button', { name: 'Show them' }).click();

  await expect(card(page, 'Hill Angel')).toBeVisible();
  await expect(card(page, 'Priya Shah')).toBeVisible();
  await expect(card(page, 'Dana Ruiz')).toHaveCount(0);
});

test('marking a booked inquiry as reached out clears it from the list', async ({ page }) => {
  const rows = await mountInquiries(page);

  await page.getByRole('button', { name: 'Mark Tom Nguyen as reached out' }).click();

  await expect(page.getByText("Tom Nguyen's inquiry is wrapped up and cleared from your list.")).toBeVisible();
  await expect(card(page, 'Tom Nguyen')).toHaveCount(0);
  await expect(hiddenNote(page)).toContainText('3 wrapped-up inquiries are hidden');

  // Cleared, not archived: it still counts as a conversion.
  expect(rows.find((r) => r.id === 'i-booked')?.status).toBe('converted_to_job');
  expect(rows.find((r) => r.id === 'i-booked')?.first_responded_at).toBeTruthy();
});

test('reaching out to a lead that has not booked keeps it on the list', async ({ page }) => {
  await mountInquiries(page);

  await page.getByRole('button', { name: 'Mark Dana Ruiz as reached out' }).click();

  await expect(page.getByText('Marked as reached out — response time recorded for Dana Ruiz.')).toBeVisible();
  await expect(card(page, 'Dana Ruiz')).toBeVisible();
});

test('an inbox with nothing left to do reads as caught up', async ({ page }) => {
  await mountInquiries(page);

  for (const name of ['Dana Ruiz', 'Marcus Webb', 'Tom Nguyen']) {
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: `Archive ${name}` }).click();
    await expect(card(page, name)).toHaveCount(0);
  }

  await expect(page.getByText("You're all caught up")).toBeVisible();
  await expect(hiddenNote(page)).toContainText('2 wrapped-up inquiries are hidden');
});
