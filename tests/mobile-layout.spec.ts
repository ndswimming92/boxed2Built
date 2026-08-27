import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * The admin notification panel used to be `absolute right-0 w-96`. The bell it
 * hangs off sits in the middle of the header toolbar, so on a phone the panel
 * was wider than the space to its left and most of it rendered off the left
 * edge — unreachable, because nothing scrolls a fixed-position element back
 * into view.
 *
 * These run at real phone widths, down to the 320px of an iPhone SE, because
 * that is where the arithmetic actually stops working. Every assertion targets
 * something a person reads or taps rather than the panel's container, so the
 * tests keep describing the symptom even if the markup is restructured again.
 */

const PHONE_WIDTHS = [320, 360, 390, 430];

const NOTIFICATIONS = Array.from({ length: 8 }, (_, i) => ({
  id: `n${i}`,
  organization_id: 'org',
  type: 'shop_order',
  // Long enough to push a panel that is not width-constrained off the screen.
  title: `Furniture Assembly for Lee Brannigan — order #${1000 + i}`,
  body: 'September 9, 2026 — Spring Hill. Calendar reminder created for this job.',
  link: null,
  metadata: null,
  is_read: i > 1,
  created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
}));

async function openPanel(page: Page, width: number) {
  // Supabase is stubbed so the panel renders a realistic list without an admin
  // session. Realtime is not stubbed; the subscription simply never connects.
  await page.route('**/rest/v1/admin_notifications*', (route) =>
    route.fulfill({ json: NOTIFICATIONS }),
  );
  await page.setViewportSize({ width, height: 780 });
  await page.goto('/tests/harness/mobile.html');
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
}

/** The panel rows stretch edge to edge, so one row measures the panel itself. */
function firstRow(page: Page): Locator {
  return page.getByRole('button').filter({ hasText: 'Furniture Assembly' }).first();
}

async function expectOnScreen(page: Page, target: Locator, label: string) {
  const { width, height } = page.viewportSize()!;
  const box = (await target.boundingBox({ timeout: 5_000 }))!;

  expect.soft(box.x, `${label} starts off the left edge`).toBeGreaterThanOrEqual(0);
  expect.soft(box.x + box.width, `${label} runs past the right edge`).toBeLessThanOrEqual(width);
  expect.soft(box.y, `${label} starts above the top edge`).toBeGreaterThanOrEqual(0);
  expect.soft(box.y + box.height, `${label} runs past the bottom edge`).toBeLessThanOrEqual(height);
}

for (const width of PHONE_WIDTHS) {
  test(`notification panel stays on screen at ${width}px`, async ({ page }) => {
    await openPanel(page, width);

    await expectOnScreen(page, page.getByRole('heading', { name: 'Notifications' }), 'the panel title');
    await expectOnScreen(page, page.getByRole('button', { name: 'Mark all read' }), 'mark-all-read');
    await expectOnScreen(page, firstRow(page), 'the first notification');
  });

  test(`notification panel uses the width available at ${width}px`, async ({ page }) => {
    await openPanel(page, width);

    // Measure the part actually inside the viewport: a panel that is nominally
    // 384px wide but half of it off-screen is not a usable panel.
    const box = (await firstRow(page).boundingBox({ timeout: 5_000 }))!;
    const visibleWidth = Math.min(box.x + box.width, width) - Math.max(box.x, 0);
    expect(visibleWidth).toBeGreaterThan(width * 0.8);
  });

  test(`open panel does not make the page scroll sideways at ${width}px`, async ({ page }) => {
    await openPanel(page, width);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('panel follows the bell instead of drifting when the page scrolls', async ({ page }) => {
  await openPanel(page, 390);
  const row = firstRow(page);
  const before = (await row.boundingBox())!;

  await page.mouse.wheel(0, 400);
  // The header is sticky, so the panel should not move in either axis.
  await expect
    .poll(async () => {
      const box = (await row.boundingBox())!;
      return { x: Math.round(box.x), y: Math.round(box.y) };
    })
    .toEqual({ x: Math.round(before.x), y: Math.round(before.y) });
});

test('tapping outside closes the panel', async ({ page }) => {
  await openPanel(page, 390);
  await page.mouse.click(10, 700);

  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeHidden();
});
