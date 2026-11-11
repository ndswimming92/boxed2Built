import { test, expect, type Page } from '@playwright/test';

/**
 * The coupon popup on the home page publishes a code to every visitor, so the
 * things worth pinning are the ones that would embarrass the business if they
 * went wrong: it must stay away when there is nothing to offer, it must not
 * nag someone who already closed it, and pressing the button has to end with
 * the discount actually on the quote.
 */

type Row = Record<string, unknown>;

const day = 86_400_000;

/** What `get_home_coupon_popup` answers with for a live, ticked coupon. */
const popupRow = (overrides: Row = {}): Row => ({
  code: 'THANKFUL25',
  discount_type: 'fixed',
  discount_value: 25,
  ends_at: null,
  headline: null,
  message: null,
  delay_seconds: 0,
  fade_ms: 0,
  frequency: 'once_per_coupon',
  position: 'center',
  cta_label: 'Claim my discount',
  ...overrides,
});

const popup = (page: Page) => page.getByTestId('coupon-popup');

/** The harness: the popup beside the quote form, as on the home page. */
async function openHome(page: Page, rows: Row[], query = '') {
  // The form's background reads (hours, reviews, service areas) decide nothing
  // here, but left unanswered they hold connections open and stall a reload.
  // Registered first so the specific routes below take precedence.
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/get_home_coupon_popup', (route) => route.fulfill({ json: rows }));
  await page.route('**/rest/v1/rpc/lookup_coupon_by_code', async (route) => {
    const { p_code } = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({
      json: rows
        .filter((row) => row.code === p_code)
        .map((row) => ({ ...row, description: null })),
    });
  });
  await page.route('**/rest/v1/business_info*', (route) =>
    route.fulfill({ json: [{ id: 'biz-1', organization_id: 'org-1' }] }),
  );
  await page.route('**/rest/v1/services*', (route) => route.fulfill({ json: [] }));

  await page.goto(`/tests/harness/coupon-popup.html${query}`);
  await expect(page.getByRole('button', { name: /^IKEA Flat-Pack/ })).toBeVisible();
}

test('a live coupon pops up with the offer, the code and the deadline', async ({ page }) => {
  await openHome(page, [popupRow({ ends_at: new Date(Date.now() + 5 * day).toISOString() })]);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('$25 OFF');
  await expect(dialog).toContainText('THANKFUL25');
  await expect(dialog).toContainText('Save $25 on your next build');
  await expect(dialog).toContainText('Limited-time offer');
  await expect(dialog).toContainText(/Ends .+ · \d days left|Ends tomorrow/);
});

test('the wording the admin wrote replaces the built-in wording', async ({ page }) => {
  await openHome(page, [popupRow({
    discount_type: 'percentage',
    discount_value: 15,
    headline: 'Thankful for our neighbors',
    message: 'Get the house ready for holiday guests.',
    cta_label: 'Get my quote',
  })]);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('15% OFF');
  await expect(dialog).toContainText('Thankful for our neighbors');
  await expect(dialog).toContainText('Get the house ready for holiday guests.');
  await expect(dialog.getByRole('button', { name: 'Get my quote' })).toBeVisible();
  // No end date, so no deadline is invented.
  await expect(dialog).toContainText('Special offer');
});

test('nothing pops up when no coupon is on offer', async ({ page }) => {
  await openHome(page, []);

  await page.waitForTimeout(500);
  await expect(popup(page)).toHaveCount(0);
});

test('it waits out the delay the admin set', async ({ page }) => {
  await openHome(page, [popupRow({ delay_seconds: 2 })]);

  await page.waitForTimeout(700);
  await expect(popup(page)).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 4000 });
});

test('claiming it applies the code to the quote form', async ({ page }) => {
  await openHome(page, [popupRow()]);

  await page.getByRole('button', { name: /^IKEA Flat-Pack/ }).click({ force: true });
  await page.getByRole('dialog').getByRole('button', { name: 'Claim my discount' }).click();

  await expect(popup(page)).toHaveCount(0);
  await expect(page.getByLabel(/Referral or Coupon Code/i)).toHaveValue('THANKFUL25');
  await expect(page.getByText('THANKFUL25 applied — $25 off')).toBeVisible();
});

test('Escape, the close button and "No thanks" all dismiss it', async ({ page }) => {
  await openHome(page, [popupRow({ frequency: 'every_visit' })]);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);
  // Dismissing is not claiming: the form is left alone.
  await expect(page.getByLabel(/Referral or Coupon Code/i)).toHaveValue('');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('dialog').getByRole('button', { name: 'Close offer' }).click();
  await expect(popup(page)).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('dialog').getByRole('button', { name: 'No thanks' }).click();
  await expect(popup(page)).toHaveCount(0);
});

test('once per coupon: a visitor who has seen it is not shown it again', async ({ page }) => {
  await openHome(page, [popupRow()]);
  await page.getByRole('dialog').getByRole('button', { name: 'No thanks' }).click();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^IKEA Flat-Pack/ })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(popup(page)).toHaveCount(0);
});

test('once per coupon: a different coupon still shows', async ({ page }) => {
  await openHome(page, [popupRow()]);
  await page.getByRole('dialog').getByRole('button', { name: 'No thanks' }).click();

  await openHome(page, [popupRow({ code: 'SANTASHELPER', discount_value: 40 })]);
  await expect(page.getByRole('dialog')).toContainText('SANTASHELPER');
});

test('once a day: it comes back after 24 hours, not before', async ({ page }) => {
  await openHome(page, [popupRow({ frequency: 'once_per_day' })]);
  await page.getByRole('dialog').getByRole('button', { name: 'No thanks' }).click();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^IKEA Flat-Pack/ })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(popup(page)).toHaveCount(0);

  // Age the record by a day rather than waiting one.
  await page.evaluate((ms) => {
    localStorage.setItem('b2b_coupon_popup_seen', JSON.stringify({ THANKFUL25: Date.now() - ms }));
  }, day + 1000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('a visitor who arrived with a code already is left alone', async ({ page }) => {
  await openHome(page, [popupRow()], '?ref=B2B-JONES-4X2A');

  await page.waitForTimeout(500);
  await expect(popup(page)).toHaveCount(0);
  await expect(page.getByLabel(/Referral or Coupon Code/i)).toHaveValue(/B2B-JONES/);
});

test('Tab stays inside the centred popup', async ({ page }) => {
  await openHome(page, [popupRow()]);

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Claim my discount' })).toBeFocused();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
});

test('on a short screen the popup scrolls instead of running off it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 420 });
  await openHome(page, [popupRow({ message: 'A longer message that wraps. '.repeat(8) })]);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(420);
  // The last control is reachable by scrolling the card.
  await dialog.getByRole('button', { name: 'No thanks' }).click();
  await expect(popup(page)).toHaveCount(0);
});

test('a placeholder business id is never sent to the database', async ({ page }) => {
  let asked = false;
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/get_home_coupon_popup', (route) => {
    asked = true;
    return route.fulfill({ json: [popupRow()] });
  });
  await page.goto('/tests/harness/coupon-popup.html?business=fallback');
  await expect(page.getByRole('button', { name: /^IKEA Flat-Pack/ })).toBeVisible();
  await page.waitForTimeout(500);

  expect(asked).toBe(false);
  await expect(popup(page)).toHaveCount(0);
});

test('the corner position leaves the page usable behind it', async ({ page }) => {
  await openHome(page, [popupRow({ position: 'corner' })]);

  await expect(page.getByRole('dialog')).toBeVisible();
  // No dimmed backdrop in the way: the form underneath still takes a click.
  await page.getByRole('button', { name: /^IKEA Flat-Pack/ }).click();
  await expect(page.getByTestId('quote-estimate')).toContainText('$185');
  await expect(page.getByRole('dialog')).toBeVisible();
});

/* ── Admin ──────────────────────────────────────────────────────────────── */

const coupon = (overrides: Row): Row => ({
  description: null, discount_type: 'fixed', discount_value: 25,
  starts_at: null, ends_at: null, is_active: true, times_used: 0, last_used_at: null,
  business_id: 'biz-1', organization_id: 'org-1', created_by: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  promote: false, promo_post_at: null, promo_message: null,
  show_on_home: false, popup_headline: null, popup_message: null,
  ...overrides,
});

async function openAdmin(page: Page, coupons: Row[], settings: Row | null = null) {
  const writes: { table: string; method: string; body: Row }[] = [];

  await page.route('**/rest/v1/business_info*', (route) =>
    route.fulfill({ json: [{ id: 'biz-1', organization_id: 'org-1' }] }),
  );
  await page.route('**/rest/v1/coupons*', (route) => {
    const method = route.request().method();
    if (method !== 'GET') {
      const body = JSON.parse(route.request().postData() || '{}');
      writes.push({ table: 'coupons', method, body });
      return route.fulfill({ json: { ...coupons[0], ...body } });
    }
    return route.fulfill({ json: coupons });
  });
  await page.route('**/rest/v1/coupon_popup_settings*', (route) => {
    const method = route.request().method();
    if (method !== 'GET') {
      writes.push({ table: 'coupon_popup_settings', method, body: JSON.parse(route.request().postData() || '{}') });
      return route.fulfill({ status: 201, json: [] });
    }
    return route.fulfill({ json: settings });
  });
  await page.route('**/rest/v1/partner_leads*', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/form_inquiries*', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/audit_logs*', (route) => route.fulfill({ status: 201, json: [] }));

  await page.goto('/tests/harness/coupons.html?view=admin');
  await expect(page.getByRole('heading', { name: 'Coupon Codes' })).toBeVisible();
  return writes;
}

const status = (page: Page) => page.getByTestId('coupon-popup-status');

test('the admin page says which coupon visitors are seeing', async ({ page }) => {
  await openAdmin(page, [
    coupon({ id: 'c1', code: 'PRIVATE15' }),
    coupon({ id: 'c2', code: 'THANKFUL25', show_on_home: true, ends_at: new Date(Date.now() + 9 * day).toISOString() }),
    coupon({ id: 'c3', code: 'ALLYEAR10', show_on_home: true }),
  ]);

  // Soonest-ending wins over the one with no end date; the unticked one never counts.
  await expect(status(page)).toContainText('Visitors are seeing THANKFUL25 right now');
  await expect(page.getByText('On home page now')).toHaveCount(1);
  await expect(page.getByText('Home page popup · waiting its turn')).toHaveCount(1);
});

test('with nothing ticked, the admin page says how to tick one', async ({ page }) => {
  await openAdmin(page, [coupon({ id: 'c1', code: 'PRIVATE15' })]);

  await expect(status(page)).toContainText('No coupon is ticked yet');
});

test('a ticked coupon that has not started is named as coming up', async ({ page }) => {
  await openAdmin(page, [
    coupon({ id: 'c1', code: 'SANTASHELPER', show_on_home: true, starts_at: new Date(Date.now() + 20 * day).toISOString() }),
  ]);

  await expect(status(page)).toContainText('Nothing showing right now. SANTASHELPER starts');
  await expect(page.getByText('Home page popup when live')).toBeVisible();
});

test('the card switch puts a coupon on the home page', async ({ page }) => {
  const writes = await openAdmin(page, [coupon({ id: 'c1', code: 'THANKFUL25' })]);

  await page.getByRole('button', { name: 'Show THANKFUL25 on the home page' }).click();

  await expect.poll(() => writes.find((w) => w.table === 'coupons')?.body).toEqual({ show_on_home: true });
});

test('popup settings save what was chosen', async ({ page }) => {
  const writes = await openAdmin(page, [coupon({ id: 'c1', code: 'THANKFUL25', show_on_home: true })]);

  await page.getByRole('button', { name: 'Popup settings' }).click();
  await page.getByLabel('Wait before showing').fill('8');
  await page.getByLabel('How often one visitor sees it').selectOption('once_per_day');
  await page.getByLabel('Bottom corner').check();
  await page.getByLabel('Button text').fill('Get my quote');
  await page.getByRole('button', { name: 'Save popup settings' }).click();

  await expect.poll(() => writes.find((w) => w.table === 'coupon_popup_settings')?.body).toMatchObject({
    business_id: 'biz-1',
    is_enabled: true,
    delay_seconds: 8,
    frequency: 'once_per_day',
    position: 'corner',
    cta_label: 'Get my quote',
  });
});

test('switching the popup off is saved and said plainly', async ({ page }) => {
  const writes = await openAdmin(page, [coupon({ id: 'c1', code: 'THANKFUL25', show_on_home: true })]);

  await page.getByRole('switch').uncheck();

  await expect.poll(() => writes.find((w) => w.table === 'coupon_popup_settings')?.body).toMatchObject({ is_enabled: false });
  await expect(status(page)).toContainText('Switched off');
  await expect(page.getByText('Home page popup is off')).toBeVisible();
});

test('preview shows the popup with the wording typed in the form', async ({ page }) => {
  await openAdmin(page, [coupon({ id: 'c1', code: 'THANKFUL25' })]);

  await page.getByRole('button', { name: 'Edit THANKFUL25' }).click();
  await page.getByLabel('Show on home page').check();
  await page.getByLabel(/Popup headline/).fill('Thankful for our neighbors');
  await page.getByRole('button', { name: 'Preview popup' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('THANKFUL25');
  await expect(dialog).toContainText('Thankful for our neighbors');
  await dialog.getByRole('button', { name: 'No thanks' }).click();
  await expect(page.getByTestId('coupon-popup')).toHaveCount(0);
});
