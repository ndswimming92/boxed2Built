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

/**
 * One coupon table, answering the public RPC and the admin list from it, plus
 * the inquiries those codes were entered on — the admin card reads the names
 * beside its usage count from there, so an empty table is the honest default.
 */
async function stubCoupons(page: Page, coupons: Row[], inquiries: Row[] = []) {
  await page.route('**/rest/v1/rpc/lookup_coupon_by_code', async (route) => {
    const { p_code } = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({ json: coupons.filter((c) => c.code === p_code) });
  });

  await page.route('**/rest/v1/coupons*', (route) => route.fulfill({ json: coupons }));
  await page.route('**/rest/v1/form_inquiries*', (route) => route.fulfill({ json: inquiries }));
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

/**
 * The promotion queue. What the admin page is for once codes are scheduled is
 * answering one question — which do I post next — so that is what these pin:
 * the order, the card that gets singled out, and the two ways a promotion can
 * fail to be queued at all.
 */
const day = 86_400_000;

function promoCoupon(over: Row): Row {
  return {
    id: 'x', code: 'CODE', description: null, discount_type: 'fixed', discount_value: 10,
    starts_at: null, ends_at: null, is_active: true, times_used: 0, last_used_at: null,
    business_id: 'biz-1', organization_id: 'org-1', created_by: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    promote: false, promo_post_at: null, promo_message: null,
    promo_reminder_sent_at: null, promo_reminder_for: null,
    facebook_post_id: null, facebook_posted_at: null, facebook_post_error: null,
    ...over,
  };
}

async function openAdmin(page: Page, coupons: Row[], inquiries: Row[] = []) {
  await stubCoupons(page, coupons, inquiries);
  await stubBusiness(page);
  await page.goto('/tests/harness/coupons.html?view=admin');
  await expect(page.getByRole('heading', { name: 'Coupon Codes' })).toBeVisible();
}

test('the queue runs soonest-to-post first, whatever order they were made in', async ({ page }) => {
  await openAdmin(page, [
    // Created most recently, due last: creation order must not decide this.
    promoCoupon({
      id: 'c-late', code: 'LATE30', promote: true,
      promo_post_at: new Date(Date.now() + 21 * day).toISOString(),
      created_at: new Date().toISOString(),
    }),
    promoCoupon({
      id: 'c-soon', code: 'SOONEST', promote: true,
      promo_post_at: new Date(Date.now() + 2 * day).toISOString(),
      created_at: new Date(Date.now() - 30 * day).toISOString(),
    }),
    promoCoupon({
      id: 'c-mid', code: 'MIDDLE', promote: true,
      promo_post_at: new Date(Date.now() + 9 * day).toISOString(),
      created_at: new Date(Date.now() - 10 * day).toISOString(),
    }),
    // Not promoted at all, so it sits below the whole queue however new it is.
    promoCoupon({ id: 'c-quiet', code: 'QUIET5', created_at: new Date().toISOString() }),
  ]);

  const codes = page.getByRole('heading', { level: 3 });
  await expect(codes).toHaveText(['SOONEST', 'MIDDLE', 'LATE30', 'QUIET5']);
});

test('the next code up is called out on its own, with the post ready to go', async ({ page }) => {
  await openAdmin(page, [
    promoCoupon({
      id: 'c-next', code: 'NEXTUP', description: 'Labor Day weekend', promote: true,
      discount_type: 'percentage', discount_value: 15,
      promo_post_at: new Date(Date.now() + day).toISOString(),
      ends_at: new Date(Date.now() + 15 * day).toISOString(),
      promo_message: 'Take 15% off your assembly this Labor Day weekend.',
    }),
    promoCoupon({
      id: 'c-after', code: 'AFTER', promote: true,
      promo_post_at: new Date(Date.now() + 12 * day).toISOString(),
    }),
  ]);

  const banner = page.locator('div').filter({ hasText: /^Next up to post/ }).first();
  await expect(banner).toContainText('NEXTUP');
  await expect(banner).toContainText('15% off');
  await expect(banner).toContainText('Due tomorrow');
  // The whole point of the banner: the message is right there to read.
  await expect(banner).toContainText('Take 15% off your assembly this Labor Day weekend.');
  await expect(page.getByText('2 promotions queued')).toBeVisible();

  await expect(banner.getByRole('button', { name: 'Post to Facebook' })).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Rewrite' })).toBeVisible();
});

test('a promotion already posted drops out of the queue, and one with no date says so', async ({ page }) => {
  await openAdmin(page, [
    promoCoupon({
      id: 'c-done', code: 'ALREADY', promote: true,
      promo_post_at: new Date(Date.now() - 3 * day).toISOString(),
      facebook_posted_at: new Date(Date.now() - 3 * day).toISOString(),
      facebook_post_id: '1234',
    }),
    promoCoupon({ id: 'c-undated', code: 'NODATE', promote: true }),
  ]);

  // Nothing is queued, so nothing is singled out.
  await expect(page.getByText('Next up to post')).toBeHidden();

  const card = (code: string) =>
    page.locator('div.bg-white.rounded-xl').filter({ has: page.getByRole('heading', { level: 3, name: code }) });

  await expect(card('ALREADY')).toContainText('Posted to Facebook');
  await expect(card('NODATE')).toContainText('no post date');
});

test('promoting a code without a post date is refused, and ticking it fills one in', async ({ page }) => {
  await openAdmin(page, []);

  await page.getByRole('button', { name: 'New Coupon' }).click();
  await page.locator('#coupon-code').fill('LABORDAY');
  await page.locator('#coupon-value').fill('20');

  // Ticking Promote proposes a date rather than leaving an empty box.
  await page.getByRole('checkbox', { name: /Promote this code/ }).check();
  await expect(page.locator('#coupon-post-at')).not.toHaveValue('');

  await page.locator('#coupon-post-at').fill('');
  await page.getByRole('button', { name: 'Create coupon' }).click();
  await expect(page.getByText(/Pick a date to post this promotion/)).toBeVisible();
});

/**
 * Where the form opens. On a long list, an edit form pinned to the top of the
 * page means scrolling away from the card you clicked and then scrolling back
 * to find your place again, so the form takes the card's own slot instead.
 * Heading order is the assertion because it is what "in place" actually means.
 */
test('editing opens the form in the card\'s own place, not at the top', async ({ page }) => {
  await openAdmin(page, [
    promoCoupon({ id: 'a', code: 'ALPHA', created_at: new Date(Date.now() - 1 * day).toISOString() }),
    promoCoupon({ id: 'b', code: 'BRAVO', created_at: new Date(Date.now() - 2 * day).toISOString() }),
    promoCoupon({ id: 'c', code: 'CHARLIE', created_at: new Date(Date.now() - 3 * day).toISOString() }),
  ]);

  await expect(page.getByRole('heading')).toHaveText(['Coupon Codes', 'ALPHA', 'BRAVO', 'CHARLIE']);

  await page.getByRole('button', { name: 'Edit BRAVO' }).click();

  // The form sits between ALPHA and CHARLIE — where BRAVO's card was — and
  // BRAVO's card is gone rather than duplicated above the list.
  await expect(page.getByRole('heading')).toHaveText(['Coupon Codes', 'ALPHA', 'Edit BRAVO', 'CHARLIE']);
  await expect(page.locator('#coupon-code')).toHaveValue('BRAVO');

  // Switching to another card moves the form with it.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Edit CHARLIE' }).click();
  await expect(page.getByRole('heading')).toHaveText(['Coupon Codes', 'ALPHA', 'BRAVO', 'Edit CHARLIE']);
});

test('a new coupon still opens at the top, above the list', async ({ page }) => {
  await openAdmin(page, [
    promoCoupon({ id: 'a', code: 'ALPHA', created_at: new Date().toISOString() }),
  ]);

  await page.getByRole('button', { name: 'New Coupon' }).click();
  await expect(page.getByRole('heading')).toHaveText(['Coupon Codes', 'New coupon', 'ALPHA']);
});

/**
 * Who used a code. The count on its own answers "is this working"; it does not
 * answer "who do I follow up with", which for a business this size is the more
 * useful question, and the answer is already sitting on the inquiries.
 */
function inquiry(over: Row): Row {
  return {
    id: 'i', client_name: 'Someone', client_email: 'someone@example.com',
    submission_date: new Date().toISOString(), coupon_code: 'WELCOME25',
    coupon_discount_amount: 25, is_test: false,
    ...over,
  };
}

test('a used code lists the people who used it, under the count', async ({ page }) => {
  await openAdmin(
    page,
    [promoCoupon({
      id: 'c-used', code: 'WELCOME25', discount_value: 25, times_used: 4,
      last_used_at: new Date(Date.now() - day).toISOString(),
    })],
    [
      inquiry({ id: 'i1', client_name: 'Dana Reyes', client_email: 'dana@example.com' }),
      inquiry({ id: 'i2', client_name: 'Sam Okafor', client_email: 'sam@example.com' }),
      inquiry({ id: 'i3', client_name: 'Priya Nair', client_email: 'priya@example.com' }),
      inquiry({ id: 'i4', client_name: 'Bench Test', client_email: 'bench@example.com', is_test: true }),
    ],
  );

  const card = page.locator('div.bg-white.rounded-xl')
    .filter({ has: page.getByRole('heading', { level: 3, name: 'WELCOME25' }) });

  await expect(card).toContainText('Used 4 times');

  // The names sit under the count, each with the address to reply to.
  await expect(card).toContainText('Dana Reyes');
  await expect(card).toContainText('Sam Okafor');
  await expect(card.getByRole('link', { name: 'dana@example.com' }))
    .toHaveAttribute('href', 'mailto:dana@example.com');
  await expect(card).toContainText('$25 off');

  // Three fit; the fourth waits behind the button rather than stretching the card.
  await expect(card).not.toContainText('Bench Test');
  await card.getByRole('button', { name: 'Show all 4' }).click();
  await expect(card).toContainText('Bench Test');
  // A test submission counted towards the total, so it is labelled, not hidden —
  // a list that silently disagrees with the number above it is worse.
  await expect(card).toContainText('Test');

  await card.getByRole('button', { name: 'Show fewer' }).click();
  await expect(card).not.toContainText('Bench Test');
});

test('a count with nothing behind it explains itself rather than showing an empty list', async ({ page }) => {
  // Renaming a code leaves its old uses filed under the old spelling: the
  // counter still reads 2 and there is nobody to list.
  await openAdmin(page, [promoCoupon({ id: 'c-renamed', code: 'NEWNAME', times_used: 2 })], []);

  const card = page.locator('div.bg-white.rounded-xl')
    .filter({ has: page.getByRole('heading', { level: 3, name: 'NEWNAME' }) });

  await expect(card).toContainText('Used 2 times');
  await expect(card).toContainText('No request on file for those uses');
  await expect(card).not.toContainText('Who used it');
});

test('a partly-deleted history lists who is left and accounts for the rest', async ({ page }) => {
  await openAdmin(
    page,
    [promoCoupon({ id: 'c-part', code: 'WELCOME25', times_used: 3 })],
    [inquiry({ id: 'i1', client_name: 'Dana Reyes', client_email: 'dana@example.com' })],
  );

  const card = page.locator('div.bg-white.rounded-xl')
    .filter({ has: page.getByRole('heading', { level: 3, name: 'WELCOME25' }) });

  await expect(card).toContainText('Dana Reyes');
  await expect(card).toContainText('2 earlier uses have no request on file');
});
