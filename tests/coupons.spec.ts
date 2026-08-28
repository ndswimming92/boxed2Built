import { test, expect, type Page } from '@playwright/test';

/**
 * A coupon code is money. These cover the two places it has to be right: the
 * quote the customer is shown when they enter one, and the admin page that
 * decides which codes exist.
 *
 * The public form's arithmetic is the part worth pinning. A percentage and a
 * flat amount take different paths, a code that is not ours must leave the
 * price alone, and the discount has to survive into the value that gets
 * submitted — that number is what the confirmation, both emails and the
 * admin's inquiry card all show.
 */

type Row = Record<string, unknown>;

const FIXED_25 = {
  code: 'WELCOME25',
  description: 'New customer welcome offer',
  discount_type: 'fixed',
  discount_value: 25,
  ends_at: null,
};

const PERCENT_10 = {
  code: 'FALL10',
  description: null,
  discount_type: 'percentage',
  discount_value: 10,
  ends_at: null,
};

/** Serves the business row every admin screen opens with. */
async function stubBusiness(page: Page) {
  await page.route('**/rest/v1/business_info*', (route) =>
    route.fulfill({ json: [{ id: 'biz-1', organization_id: 'org-1' }] }),
  );
}

/** One coupon table, answering the public RPC and the admin list from it. */
async function stubCoupons(page: Page, coupons: Row[]) {
  await page.route('**/rest/v1/rpc/lookup_coupon_by_code', async (route) => {
    const { p_code } = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({ json: coupons.filter((c) => c.code === p_code) });
  });

  await page.route('**/rest/v1/coupons*', (route) => route.fulfill({ json: coupons }));
}

async function openForm(page: Page) {
  await stubBusiness(page);
  // The form pulls business details and writes analytics; neither decides a price.
  await page.route('**/rest/v1/services*', (route) => route.fulfill({ json: [] }));
  await page.goto('/tests/harness/coupons.html');
  await expect(page.getByLabel('What needs assembly?')).toBeVisible();
}

/** IKEA at $185 a piece is the cheapest way to get a known number on screen. */
async function quoteOnePiece(page: Page) {
  await page.getByLabel('What needs assembly?').selectOption('IKEA');
  await page.getByLabel('How many items?').fill('1');
  await expect(page.getByText('Estimated cost:')).toContainText('$185');
}

async function enterCode(page: Page, code: string) {
  const field = page.getByLabel(/Referral or Coupon Code/i);
  await field.fill(code);
  await field.blur();
}

test('a flat coupon comes off the quote the customer is shown', async ({ page }) => {
  await stubCoupons(page, [FIXED_25]);
  await openForm(page);
  await quoteOnePiece(page);

  await enterCode(page, 'WELCOME25');

  await expect(page.getByText('WELCOME25 applied — $25 off')).toBeVisible();
  await expect(page.getByText('WELCOME25 · $25 saved')).toBeVisible();
  // The box used to insist on the B2B-NAME-XXXX referral shape, which made
  // every coupon code look like a typo.
  await expect(page.getByText(/Codes are 3–30 letters/)).toHaveCount(0);
  await expect(page.getByText(/Referral codes look like/)).toHaveCount(0);
  // The original stays visible, struck through, so the saving is legible.
  await expect(page.getByText('Estimated cost:')).toContainText('$185');
  await expect(page.getByText('Estimated cost:')).toContainText('$160');
});

test('a percentage coupon is worked out against the estimate', async ({ page }) => {
  await stubCoupons(page, [PERCENT_10]);
  await openForm(page);
  await quoteOnePiece(page);

  await enterCode(page, 'FALL10');

  // The field reports the coupon; the estimate reports the money it took off.
  await expect(page.getByText('FALL10 applied — 10% off')).toBeVisible();
  await expect(page.getByText('FALL10 · $18.50 saved')).toBeVisible();
  await expect(page.getByText('Estimated cost:')).toContainText('$166.50');
});

test('a code that is not a coupon leaves the price alone', async ({ page }) => {
  await stubCoupons(page, [FIXED_25]);
  await openForm(page);
  await quoteOnePiece(page);

  // A friend's referral code: still recorded, but it is not a discount.
  await enterCode(page, 'B2B-JONES-4X2');

  await expect(page.getByText(/we'll treat it as a referral code/i)).toBeVisible();
  await expect(page.getByText('Estimated cost:')).toContainText('$185');
  await expect(page.getByText(/applied —/)).toHaveCount(0);
});

test('editing the code after it applied drops the discount', async ({ page }) => {
  await stubCoupons(page, [FIXED_25]);
  await openForm(page);
  await quoteOnePiece(page);

  await enterCode(page, 'WELCOME25');
  await expect(page.getByText('WELCOME25 · $25 saved')).toBeVisible();

  await page.getByLabel(/Referral or Coupon Code/i).fill('WELCOME2');

  await expect(page.getByText(/applied —/)).toHaveCount(0);
  await expect(page.getByText('Estimated cost:')).toContainText('$185');
});

test('a shared link arrives with the coupon already applied', async ({ page }) => {
  await stubCoupons(page, [FIXED_25]);
  await stubBusiness(page);
  await page.goto('/tests/harness/coupons.html?coupon=welcome25');

  await expect(page.getByLabel(/Referral or Coupon Code/i)).toHaveValue('WELCOME25');
  await expect(page.getByText('WELCOME25 applied — $25 off')).toBeVisible();
});

test('the admin list separates live codes from scheduled, expired and off', async ({ page }) => {
  const day = 86_400_000;
  await stubCoupons(page, [
    { id: 'c1', code: 'LIVE20', discount_type: 'fixed', discount_value: 20, description: null,
      starts_at: null, ends_at: null, is_active: true, times_used: 3, last_used_at: null,
      business_id: 'biz-1', organization_id: 'org-1', created_by: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'c2', code: 'SOON10', discount_type: 'percentage', discount_value: 10, description: null,
      starts_at: new Date(Date.now() + 7 * day).toISOString(), ends_at: null, is_active: true,
      times_used: 0, last_used_at: null, business_id: 'biz-1', organization_id: 'org-1',
      created_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'c3', code: 'SUMMER15', discount_type: 'fixed', discount_value: 15, description: null,
      starts_at: new Date(Date.now() - 30 * day).toISOString(),
      ends_at: new Date(Date.now() - day).toISOString(), is_active: true, times_used: 9,
      last_used_at: null, business_id: 'biz-1', organization_id: 'org-1', created_by: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'c4', code: 'PAUSED5', discount_type: 'fixed', discount_value: 5, description: null,
      starts_at: null, ends_at: null, is_active: false, times_used: 0, last_used_at: null,
      business_id: 'biz-1', organization_id: 'org-1', created_by: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ]);
  await stubBusiness(page);

  await page.goto('/tests/harness/coupons.html?view=admin');
  await expect(page.getByRole('heading', { name: 'Coupon Codes' })).toBeVisible();

  const card = (code: string) =>
    page.locator('div').filter({ has: page.getByRole('heading', { level: 3, name: code }) }).last();

  await expect(card('LIVE20')).toContainText('Active');
  await expect(card('SOON10')).toContainText('Scheduled');
  await expect(card('SUMMER15')).toContainText('Expired');
  await expect(card('PAUSED5')).toContainText('Off');

  // Only one of the four is actually taking bookings right now.
  await expect(page.getByText('1 live now · 12 total uses')).toBeVisible();
});

test('a bad discount is refused before it reaches the database', async ({ page }) => {
  await stubCoupons(page, []);
  await stubBusiness(page);
  await page.goto('/tests/harness/coupons.html?view=admin');

  await page.getByRole('button', { name: 'New Coupon' }).click();
  await page.locator('#coupon-code').fill('AB');
  await page.locator('#coupon-type').selectOption('percentage');
  await page.locator('#coupon-value').fill('150');
  await page.getByRole('button', { name: 'Create coupon' }).click();

  await expect(page.getByText(/Codes are 3–30 characters/)).toBeVisible();

  await page.locator('#coupon-code').fill('HALFOFF');
  await page.getByRole('button', { name: 'Create coupon' }).click();
  await expect(page.getByText('A percentage cannot be over 100%.')).toBeVisible();
});
