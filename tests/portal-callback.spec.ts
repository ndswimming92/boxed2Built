import { test, expect, type Page } from '@playwright/test';

/**
 * The portal sign-in landing page.
 *
 * Its entire job is to decide where someone goes next, and the interesting
 * decisions are the ones nobody sees until they go wrong: a token hash that is
 * still being redeemed must not be mistaken for a dead session, and a link that
 * genuinely failed must say so in the words that match what happened.
 */

const HARNESS = '/tests/harness/portal-callback.html';

/** A structurally valid JWT. supabase-js decodes the token it is handed. */
function fakeJwt(): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;

  return [
    b64({ alg: 'HS256', typ: 'JWT' }),
    b64({
      sub: '11111111-1111-1111-1111-111111111111',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'customer@example.com',
      exp,
    }),
    'stub-signature',
  ].join('.');
}

const SESSION = {
  access_token: fakeJwt(),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'stub-refresh-token',
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'customer@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
};

/** Counts verify calls so a test can assert the token is spent exactly once. */
async function stubAuth(page: Page, verify: { status: number; body: unknown }) {
  const verifyCalls: string[] = [];

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/auth/v1/verify')) {
      verifyCalls.push(url);
      await route.fulfill({
        status: verify.status,
        headers: {
          'content-type': 'application/json',
          'x-supabase-api-version': '2024-01-01',
        },
        body: JSON.stringify(verify.body),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  return verifyCalls;
}

test('a token hash signs the person in and honours the destination', async ({ page }) => {
  const verifyCalls = await stubAuth(page, { status: 200, body: SESSION });

  await page.goto(`${HARNESS}?flow=magic_link&next=%2Fportal%2Finvoices&token_hash=abc123&type=email`);

  await expect(page.getByTestId('landed-invoices')).toBeVisible();
  expect(verifyCalls).toHaveLength(1);
});

test('never mistakes a redemption in flight for a dead session', async ({ page }) => {
  // The regression this guards: the redirect effect sees no session while
  // verifyOtp is still in the air and bounces to the login page, so a link that
  // was about to work reports that it did not.
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/auth/v1/**', async (route) => {
    if (route.request().url().includes('/auth/v1/verify')) {
      await held;
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' },
        body: JSON.stringify(SESSION),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto(`${HARNESS}?flow=magic_link&token_hash=abc123&type=email`);

  // While the request is held, the page must still be waiting — not gone.
  await expect(page.getByText('Completing sign in...')).toBeVisible();
  await expect(page.getByTestId('landed-login')).toBeHidden();

  release();
  await expect(page.getByTestId('landed-dashboard')).toBeVisible();
});

test('a rejected token hash lands on the wrong-browser copy', async ({ page }) => {
  await stubAuth(page, {
    status: 401,
    body: {
      code: 'otp_expired',
      error_code: 'otp_expired',
      message: 'Email link is invalid or has expired',
      msg: 'Email link is invalid or has expired',
    },
  });

  await page.goto(`${HARNESS}?flow=magic_link&token_hash=expired&type=email`);

  await expect(page.getByTestId('landed-login')).toBeVisible();
  await expect(page.getByTestId('location')).toContainText('error=magic_link_failed');
});

test('a magic link with no session at all says so in its own words', async ({ page }) => {
  await stubAuth(page, { status: 200, body: {} });

  await page.goto(`${HARNESS}?flow=magic_link`);

  await expect(page.getByTestId('landed-login')).toBeVisible();
  await expect(page.getByTestId('location')).toContainText('error=magic_link_failed');
});

test('an OAuth landing with no session still reports an expired session', async ({ page }) => {
  // Google redirects the same tab, so a missing session there really is a dead
  // one — the magic-link copy would be wrong and confusing.
  await stubAuth(page, { status: 200, body: {} });

  await page.goto(HARNESS);

  await expect(page.getByTestId('landed-login')).toBeVisible();
  await expect(page.getByTestId('location')).toContainText('error=session_expired');
});
