import { test, expect, type Page } from '@playwright/test';

/**
 * The customer portal login page, which is now also the sign-up page.
 *
 * The one thing worth protecting here above all others is that a known and an
 * unknown address are indistinguishable. If they ever diverge — different copy,
 * a different element, an error box on one and not the other — the form becomes
 * a free way to test whether somebody is a customer of this business.
 *
 * What these cannot cover, and why there is no test for it: real delivery, the
 * Supabase verify endpoint, the PKCE code exchange, and the callback landing.
 * All four need a real Auth project and a real mailbox, and stubbing them would
 * only assert that the stubs match what this file already assumes. They are on
 * the manual list in docs/PORTAL_SIGN_IN.md instead.
 */

const HARNESS = '/tests/harness/portal-login.html';

/** Counts the auth calls so a test can assert that none was made. */
async function stubAuth(page: Page, otp: { status: number; body: unknown } = { status: 200, body: {} }) {
  const calls: string[] = [];

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/auth/v1/otp')) {
      calls.push(url);
      await route.fulfill({
        status: otp.status,
        // auth-js only reads `code` off the body when the response declares an
        // API version at or past 2024-01-01, and falls back to `error_code`
        // otherwise. Real Supabase sends the header and both fields, so the
        // stub does too — without it the error arrives with no code at all and
        // the test would be exercising a path production never takes.
        headers: {
          'content-type': 'application/json',
          'x-supabase-api-version': '2024-01-01',
        },
        body: JSON.stringify(otp.body),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Anything else the page reaches for (organizations, audit logs) is noise here.
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  return calls;
}

test('sends a link and moves to the check-your-email state', async ({ page }) => {
  const calls = await stubAuth(page);
  await page.goto(HARNESS);

  await page.getByLabel('Email address').fill('someone@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByText('someone@example.com')).toBeVisible();
  expect(calls).toHaveLength(1);
});

test('a known and an unknown address are indistinguishable', async ({ page }) => {
  // Supabase answers both of these identically when shouldCreateUser is true.
  // This asserts the page does not reintroduce a difference of its own.
  const render: string[] = [];

  for (const address of ['known@example.com', 'never-seen@example.com']) {
    await stubAuth(page);
    await page.goto(HARNESS);
    await page.getByLabel('Email address').fill(address);
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    const html = await page.locator('section').last().innerHTML();
    render.push(html.replaceAll(address, '{ADDRESS}'));
  }

  expect(render[0]).toBe(render[1]);
});

test('the resend button counts down and is disabled while it does', async ({ page }) => {
  await stubAuth(page);
  await page.goto(HARNESS);

  await page.getByLabel('Email address').fill('someone@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();

  const resend = page.getByRole('button', { name: /Resend in \d+s/ });
  await expect(resend).toBeDisabled();

  const first = await resend.textContent();
  await expect
    .poll(async () => resend.textContent(), { timeout: 5_000 })
    .not.toBe(first);
});

test('an invalid address never reaches the network', async ({ page }) => {
  const calls = await stubAuth(page);
  await page.goto(HARNESS);

  // type=email would block submission on its own, so this uses an address the
  // browser accepts and our own check rejects.
  await page.getByLabel('Email address').fill('someone@localhost');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();

  await expect(page.getByRole('alert')).toContainText('valid email address');
  await expect(page.getByRole('heading', { name: 'Client Portal', exact: true })).toBeVisible();
  expect(calls).toHaveLength(0);
});

test('a rate limit says so and counts down from the server number', async ({ page }) => {
  await stubAuth(page, {
    status: 429,
    body: {
      code: 'over_email_send_rate_limit',
      error_code: 'over_email_send_rate_limit',
      message: 'For security purposes, you can only request this after 47 seconds.',
      msg: 'For security purposes, you can only request this after 47 seconds.',
    },
  });
  await page.goto(HARNESS);

  await page.getByLabel('Email address').fill('someone@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();

  await expect(page.getByRole('alert')).toContainText('very recently');
  await expect(page.getByRole('button', { name: /Resend in 4[0-9]s/ })).toBeVisible();
});

test('a disabled provider is surfaced rather than hidden behind the sent card', async ({ page }) => {
  // Nothing was sent and nothing will be, so "check your email" would just have
  // someone waiting. This leaks nothing: it is project-wide, not per-address.
  await stubAuth(page, {
    status: 422,
    body: {
      code: 'signup_disabled',
      error_code: 'signup_disabled',
      message: 'Signups not allowed for otp',
      msg: 'Signups not allowed for otp',
    },
  });
  await page.goto(HARNESS);

  await page.getByLabel('Email address').fill('someone@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();

  await expect(page.getByRole('alert')).toContainText('Google');
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeHidden();
});

test('a server fault is surfaced rather than hidden behind the sent card', async ({ page }) => {
  // The regression this guards is one that reached production: an SMTP password
  // Resend rejected with 535 surfaced here as /otp -> 500, and the page told
  // every customer to check an inbox nothing had been sent to. A 5xx says
  // nothing about the address, so showing it leaks nothing.
  await stubAuth(page, {
    status: 500,
    body: { code: 'unexpected_failure', error_code: 'unexpected_failure', message: 'Error sending magic link' },
  });
  await page.goto(HARNESS);

  await page.getByLabel('Email address').fill('someone@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();

  await expect(page.getByRole('alert')).toContainText('our end');
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeHidden();
});

test('prefills the address an invite deep-links', async ({ page }) => {
  await stubAuth(page);
  await page.goto(`${HARNESS}?email=invited%40example.com`);

  await expect(page.getByLabel('Email address')).toHaveValue('invited@example.com');
});

test('explains a link opened in the wrong browser', async ({ page }) => {
  await stubAuth(page);
  await page.goto(`${HARNESS}?error=magic_link_failed`);

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('different browser');
  await expect(alert).toContainText('6-digit code');
});
