import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * The quote form is the only way a customer asks for work, and it fails
 * quietly. Nothing about a broken submit shows up in a build, a typecheck or a
 * lint run: the page still renders, the button still clicks, and the leads
 * simply stop arriving — with no record of the ones that were lost.
 *
 * These pin the whole path a submission takes. A filled-in form has to reach
 * the database carrying what the customer actually typed, the customer has to
 * leave holding the same confirmation code that was stored for them, an
 * unusable submission has to be stopped before it can be mistaken for a lead,
 * and a write that fails has to say so rather than show the success screen
 * over a lead that was never saved.
 */

type Json = Record<string, unknown>;

/** What the form sent, captured in the order it sent it. */
interface Backend {
  inquiries: Json[];
  savedRequests: Json[];
  emails: Json[];
}

/** A lead with every field filled the way a thorough customer would. */
const LEAD = {
  name: 'Dana Ruiz',
  // Deliberately mixed case: the lookup row has to store this normalized or
  // the customer can never find their request again.
  email: 'Dana.Ruiz@Example.com',
  phone: '(763) 555-0142',
  zip: '37064',
  furnitureType: 'Bed',
  pieces: '2',
  timeSlot: 'morning',
  notes: 'Second floor walk-up, no elevator.',
};

const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

/**
 * Stubs everything the form talks to on its way to a saved lead and records
 * what it sent. `failTable` makes that one insert fail the way PostgREST does
 * when a policy refuses the write — the shape of the outage that actually
 * happens in production.
 */
async function stubBackend(
  page: Page,
  opts: { failTable?: 'form_inquiries' | 'saved_requests' } = {},
): Promise<Backend> {
  const backend: Backend = { inquiries: [], savedRequests: [], emails: [] };

  // The row every submission reads first. Without it the form has no business
  // to file the lead against and gives up before writing anything.
  await page.route('**/rest/v1/business_info*', (route) =>
    route.fulfill({ json: [{ id: 'biz-1', organization_id: 'org-1' }] }),
  );

  // Reads that shape the page but decide nothing about the lead.
  await page.route('**/rest/v1/services*', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/test_identifiers*', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/lookup_coupon_by_code', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/log_public_audit_event', (route) => route.fulfill({ json: null }));

  const capture =
    (bucket: Json[], table: 'form_inquiries' | 'saved_requests') => async (route: Route) => {
      if (route.request().method() !== 'POST') return route.fulfill({ json: [] });

      if (opts.failTable === table) {
        return route.fulfill({
          status: 403,
          json: {
            message: 'new row violates row-level security policy',
            code: '42501',
            details: null,
            hint: null,
          },
        });
      }

      const body = JSON.parse(route.request().postData() || '{}');
      bucket.push(Array.isArray(body) ? body[0] : body);
      // An insert with no .select() expects 201 and an empty body back.
      return route.fulfill({ status: 201, body: '' });
    };

  await page.route('**/rest/v1/form_inquiries*', capture(backend.inquiries, 'form_inquiries'));
  await page.route('**/rest/v1/saved_requests*', capture(backend.savedRequests, 'saved_requests'));

  await page.route('**/functions/v1/send-form-email', async (route) => {
    backend.emails.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ json: { success: true, emailResults: { owner: true, client: true } } });
  });

  return backend;
}

async function openForm(page: Page, query = '') {
  await page.goto(`/tests/harness/contact-form.html${query}`);
  await expect(page.getByLabel('Your Name')).toBeVisible();
}

/** Fills the four required answers. */
async function fillRequired(page: Page, overrides: Partial<typeof LEAD> = {}) {
  const lead = { ...LEAD, ...overrides };
  await page.getByLabel('Your Name').fill(lead.name);
  await page.getByLabel('Email Address').fill(lead.email);
  await page.getByLabel('Service ZIP Code').fill(lead.zip);
  await page.getByLabel('What needs assembly?').selectOption(lead.furnitureType);
  await page.getByLabel('How many items?').fill(lead.pieces);
}

/** Fills everything, required and optional, the way a thorough customer would. */
async function fillEverything(page: Page) {
  await fillRequired(page);

  // Entered bare: the field masks it into shape, and the masked value is what
  // the lead has to carry.
  await page.locator('#phone').fill('7635550142');
  await expect(page.locator('#phone')).toHaveValue(LEAD.phone);

  // Two beds at $295, under the 4-item volume discount: $590 for 6 hours. That
  // number is the quote on screen, and it has to survive into the lead.
  await expect(page.getByText('Estimated cost:')).toContainText('$590');

  await page.getByRole('button', { name: /Scheduling Preferences/ }).click();
  await page.getByLabel('Preferred Date').fill(TOMORROW);
  await page.getByLabel('Preferred Time').selectOption(LEAD.timeSlot);
  await page.getByLabel('Additional Details').fill(LEAD.notes);
}

const submit = (page: Page) => page.getByRole('button', { name: 'Get My Free Quote' }).click();

const confirmation = (page: Page) => page.getByRole('heading', { name: 'Request Confirmed!' });

test('a completed form reaches the database and the customer leaves with a code', async ({ page }) => {
  const backend = await stubBackend(page);
  await openForm(page);
  await fillEverything(page);

  await submit(page);

  await expect(confirmation(page)).toBeVisible();

  expect(backend.inquiries).toHaveLength(1);
  expect(backend.savedRequests).toHaveLength(1);

  // The code on screen is the one that was stored. The customer quotes it back
  // at the request lookup, so a mismatch strands them with a code for nothing.
  const stored = backend.savedRequests[0].confirmation_code as string;
  expect(stored).toMatch(/^SR-[A-Z0-9]{10}$/);
  await expect(page.getByText(stored, { exact: true })).toBeVisible();

  // The lead and the lookup row are tied together, or the admin opening one
  // cannot get to the other.
  expect(backend.savedRequests[0].inquiry_id).toBe(backend.inquiries[0].id);
});

test('the saved lead carries every answer the customer gave', async ({ page }) => {
  const backend = await stubBackend(page);
  await openForm(page);
  await fillEverything(page);

  await submit(page);
  await expect(confirmation(page)).toBeVisible();

  expect(backend.inquiries[0]).toMatchObject({
    client_name: LEAD.name,
    client_email: LEAD.email,
    client_phone: LEAD.phone,
    user_city: LEAD.zip,
    furniture_type: LEAD.furnitureType,
    pieces: 2,
    preferred_date: TOMORROW,
    preferred_time_slot: LEAD.timeSlot,
    notes: LEAD.notes,
    estimated_price: '$590',
    estimated_time: '6 hours',
    // Nothing the customer sees, but what the admin working list sorts,
    // filters and counts on.
    business_id: 'biz-1',
    organization_id: 'org-1',
    source: 'contact_form',
    status: 'pending',
    viewed: false,
    is_active: true,
    is_test: false,
  });

  // The row the confirmation code resolves against. Lookup normalizes the
  // address before matching, so this copy has to be stored normalized.
  expect(backend.savedRequests[0]).toMatchObject({
    client_name: LEAD.name,
    client_email: LEAD.email.toLowerCase(),
    client_phone: LEAD.phone,
    furniture_type: LEAD.furnitureType,
    pieces: 2,
    estimated_price: '$590',
  });
});

test('a saved lead also tells the business about it', async ({ page }) => {
  const backend = await stubBackend(page);
  await openForm(page);
  await fillEverything(page);

  await submit(page);
  await expect(confirmation(page)).toBeVisible();

  // Sent without blocking the success screen, so it lands just after it.
  await expect.poll(() => backend.emails.length).toBe(1);
  expect(backend.emails[0]).toMatchObject({
    formType: 'contact',
    name: LEAD.name,
    email: LEAD.email,
    phone: LEAD.phone,
    furnitureType: LEAD.furnitureType,
    pieces: 2,
    estimatedPrice: '$590',
    confirmationCode: backend.savedRequests[0].confirmation_code,
  });
});

test('a form missing a required answer is stopped before it looks like a lead', async ({ page }) => {
  const backend = await stubBackend(page);
  await openForm(page);

  // Everything but the ZIP, which decides whether the job is even in range.
  await fillRequired(page, { zip: '' });

  await submit(page);

  // Flagged on the field and refused at the form, rather than a dead button.
  await expect(page.getByLabel('Service ZIP Code')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Please complete all required fields to submit your request.')).toBeVisible();
  await expect(confirmation(page)).toHaveCount(0);
  expect(backend.inquiries).toHaveLength(0);
  expect(backend.savedRequests).toHaveLength(0);
});

test('an address that cannot receive a reply is refused', async ({ page }) => {
  const backend = await stubBackend(page);
  await openForm(page);

  // A lead nobody can answer is worth no more than no lead at all.
  await fillRequired(page, { email: 'dana.ruiz@example' });

  await submit(page);

  await expect(page.getByLabel('Email Address')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Please complete all required fields to submit your request.')).toBeVisible();
  await expect(confirmation(page)).toHaveCount(0);
  expect(backend.inquiries).toHaveLength(0);
});

test('a write that fails says so instead of showing the success screen', async ({ page }) => {
  const backend = await stubBackend(page, { failTable: 'form_inquiries' });
  await openForm(page);
  await fillEverything(page);

  await submit(page);

  await expect(page.getByText('Submission Error')).toBeVisible();
  await expect(page.getByText(/could not send your request/i)).toBeVisible();

  // Never the success screen over a lead that was never saved.
  await expect(confirmation(page)).toHaveCount(0);
  expect(backend.savedRequests).toHaveLength(0);

  // Two ways out that do not depend on the thing that just broke.
  await expect(page.getByText('Try submitting again')).toBeVisible();
  await expect(page.getByText(/Email us at/)).toBeVisible();

  // Nothing was cleared: the customer can retry without typing it all again.
  await expect(page.getByLabel('Your Name')).toHaveValue(LEAD.name);
  await expect(page.getByLabel('Email Address')).toHaveValue(LEAD.email);

  // The policy failure stays in the console. Visitors get told what to do, not
  // which table refused the write.
  await expect(page.getByText(/row-level security/i)).toHaveCount(0);
});

/**
 * Campaign attribution. Several internal CTAs link here with UTM parameters
 * attached and the columns have always existed, but the form never read them,
 * so every campaign-driven lead was filed as untagged.
 */
test('a lead arriving from a campaign link carries its UTMs', async ({ page }) => {
  const backend = await stubBackend(page);
  // The shape a real CTA sends, extra parameters and all.
  await openForm(
    page,
    '?utm_id=B2B&utm_source=website&utm_medium=cta_button&utm_campaign=hours_given_back&utm_term=assembly',
  );
  await fillRequired(page);

  await submit(page);
  await expect(confirmation(page)).toBeVisible();

  expect(backend.inquiries[0]).toMatchObject({
    utm_source: 'website',
    utm_medium: 'cta_button',
    utm_campaign: 'hours_given_back',
  });
});

test('a lead with no campaign link records no attribution', async ({ page }) => {
  const backend = await stubBackend(page);
  await openForm(page);
  await fillRequired(page);

  await submit(page);
  await expect(confirmation(page)).toBeVisible();

  // Null, not an empty string: an untagged lead must not read as a campaign.
  expect(backend.inquiries[0]).toMatchObject({
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
  });
});

test('the campaign is held for the rest of the session', async ({ page }) => {
  await stubBackend(page);
  await openForm(page, '?utm_source=newsletter&utm_medium=email&utm_campaign=spring');

  // Stored on arrival, so wandering off the form and coming back later does
  // not lose the attribution. Polled because the capture runs in a mount
  // effect, which lands just after the form is on screen.
  await expect
    .poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('boxed2built.utm') || 'null')))
    .toEqual({ utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'spring' });
});

test('a lead submitted without the campaign link still carries the campaign', async ({ page }) => {
  const backend = await stubBackend(page);

  // As if the campaign link had been followed earlier in the same session and
  // the customer arrived at the form by some other route.
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'boxed2built.utm',
      JSON.stringify({ utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'spring' }),
    );
  });

  await openForm(page);
  await fillRequired(page);

  await submit(page);
  await expect(confirmation(page)).toBeVisible();

  expect(backend.inquiries[0]).toMatchObject({
    utm_source: 'newsletter',
    utm_medium: 'email',
    utm_campaign: 'spring',
  });
});

test('the referral code a scanned token supplies reaches the lead', async ({ page }) => {
  const backend = await stubBackend(page);
  await openForm(page, '?ref=B2B-ADRIA-4F7D');
  await fillRequired(page);

  await submit(page);
  await expect(confirmation(page)).toBeVisible();

  // The column the credit trigger reads to pay the referrer and record who
  // introduced this client.
  expect(backend.inquiries[0]).toMatchObject({ referral_code_used: 'B2B-ADRIA-4F7D' });
});
