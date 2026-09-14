import { test, expect, type Page } from '@playwright/test';

/**
 * Per-client referral QR codes.
 *
 * Each client's referral code is printed on a thank-you token as a QR pointing
 * at `/r/<code>`, which forwards here with `?ref=<code>`. What these pin down
 * is the arrival: the code has to be in the box, and the visitor has to be told
 * something welcoming rather than the coupon miss a referral code always
 * produces. That miss is the failure mode worth guarding - the same input
 * serves coupons and referrals, and the coupon path owns the default.
 */

const REFERRAL = 'B2B-ADRIA-4F7D';

const FIXED_25 = {
  code: 'WELCOME25',
  description: 'New customer welcome offer',
  discount_type: 'fixed',
  discount_value: 25,
  ends_at: null,
};

async function stubBackend(page: Page) {
  await page.route('**/rest/v1/business_info*', (route) =>
    route.fulfill({ json: [{ id: 'biz-1', organization_id: 'org-1' }] }),
  );
  await page.route('**/rest/v1/services*', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/lookup_coupon_by_code', async (route) => {
    const { p_code } = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({ json: [FIXED_25].filter((c) => c.code === p_code) });
  });
}

const codeField = (page: Page) => page.getByLabel(/Referral or Coupon Code/i);
const welcome = (page: Page) => page.getByText(/Referral code applied/i);
const couponMiss = (page: Page) => page.getByText(/we'll treat it as a referral code/i);

test('a scanned token arrives with the referral code already entered', async ({ page }) => {
  await stubBackend(page);
  await page.goto(`/tests/harness/coupons.html?ref=${REFERRAL}`);

  await expect(codeField(page)).toHaveValue(REFERRAL);
  await expect(welcome(page)).toBeVisible();
  // The coupon lookup must not run: a referral code always misses it, and
  // "Not a coupon code" is the wrong greeting for someone holding a token.
  await expect(couponMiss(page)).toHaveCount(0);
});

test('a lowercase ref param is normalised to the stored code', async ({ page }) => {
  await stubBackend(page);
  await page.goto(`/tests/harness/coupons.html?ref=${REFERRAL.toLowerCase()}`);

  await expect(codeField(page)).toHaveValue(REFERRAL);
  await expect(welcome(page)).toBeVisible();
});

test('touching the prefilled field does not turn the welcome into a coupon miss', async ({ page }) => {
  await stubBackend(page);
  await page.goto(`/tests/harness/coupons.html?ref=${REFERRAL}`);
  await expect(welcome(page)).toBeVisible();

  await codeField(page).click();
  await codeField(page).blur();

  await expect(welcome(page)).toBeVisible();
  await expect(couponMiss(page)).toHaveCount(0);
});

test('editing the code drops the referral welcome', async ({ page }) => {
  await stubBackend(page);
  await page.goto(`/tests/harness/coupons.html?ref=${REFERRAL}`);
  await expect(welcome(page)).toBeVisible();

  await codeField(page).fill('SOMETHINGELSE');

  await expect(welcome(page)).toHaveCount(0);
});

test('an explicit coupon link still wins over a referral', async ({ page }) => {
  await stubBackend(page);
  await page.goto(`/tests/harness/coupons.html?coupon=welcome25&ref=${REFERRAL}`);

  await expect(codeField(page)).toHaveValue('WELCOME25');
  await expect(page.getByText('WELCOME25 applied — $25 off')).toBeVisible();
  await expect(welcome(page)).toHaveCount(0);
});

test('the code survives browsing away from the form and back', async ({ page }) => {
  await stubBackend(page);
  await page.goto(`/tests/harness/coupons.html?ref=${REFERRAL}`);
  await expect(codeField(page)).toHaveValue(REFERRAL);

  // Same session, no query string: the referral is remembered rather than lost.
  await page.goto('/tests/harness/coupons.html');

  await expect(codeField(page)).toHaveValue(REFERRAL);
  await expect(welcome(page)).toBeVisible();
});

/**
 * The admin side. These guard the one mistake that cannot be undone: a token
 * printed with the wrong URL on it.
 */
test('the QR encodes the canonical production URL, not the dev origin', async ({ page }) => {
  await stubBackend(page);
  await page.goto(`/tests/harness/referral-qr.html?code=${REFERRAL}`);

  // Built from SITE_URL. If this ever reads localhost or a deploy preview, a
  // batch of printed tokens is scrap.
  await expect(page.getByTestId('qr-payload')).toHaveText(
    `HTTPS://BOXED2BUILT.COM/R/${REFERRAL}`,
  );

  // Uppercase keeps the payload in QR alphanumeric mode, which is a smaller
  // symbol and so chunkier squares at the same token size.
  const payload = await page.getByTestId('qr-payload').innerText();
  expect(payload).toBe(payload.toUpperCase());
  expect(payload).not.toContain('localhost');
});

test('the copy link is the normal-case URL people can read', async ({ page }) => {
  await stubBackend(page);
  await page.goto(`/tests/harness/referral-qr.html?code=${REFERRAL}`);

  // Scoped to the <code> block: `getByText` is case-insensitive, so an
  // unscoped match would also hit the uppercase payload the harness renders.
  await expect(page.locator('code')).toHaveText(`https://boxed2built.com/r/${REFERRAL}`);
});

test('the modal renders a QR image and reports scan activity', async ({ page }) => {
  await stubBackend(page);
  // describeLastScan reads the live clock, so a hardcoded date renders
  // "3 days ago" only for the day it happens to be 3 days old. The extra hour
  // keeps Math.floor at 3 rather than sitting on the boundary.
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000 - 3_600_000).toISOString();
  await page.goto(
    `/tests/harness/referral-qr.html?code=${REFERRAL}&scans=12&last=${encodeURIComponent(threeDaysAgo)}`,
  );

  const img = page.getByAltText(/Referral QR code for/);
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/);

  await expect(page.getByText(/12\s+scans/)).toBeVisible();
  await expect(page.getByText(/last scanned 3 days ago/)).toBeVisible();
});

test('a client with no scans yet says so rather than showing nothing', async ({ page }) => {
  await stubBackend(page);
  await page.goto(`/tests/harness/referral-qr.html?code=${REFERRAL}`);

  await expect(page.getByText(/0\s+scans/)).toBeVisible();
  await expect(page.getByText(/never scanned yet/)).toBeVisible();
});
