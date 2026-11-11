import { test, expect, type Page } from '@playwright/test';

/**
 * Admin > Portal Adoption: deleting portal accounts. What these cover is that
 * nothing is deleted without the confirmation step, that exactly the chosen
 * accounts are sent to the delete function, that deleted rows leave the page,
 * and that an account the function could not delete stays listed with the
 * reason shown.
 */

type Row = Record<string, unknown>;

const row = (id: string, full_name: string | null, email: string, stage = 'not_invited'): Row => ({
  organization_id: 'org-1',
  customer_id: id,
  full_name,
  email,
  invited_at: null,
  first_login_at: stage === 'login' ? '2026-11-03T06:54:28Z' : null,
  first_job_view_at: null,
  repeat_login_at: null,
  funnel_stage: stage,
  login_count: stage === 'login' ? 1 : 0,
  last_portal_activity_at: null,
});

const TEST_A = row('11111111-1111-4111-8111-111111111111', null, 'aaa@test-inbox.example', 'login');
const TEST_B = row('22222222-2222-4222-8222-222222222222', null, 'bbb@test-inbox.example', 'login');
const REAL = row('33333333-3333-4333-8333-333333333333', 'Pat Example', 'pat@example.test');

async function stub(page: Page, failIds: string[] = []) {
  const deleteCalls: string[][] = [];
  const rows = [TEST_A, TEST_B, REAL];

  await page.addInitScript(() => {
    localStorage.setItem(
      'boxed2built.auth.token',
      JSON.stringify({
        access_token: 'header.payload.signature',
        refresh_token: 'refresh',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'admin-1', email: 'admin@example.test', app_metadata: { is_platform_admin: true }, user_metadata: {} },
      }),
    );
  });

  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({ json: { id: 'admin-1', email: 'admin@example.test', app_metadata: {}, user_metadata: {} } }),
  );
  await page.route(/\/rest\/v1\//, (route) => {
    const url = route.request().url();
    if (url.includes('/portal_adoption_report')) return route.fulfill({ json: rows });
    if (url.includes('/portal_inactive_customers_report')) return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
  await page.route(/\/functions\/v1\/delete-portal-account/, async (route) => {
    const { customerIds } = route.request().postDataJSON() as { customerIds: string[] };
    deleteCalls.push(customerIds);
    const results = customerIds.map((customerId) =>
      failIds.includes(customerId)
        ? { customerId, success: false, error: 'Could not delete the login: boom' }
        : { customerId, success: true, email: null, loginDeleted: true, clientsDeleted: 0, filesDeleted: 0 },
    );
    return route.fulfill({ json: { success: results.every((r) => r.success), results } });
  });

  await page.goto('/tests/harness/portal-adoption.html');
  await expect(page.getByText('pat@example.test')).toBeVisible();
  return deleteCalls;
}

test('a single account is deleted only after confirming', async ({ page }) => {
  const deleteCalls = await stub(page);

  await page.getByRole('button', { name: 'Delete Pat Example' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Delete this account?')).toBeVisible();
  await expect(dialog.getByText(/Jobs, invoices, bookings and inquiries stay/)).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(deleteCalls).toEqual([]);
  await expect(page.getByText('pat@example.test')).toBeVisible();

  await page.getByRole('button', { name: 'Delete Pat Example' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete account' }).click();

  await expect(page.getByRole('status')).toContainText('Deleted 1 account.');
  await expect(page.getByRole('checkbox', { name: 'Select Pat Example' })).toBeHidden();
  expect(deleteCalls).toEqual([[REAL.customer_id]]);
  await expect(page.getByText('aaa@test-inbox.example')).toBeVisible();
});

test('selected accounts are deleted together and the rest stay', async ({ page }) => {
  const deleteCalls = await stub(page);

  await page.getByRole('checkbox', { name: 'Select aaa@test-inbox.example' }).check();
  await page.getByRole('checkbox', { name: 'Select bbb@test-inbox.example' }).check();
  await expect(page.getByText('2 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Delete selected' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete 2 accounts' }).click();

  await expect(page.getByRole('status')).toContainText('Deleted 2 accounts.');
  await expect(page.getByText('aaa@test-inbox.example')).toBeHidden();
  await expect(page.getByText('bbb@test-inbox.example')).toBeHidden();
  await expect(page.getByText('pat@example.test')).toBeVisible();
  expect(deleteCalls).toEqual([[TEST_A.customer_id, TEST_B.customer_id]]);
});

test('an account that fails to delete stays listed with the reason', async ({ page }) => {
  await stub(page, [TEST_B.customer_id as string]);

  await page.getByRole('checkbox', { name: 'Select all accounts' }).check();
  await page.getByRole('button', { name: 'Delete selected' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete 3 accounts' }).click();

  const status = page.getByRole('status');
  await expect(status).toContainText('Deleted 2 accounts.');
  await expect(status).toContainText('bbb@test-inbox.example was not deleted: Could not delete the login: boom');
  await expect(page.getByRole('checkbox', { name: 'Select bbb@test-inbox.example' })).toBeChecked();
  await expect(page.getByText('pat@example.test')).toBeHidden();
});
