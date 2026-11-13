import { test, expect, type Page } from '@playwright/test';

/**
 * The inquiry view carries a private "What to charge" card: the Job Map's
 * formula applied to this one job, the gap against what the form showed the
 * customer, and Claude's read of it on request. These run the shipped page
 * against stubbed responses, so the arithmetic on screen is the real code's.
 */

type Row = Record<string, unknown>;

const today = new Date().toISOString().slice(0, 10);
const ADDRESS = '12 Oak St, Spring Hill, TN';

const INQUIRY: Row = {
  id: 'i-1',
  business_id: 'biz-1',
  organization_id: 'org-1',
  client_id: null,
  client_name: 'Dana Ruiz',
  client_email: 'customer@example.com',
  client_phone: '(763) 555-0100',
  furniture_type: 'Dresser',
  pieces: 1,
  preferred_date: null,
  preferred_time_slot: null,
  notes: 'Dressers & Storage ×1. It is a 9-drawer IKEA Hemnes, going upstairs.',
  user_city: null,
  estimated_price: '$320',
  estimated_time: '3.5 hours',
  submission_date: new Date().toISOString(),
  status: 'pending',
  source: 'contact_form',
  viewed: true,
  converted_job_id: null,
  last_contact_date: null,
  contact_method: null,
  contact_notes: null,
  response_count: 0,
  first_responded_at: null,
  coupon_code: null,
  coupon_discount_type: null,
  coupon_discount_value: null,
  coupon_discount_amount: null,
  furniture_photo_url: null,
  furniture_image_path: null,
  client_type: 'residential',
  is_test: false,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/** Three paid jobs this month: 2 hours at $200, so the target rate is $100/hr. */
const JOBS: Row[] = [1, 2, 3].map((n) => ({
  id: `job-${n}`,
  business_id: 'biz-1',
  is_active: true,
  is_test: false,
  is_free: false,
  job_status: 'completed',
  date_completed: today,
  payment_date: today,
  payment_method: 'card',
  client_address: `${n} Elm St, Spring Hill, TN`,
  service_address: null,
  location_city: 'Spring Hill',
  quoted_price: 200,
  final_price: 200,
  materials_cost: 0,
  hours_worked: 2,
}));

const estimate = (destination: string): Row => ({
  origin_address: '1 home base',
  destination_address: destination.toLowerCase(),
  destination_latitude: 35.75,
  destination_longitude: -86.93,
  duration_seconds: 900,
  distance_meters: 16093.44,
  status: 'ok',
  refreshed_at: new Date().toISOString(),
});

async function openInquiry(page: Page, saved: Row | null = null) {
  const calls: Row[] = [];

  await page.route('**/rest/v1/business_info*', (route) => route.fulfill({ json: [{ id: 'biz-1' }] }));
  await page.route('**/rest/v1/form_inquiries*', (route) => route.fulfill({ json: [INQUIRY] }));
  await page.route('**/rest/v1/invoices*', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/jobs*', (route) => route.fulfill({ json: JOBS }));
  await page.route('**/rest/v1/job_travel_estimates*', (route) =>
    route.fulfill({ json: JOBS.map((job) => estimate(String(job.client_address))) }),
  );
  await page.route('**/rest/v1/travel_settings*', (route) =>
    route.fulfill({ json: { origin_address: '1 Home Base', origin_latitude: 35.7, origin_longitude: -86.9 } }),
  );
  await page.route('**/rest/v1/mileage_settings*', (route) => route.fulfill({ json: { rate_per_mile: 0.5 } }));
  await page.route('**/rest/v1/inquiry_pricing*', (route) => route.fulfill({ json: saved }));

  await page.route('**/functions/v1/inquiry-price-advice', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    calls.push(body);
    if (body.action === 'locate') {
      return route.fulfill({
        json: { address: body.address, status: 'ok', durationSeconds: 900, distanceMeters: 16093.44 },
      });
    }
    return route.fulfill({
      json: {
        recommendedAt: new Date().toISOString(),
        recommendation: {
          price: 450,
          low: 400,
          high: 480,
          hours: 4,
          confidence: 'medium',
          reasoning: 'Charge $450. A 9-drawer Hemnes runs closer to 4 hours than the 3.5 the form assumed.',
          factors: ['Upstairs carry adds time'],
          questions_to_ask: ['Is the box already in the room?'],
          formula_price: body.formula.recommended,
          jobs_considered: 3,
        },
      },
    });
  });

  await page.goto('/tests/harness/inquiries.html');
  await page.getByRole('heading', { level: 3, name: 'Dana Ruiz' }).click();
  await expect(page.getByTestId('inquiry-price-card')).toBeVisible();
  return calls;
}

test('prices the job at the target rate and shows the gap against the form', async ({ page }) => {
  await openInquiry(page);
  const card = page.getByTestId('inquiry-price-card');

  // 3.5 hours at $100/hr, no address yet so no travel.
  await expect(page.getByTestId('inquiry-price-recommended')).toHaveText('$350');
  await expect(card).toContainText('Only you see this');
  await expect(card).toContainText('Travel: add the address below');
  await expect(card).toContainText('The form showed the customer $320');
  await expect(card).toContainText('$30 under this price');
});

test('adding the address adds the drive and brings in the area', async ({ page }) => {
  const calls = await openInquiry(page);
  const card = page.getByTestId('inquiry-price-card');

  await card.getByLabel('Where is the work?').fill(ADDRESS);
  await card.getByRole('button', { name: 'Save' }).click();

  // 15 min each way at $100/hr is $50, plus 20 miles at $0.50 is $10.
  await expect(page.getByTestId('inquiry-price-recommended')).toHaveText('$410');
  await expect(card).toContainText('Travel: 15 min each way, plus mileage');
  await expect(card).toContainText('Spring Hill:');
  expect(calls[0]).toMatchObject({ inquiryId: 'i-1', action: 'locate', address: ADDRESS });
});

test('Claude is only asked on a click, and its price takes the headline', async ({ page }) => {
  const calls = await openInquiry(page);
  const card = page.getByTestId('inquiry-price-card');

  expect(calls).toHaveLength(0);
  await card.getByRole('button', { name: 'Ask Claude to check this price' }).click();

  await expect(page.getByTestId('inquiry-price-recommended')).toHaveText('$450');
  await expect(card).toContainText('Range $400 to $480');
  await expect(card).toContainText('Is the box already in the room?');
  await expect(card).toContainText('$130 under this price');
  expect(calls[0]).toMatchObject({ action: 'recommend', formula: { targetRate: 100, hours: 3.5, recommended: 350 } });
});

test('a saved address and recommendation are there when the inquiry is reopened', async ({ page }) => {
  await openInquiry(page, {
    service_address: '1 Elm St, Spring Hill, TN',
    recommended_at: new Date().toISOString(),
    recommendation: {
      price: 430, low: 400, high: 460, hours: 3.5, confidence: 'high',
      reasoning: 'Charge $430.', factors: [], questions_to_ask: [], formula_price: 410, jobs_considered: 3,
    },
  });
  const card = page.getByTestId('inquiry-price-card');

  await expect(page.getByTestId('inquiry-price-recommended')).toHaveText('$430');
  await expect(card.getByLabel('Where is the work?')).toHaveValue('1 Elm St, Spring Hill, TN');
  // The drive comes from the Job Map's cache, with no new lookup.
  await expect(card).toContainText('Formula price$410');
});
