import { test, expect, type Page } from '@playwright/test';

/**
 * Admin > Partner Leads: local businesses found by the daily search, each with
 * a draft email. What these cover is that leads show under the right tab, that
 * the browser writes only the columns it is allowed to, that an email goes out
 * only from the review step and only to the address shown there, and that a
 * lead marked not to be contacted cannot be emailed at all.
 */

type Row = Record<string, unknown>;

// 12:00 Central on Tuesday, November 3, 2026.
const NOW = new Date('2026-11-03T18:00:00Z');

const base = {
  organization_id: 'org-1',
  location: 'Franklin, TN',
  partnership_idea: null,
  website_url: null,
  email: null,
  email_source_url: null,
  phone: null,
  contact_name: null,
  contact_title: null,
  links: [],
  draft_subject: null,
  draft_body: null,
  notes: null,
  status: 'new',
  status_changed_at: null,
  status_changed_by: null,
  last_emailed_at: null,
  emails_sent: 0,
  found_on: '2026-11-03',
  created_at: '2026-11-03T12:00:00Z',
  updated_at: '2026-11-03T12:00:00Z',
};

const MOVER: Row = {
  ...base,
  id: 'lead-1',
  name: 'Example Movers',
  category: 'moving',
  summary: 'A local moving company serving Williamson and Maury counties.',
  why_fit: 'Customers often need furniture put back together after a move.\nNo assembly offered on their site.',
  partnership_idea: 'Refer move-in assembly to Boxed2Built.',
  website_url: 'https://example-movers.test',
  email: 'office@example-movers.test',
  email_source_url: 'https://example-movers.test/contact',
  phone: '(615) 555-0100',
  contact_name: 'Dana Smith',
  contact_title: 'Owner',
  links: [{ label: 'Facebook', url: 'https://facebook.com/example' }, { label: 'Bad', url: 'javascript:alert(1)' }],
  draft_subject: 'Helping your customers settle in',
  draft_body: 'Hi Dana,\n\nI run Boxed2Built in Spring Hill.',
};

const APARTMENTS: Row = {
  ...base,
  id: 'lead-2',
  name: 'Example Apartments',
  category: 'apartments',
  location: 'Spring Hill, TN',
  summary: 'A 300-unit apartment community.',
  why_fit: 'Move-ins every week.',
  found_on: '2026-11-02',
};

const PASSED: Row = {
  ...base,
  id: 'lead-3',
  name: 'Example Realty',
  category: 'realtor',
  summary: 'A realty office.',
  why_fit: 'Buyers move in.',
  email: 'hello@example-realty.test',
  status: 'do_not_contact',
  status_changed_at: '2026-11-01T12:00:00Z',
};

interface Call {
  kind: 'rest' | 'function' | 'rpc';
  method: string;
  body: Record<string, unknown> | null;
}

async function stub(page: Page, leads: Row[], extra: { emails?: Row[]; activity?: Row[] } = {}) {
  const calls: Call[] = [];
  const rows = leads.map((row) => ({ ...row }));
  const coupons: Row[] = [];

  await page.route(/\/rest\/v1\/rpc\/(get_partner_lead_email_activity|create_partner_lead_code)/, async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    calls.push({ kind: 'rpc', method: 'RPC', body });
    if (request.url().includes('get_partner_lead_email_activity')) {
      // Serve in pages the way PostgREST does, capped at 1,000 rows.
      const url = new URL(request.url());
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 1000), 1000);
      return route.fulfill({ json: (extra.activity ?? []).slice(offset, offset + limit) });
    }
    const coupon = {
      id: `coupon-${coupons.length + 1}`,
      code: body.p_code,
      discount_type: body.p_discount_type,
      discount_value: body.p_discount_value,
      is_active: true,
      times_used: 0,
      last_used_at: null,
    };
    coupons.push(coupon);
    const lead = rows.find((row) => row.id === body.p_lead_id);
    if (lead) lead.coupon_id = coupon.id;
    return route.fulfill({ json: coupon });
  });

  await page.route(/\/rest\/v1\/coupons(\?|$)/, (route) => route.fulfill({ json: coupons }));

  await page.route(/\/rest\/v1\/(partner_leads|partner_lead_emails)(\?|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();
    if (request.method() === 'GET') {
      if (table === 'partner_lead_emails') return route.fulfill({ json: url.searchParams.get('offset') && Number(url.searchParams.get('offset')) > 0 ? [] : (extra.emails ?? []) });
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return route.fulfill({ json: offset > 0 ? [] : rows });
    }
    const body = request.postDataJSON();
    calls.push({ kind: 'rest', method: request.method(), body });
    const id = /^eq\.(.+)$/.exec(url.searchParams.get('id') ?? '')?.[1];
    const row = rows.find((candidate) => candidate.id === id);
    if (!row || request.method() !== 'PATCH') return route.fulfill({ status: 403, json: { message: 'denied' } });
    Object.assign(row, body);
    return route.fulfill({ json: row });
  });

  await page.route(/\/functions\/v1\/send-partner-outreach-email/, async (route) => {
    const body = route.request().postDataJSON();
    calls.push({ kind: 'function', method: 'POST', body });
    const lead = rows.find((row) => row.id === body.leadId)!;
    if (body.mode === 'preview') {
      return route.fulfill({
        json: {
          to: lead.email,
          from: 'Nicholas Davidson <nicholas.davidson@boxed2built.com>',
          replyTo: 'nicholas.davidson@boxed2built.com',
          subject: body.subject,
          text: body.body,
          html: `<p>${String(body.body).replace(/</g, '&lt;')}</p>`,
          blocked: false,
          recentlyEmailed: false,
          lastEmailedAt: null,
          postalAddressSet: true,
        },
      });
    }
    if (body.mode === 'send') {
      Object.assign(lead, { status: 'contacted', last_emailed_at: NOW.toISOString(), emails_sent: 1 });
      return route.fulfill({ json: { sent: true, to: lead.email, sentAt: NOW.toISOString() } });
    }
    return route.fulfill({ json: { sent: true, to: 'nicholas.davidson@boxed2built.com', test: true } });
  });

  return calls;
}

async function open(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.goto('/tests/harness/partner-leads.html');
  await expect(page.getByRole('heading', { name: 'Partner Leads', exact: true })).toBeVisible();
}

function card(page: Page, name: string) {
  return page.getByRole('article', { name });
}

test('new leads list first, newest first, with a passed lead on its own tab', async ({ page }) => {
  await stub(page, [APARTMENTS, MOVER, PASSED]);
  await open(page);

  await expect(page.getByRole('tab', { name: /New/ })).toContainText('2');
  const names = await page.getByRole('article').locator('h3').allTextContents();
  expect(names).toEqual(['Example Movers', 'Example Apartments']);
  await expect(card(page, 'Example Apartments')).toContainText('No email found');

  await page.getByRole('tab', { name: /Passed/ }).click();
  await expect(card(page, 'Example Realty')).toContainText('Do not contact');
});

test('a card opens on the contact details, and only safe links render', async ({ page }) => {
  await stub(page, [MOVER]);
  await open(page);
  await card(page, 'Example Movers').getByRole('button', { name: 'Example Movers' }).click();

  const lead = card(page, 'Example Movers');
  await expect(lead.getByRole('link', { name: 'office@example-movers.test' })).toHaveAttribute(
    'href',
    'mailto:office@example-movers.test',
  );
  await expect(lead.getByRole('link', { name: /Facebook/ })).toBeVisible();
  await expect(lead.getByRole('link', { name: /Bad/ })).toHaveCount(0);
  await expect(lead.getByRole('link', { name: /Where the email was found/ })).toHaveAttribute(
    'href',
    'https://example-movers.test/contact',
  );
});

test('saving a draft writes only the draft', async ({ page }) => {
  const calls = await stub(page, [MOVER]);
  await open(page);
  const lead = card(page, 'Example Movers');
  await lead.getByRole('button', { name: 'Example Movers' }).click();

  await lead.getByLabel('Message').fill('Hi Dana,\n\nShorter note.');
  await lead.getByRole('button', { name: 'Save draft' }).click();
  await expect(lead.getByRole('button', { name: 'Save draft' })).toBeDisabled();

  const writes = calls.filter((call) => call.kind === 'rest');
  expect(writes).toHaveLength(1);
  expect(Object.keys(writes[0].body ?? {}).sort()).toEqual(['draft_body', 'draft_subject']);
});

test('the toolbar writes markup and the live preview shows the branded email', async ({ page }) => {
  await stub(page, [MOVER]);
  await open(page);
  const lead = card(page, 'Example Movers');
  await lead.getByRole('button', { name: 'Example Movers' }).click();

  const message = lead.getByLabel('Message');
  await message.fill('Refer move-in help to us.');
  await message.selectText();
  await lead.getByRole('button', { name: 'Bold' }).click();
  await expect(message).toHaveValue('**Refer move-in help to us.**');

  // Collapse the selection to the end, then insert a brand button via the
  // toolbar's form and its quick-pick.
  await message.press('Control+End');
  await lead.getByRole('button', { name: 'Insert button' }).click();
  await lead.getByRole('button', { name: 'Book online' }).click();
  await lead.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(message).toHaveValue(/\[button: Book online\]\(https:\/\/boxed2built\.com\/book\)/);

  // The live preview renders the finished, branded email.
  const previewSrc = await lead.getByTitle('Email preview').first().getAttribute('srcdoc');
  expect(previewSrc).toContain('boxed2built_logo_email.png');
  expect(previewSrc).toContain('<strong>Refer move-in help to us.</strong>');
  expect(previewSrc).toContain('Book online');
});

test('an email is sent only from the review step, to the address shown there', async ({ page }) => {
  const calls = await stub(page, [MOVER]);
  await open(page);
  const lead = card(page, 'Example Movers');
  await lead.getByRole('button', { name: 'Example Movers' }).click();
  await lead.getByRole('button', { name: /Review & send/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Review before sending' });
  await expect(dialog).toContainText('office@example-movers.test');
  const send = dialog.getByRole('button', { name: 'Send to office@example-movers.test' });
  await expect(send).toBeDisabled();
  expect(calls.filter((call) => call.body?.mode === 'send')).toHaveLength(0);

  await dialog.getByRole('checkbox').check();
  await send.click();

  await expect(page.getByRole('status')).toContainText('Email sent to Example Movers');
  const sends = calls.filter((call) => call.body?.mode === 'send');
  expect(sends).toHaveLength(1);
  expect(sends[0].body).toMatchObject({ leadId: 'lead-1', confirmTo: 'office@example-movers.test' });
  expect(String(sends[0].body?.attemptId)).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole('tab', { name: /Contacted/ })).toContainText('1');
});

test('a lead marked do not contact cannot be emailed', async ({ page }) => {
  await stub(page, [PASSED]);
  await open(page);
  await page.getByRole('tab', { name: /Passed/ }).click();
  const lead = card(page, 'Example Realty');
  await lead.getByRole('button', { name: 'Example Realty' }).click();
  await expect(lead.getByRole('button', { name: /Review & send/ })).toHaveCount(0);
  await expect(lead).toContainText('cannot be emailed');
});

test('a partner code is created from the card and added above the closing', async ({ page }) => {
  const calls = await stub(page, [{ ...MOVER, name: 'Grand Welcome of Franklin', draft_body: 'Hi Josh,\n\nA note.\n\nThanks for your time,' }]);
  await open(page);
  const lead = card(page, 'Grand Welcome of Franklin');
  await lead.getByRole('button', { name: 'Grand Welcome of Franklin' }).click();

  await expect(lead.getByLabel('Code')).toHaveValue('GRANDWELCOME');
  await expect(lead.getByLabel('Dollars off')).toHaveValue('25');
  await lead.getByRole('button', { name: 'Create code' }).click();

  await expect(lead.getByText('Used 0 times')).toBeVisible();
  const rpc = calls.find((call) => call.method === 'RPC' && call.body?.p_code);
  expect(rpc?.body).toMatchObject({ p_lead_id: 'lead-1', p_code: 'GRANDWELCOME', p_discount_type: 'fixed', p_discount_value: 25 });

  await lead.getByRole('button', { name: 'Add code to email' }).click();
  const message = await lead.getByLabel('Message').inputValue();
  expect(message).toContain('[button: Book with code GRANDWELCOME](https://boxed2built.com/contact?coupon=GRANDWELCOME)');
  expect(message.trim().endsWith('Thanks for your time,')).toBe(true);
});

test('sent emails show delivery, opens, clicks and bounces', async ({ page }) => {
  await stub(page, [{ ...MOVER, status: 'contacted', last_emailed_at: NOW.toISOString(), emails_sent: 1 }], {
    emails: [
      {
        id: 'email-1',
        organization_id: 'org-1',
        lead_id: 'lead-1',
        to_email: 'office@example-movers.test',
        subject: 'Helping your customers settle in',
        body: 'Hi Dana',
        resend_id: 're_1',
        sent_by: null,
        sent_at: '2026-11-03T17:00:00Z',
      },
    ],
    activity: [
      { email_id: 'email-1', event_type: 'email.delivered', occurred_at: '2026-11-03T17:00:02Z', link: null },
      { email_id: 'email-1', event_type: 'email.opened', occurred_at: '2026-11-03T17:30:00Z', link: null },
      { email_id: 'email-1', event_type: 'email.clicked', occurred_at: '2026-11-03T17:31:00Z', link: 'https://boxed2built.com/book?utm_source=partner_outreach' },
    ],
  });
  await open(page);
  await page.getByRole('tab', { name: /Contacted/ }).click();
  const lead = card(page, 'Example Movers');
  await expect(lead).toContainText('Clicked your email');
  await lead.getByRole('button', { name: 'Example Movers' }).click();
  await expect(lead.getByText('Delivered', { exact: true })).toBeVisible();
  await expect(lead.getByText('Opened', { exact: true })).toBeVisible();
  await expect(lead.getByText('Clicked', { exact: true })).toHaveAttribute('title', 'boxed2built.com/book');
});

test('activity past the first 1,000 events still reaches the card', async ({ page }) => {
  const email = (id: string, sentAt: string) => ({
    id,
    organization_id: 'org-1',
    lead_id: 'lead-1',
    to_email: 'office@example-movers.test',
    subject: 'Helping your customers settle in',
    body: 'Hi Dana',
    resend_id: `re_${id}`,
    sent_by: null,
    sent_at: sentAt,
  });
  const old = Array.from({ length: 1200 }, (_, index) => ({
    email_id: 'email-old',
    event_type: 'email.opened',
    occurred_at: new Date(Date.parse('2026-10-01T00:00:00Z') + index * 60_000).toISOString(),
    link: null,
  }));
  await stub(page, [{ ...MOVER, status: 'contacted', last_emailed_at: NOW.toISOString(), emails_sent: 2 }], {
    emails: [email('email-new', '2026-11-03T17:00:00Z'), email('email-old', '2026-10-01T00:00:00Z')],
    activity: [
      ...old,
      { email_id: 'email-new', event_type: 'email.bounced', occurred_at: '2026-11-03T17:00:05Z', link: null },
    ],
  });
  await open(page);
  await page.getByRole('tab', { name: /Contacted/ }).click();
  await expect(card(page, 'Example Movers')).toContainText('Email bounced');
});
