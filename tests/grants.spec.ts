import { test, expect, type Page } from '@playwright/test';

/**
 * Admin > Grants is a read-only list written by the daily grant finder. There
 * is no approval step, so what these cover is that a saved grant shows
 * everything needed to act on it, lands on the right tab as its deadline comes
 * and goes, and that the page never writes back or renders a bad link.
 */

type Row = Record<string, unknown>;

// 12:00 Central on Thursday, October 8, 2026.
const NOW = new Date('2026-10-08T17:00:00Z');

const base = {
  organization_id: 'org-1',
  fit_notes: null,
  application_requirements: null,
  other_notes: null,
  entry_fee: null,
  funder_scope: 'national',
  cycle_status: 'open',
  deadline: null,
  deadline_note: null,
  opens_on: null,
  last_verified_on: '2026-10-08',
  created_at: '2026-09-01T12:00:00Z',
  updated_at: '2026-10-08T12:00:00Z',
};

const OPEN_LATER: Row = {
  ...base,
  id: 'grant-1',
  name: 'Main Street Boost Grant',
  funder: 'Example Bank Foundation',
  description: 'Cash awards to help small service businesses buy equipment and grow.',
  amount: '$5,000 each to 20 businesses',
  eligibility: 'For-profit US businesses with fewer than 10 employees, operating at least one year.',
  fit_notes: 'Home services qualify. Check: the one-year rule counts time before the LLC was formed.',
  application_requirements: 'A 500-word essay and a one-minute video.',
  other_notes: 'Funds must be spent on equipment within 12 months.',
  apply_url: 'https://example.org/main-street-boost',
  deadline: '2026-11-30',
  deadline_note: '5:00 PM ET',
};

const OPEN_SOON: Row = {
  ...base,
  id: 'grant-2',
  name: 'Tennessee Trades Award',
  funder: 'Example Chamber of Commerce',
  description: 'A yearly award for skilled trades businesses in Middle Tennessee.',
  amount: '$2,500',
  eligibility: 'Businesses based in Maury or Williamson County.',
  apply_url: 'https://example.org/trades-award',
  funder_scope: 'local',
  deadline: '2026-10-17',
  created_at: '2026-10-08T12:00:00Z',
};

const OPEN_ROLLING: Row = {
  ...base,
  id: 'grant-3',
  name: 'Rolling Microgrant',
  funder: 'Example Collective',
  description: 'Monthly microgrants with no set deadline.',
  amount: '$1,000 monthly',
  eligibility: 'Any US small business.',
  apply_url: 'https://example.org/microgrant',
  deadline_note: 'Rolling',
  entry_fee: '$15 per entry',
};

const UPCOMING: Row = {
  ...base,
  id: 'grant-4',
  name: 'Home Service Heroes Grant',
  funder: 'Example Software Co.',
  description: 'An annual grant program for home service businesses.',
  amount: '$10,000 to $50,000',
  eligibility: 'Home service businesses in the US or Canada.',
  apply_url: 'https://example.org/heroes',
  cycle_status: 'upcoming',
  opens_on: '2027-02-01',
};

// The finder last saw this one open, but its deadline has since passed.
const DEADLINE_PASSED: Row = {
  ...base,
  id: 'grant-5',
  name: 'Summer Storefront Grant',
  funder: 'Example City',
  description: 'A one-time grant that has ended.',
  amount: '$3,000',
  eligibility: 'Local businesses.',
  apply_url: 'https://example.org/summer',
  deadline: '2026-10-01',
  last_verified_on: '2026-10-01',
};

const BAD_LINK: Row = {
  ...base,
  id: 'grant-6',
  name: 'A grant with a link that is not a web address',
  funder: 'Unknown',
  description: 'Should never become something clickable.',
  amount: '$1',
  eligibility: 'Nobody.',
  apply_url: 'javascript:alert(1)',
};

/**
 * Reads answer the way PostgREST would: only the rows of the organization the
 * request filtered on, and of those the slice it asked for (the page reads the
 * table in pages until one comes back empty). A request with no organization
 * filter gets every row, which is exactly what the page must never ask for.
 * Anything that is not a read is recorded, so a test can assert that the page
 * never writes.
 */
async function stubGrants(page: Page, rows: Row[]) {
  const writes: string[] = [];

  await page.route('**/rest/v1/business_grants*', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET' && request.method() !== 'HEAD') {
      writes.push(request.method());
      return route.fulfill({ status: 403, json: { message: 'read-only' } });
    }
    const params = new URL(request.url()).searchParams;
    const organization = /^eq\.(.+)$/.exec(params.get('organization_id') ?? '')?.[1] ?? null;
    const visible = organization ? rows.filter((row) => row.organization_id === organization) : rows;
    const offset = Number(params.get('offset') ?? 0);
    const limit = Number(params.get('limit') ?? visible.length);
    return route.fulfill({ json: visible.slice(offset, offset + limit) });
  });

  return writes;
}

async function open(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.goto('/tests/harness/grants.html');
  await expect(page.getByRole('heading', { name: 'Grants', exact: true })).toBeVisible();
}

function card(page: Page, row: Row) {
  return page.getByRole('article', { name: row.name as string });
}

test('a grant shows its name, company, description, criteria and how to apply', async ({ page }) => {
  await stubGrants(page, [OPEN_LATER]);
  await open(page);

  const grant = card(page, OPEN_LATER);
  await expect(grant.getByRole('heading', { name: 'Main Street Boost Grant' })).toBeVisible();
  await expect(grant.getByText('Example Bank Foundation')).toBeVisible();
  await expect(grant.getByText('$5,000 each to 20 businesses')).toBeVisible();
  await expect(grant.getByText(OPEN_LATER.description as string)).toBeVisible();
  await expect(grant.getByText(OPEN_LATER.eligibility as string)).toBeVisible();
  await expect(grant.getByText('A 500-word essay and a one-minute video.')).toBeVisible();
  await expect(grant.getByText('Funds must be spent on equipment within 12 months.')).toBeVisible();
  await expect(grant.getByText('Last checked October 8, 2026')).toBeVisible();

  const apply = grant.getByRole('link', { name: /Go to the application/ });
  await expect(apply).toHaveAttribute('href', 'https://example.org/main-street-boost');
  await expect(apply).toHaveAttribute('target', '_blank');
  await expect(apply).toHaveAttribute('rel', /noopener/);

  await expect(page.getByText('Grant finder last ran October 8, 2026')).toBeVisible();
});

test('the amount, deadline and cost are set apart as the facts to read first', async ({ page }) => {
  // A whole sentence set in large type was the hardest part of the card to
  // read. Each fact is a short headline, with the funder's small print under it.
  const WORDY: Row = {
    ...OPEN_LATER,
    amount: '$500 to one business each month; monthly recipients are also considered for a $2,500 year-end grant',
  };
  await stubGrants(page, [WORDY]);
  await open(page);

  const facts = card(page, WORDY).getByRole('definition');
  await expect(facts).toHaveCount(3);
  await expect(facts.nth(0)).toContainText('$500 to one business each month');
  await expect(facts.nth(0)).toContainText('Monthly recipients are also considered for a $2,500 year-end grant');
  await expect(facts.nth(1).getByText('November 30, 2026', { exact: true })).toBeVisible();
  await expect(facts.nth(1).getByText('5:00 PM ET', { exact: true })).toBeVisible();
  await expect(facts.nth(2).getByText('Free', { exact: true })).toBeVisible();
});

test('long text is broken into a list of points, and a single point stays a sentence', async ({ page }) => {
  const BY_LINE: Row = {
    ...OPEN_LATER,
    eligibility: 'For-profit U.S. businesses only.\nFewer than 10 employees.\nOperating for at least one year.',
  };
  await stubGrants(page, [BY_LINE]);
  await open(page);

  const grant = card(page, BY_LINE);
  // Saved as a paragraph of two sentences: shown as two points.
  await expect(grant.getByRole('listitem').filter({ hasText: 'Home services qualify.' })).toHaveText(
    'Home services qualify.',
  );
  await expect(
    grant.getByRole('listitem').filter({ hasText: 'the one-year rule counts time before the LLC was formed' }),
  ).toHaveCount(1);
  // Saved one point per line: one point per line, and "U.S." does not start a new one.
  const who = grant.locator('section').filter({ has: page.getByRole('heading', { name: 'Who can apply' }) });
  await expect(who.getByRole('listitem')).toHaveText([
    'For-profit U.S. businesses only.',
    'Fewer than 10 employees.',
    'Operating for at least one year.',
  ]);
  // One sentence is not worth a bullet.
  const asks = grant
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'What the application asks for' }) });
  await expect(asks.getByRole('listitem')).toHaveCount(0);
  await expect(asks.getByText('A 500-word essay and a one-minute video.')).toBeVisible();
});

test('open grants need no approval and are listed nearest deadline first', async ({ page }) => {
  await stubGrants(page, [OPEN_ROLLING, OPEN_LATER, OPEN_SOON]);
  await open(page);

  await expect(page.getByRole('tab', { name: /Open now/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Open now/ })).toContainText('3');
  await expect(page.getByRole('article').getByRole('heading', { level: 2 })).toHaveText([
    'Tennessee Trades Award',
    'Main Street Boost Grant',
    'Rolling Microgrant',
  ]);

  await expect(card(page, OPEN_SOON).getByText('Closes in 9 days')).toBeVisible();
  await expect(card(page, OPEN_SOON).getByText('New', { exact: true })).toBeVisible();
  await expect(card(page, OPEN_SOON).getByText('Local', { exact: true })).toBeVisible();
  await expect(card(page, OPEN_LATER).getByText(/Closes in/)).toHaveCount(0);
  await expect(card(page, OPEN_LATER).getByText('New', { exact: true })).toHaveCount(0);
  await expect(card(page, OPEN_ROLLING).getByText('Rolling', { exact: true })).toBeVisible();
});

test('a grant that costs money to enter says so', async ({ page }) => {
  await stubGrants(page, [OPEN_ROLLING, OPEN_LATER]);
  await open(page);

  const paid = card(page, OPEN_ROLLING).getByRole('definition').nth(2);
  await expect(paid.getByText('$15 per entry', { exact: true })).toBeVisible();
  await expect(paid.getByText('This one costs money to enter.')).toBeVisible();

  const free = card(page, OPEN_LATER).getByRole('definition').nth(2);
  await expect(free.getByText('Free', { exact: true })).toBeVisible();
  await expect(card(page, OPEN_LATER).getByText(/costs money to enter/)).toHaveCount(0);
});

test('upcoming and closed grants are kept apart from the open ones', async ({ page }) => {
  await stubGrants(page, [OPEN_LATER, UPCOMING, DEADLINE_PASSED]);
  await open(page);

  await expect(card(page, OPEN_LATER)).toBeVisible();
  await expect(card(page, UPCOMING)).toHaveCount(0);
  await expect(card(page, DEADLINE_PASSED)).toHaveCount(0);

  await page.getByRole('tab', { name: /Opening soon/ }).click();
  await expect(card(page, UPCOMING)).toBeVisible();
  await expect(card(page, UPCOMING).getByText('February 1, 2027')).toBeVisible();
  await expect(card(page, OPEN_LATER)).toHaveCount(0);

  // Saved as open, but its deadline passed a week ago: it must not sit under
  // "Open now" until the next run gets round to it.
  await page.getByRole('tab', { name: /Closed/ }).click();
  await expect(card(page, DEADLINE_PASSED)).toBeVisible();
  await expect(card(page, DEADLINE_PASSED).getByText('Closed', { exact: true })).toBeVisible();
  await expect(card(page, DEADLINE_PASSED).getByRole('link', { name: /View on the funder/ })).toBeVisible();
});

test('search narrows the list by grant, company or criteria', async ({ page }) => {
  await stubGrants(page, [OPEN_LATER, OPEN_SOON, OPEN_ROLLING]);
  await open(page);

  await page.getByLabel('Search grants').fill('williamson');
  await expect(card(page, OPEN_SOON)).toBeVisible();
  await expect(card(page, OPEN_LATER)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Open now/ })).toContainText('1');

  await page.getByLabel('Search grants').fill('nothing matches this');
  await expect(page.getByText('No grants on this tab match "nothing matches this".')).toBeVisible();

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByRole('article')).toHaveCount(3);
});

test('the page only reads, and a bad link is never clickable', async ({ page }) => {
  const writes = await stubGrants(page, [BAD_LINK, OPEN_LATER]);
  await open(page);

  await expect(card(page, BAD_LINK).getByText('The saved link is not a valid web address.')).toBeVisible();
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Edit|Delete|Approve|Reject/ })).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('an empty list explains where grants come from', async ({ page }) => {
  await stubGrants(page, []);
  await open(page);

  await expect(
    page.getByText('No open grants saved yet. The daily grant finder adds them here each morning.'),
  ).toBeVisible();
  await expect(page.getByText(/Grant finder last ran/)).toHaveCount(0);
});

test('a failed load shows the error and nothing that reads like an empty list', async ({ page }) => {
  await page.route('**/rest/v1/business_grants*', (route) =>
    route.fulfill({ status: 500, json: { message: 'boom' } }),
  );
  await open(page);

  await expect(page.getByRole('alert')).toContainText('Failed to load grants');
  // What is saved is unknown, so the page must not claim there is nothing:
  // no "no grants yet" message, no tab counts of zero, nothing to search.
  await expect(page.getByText(/No open grants saved yet/)).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByLabel('Search grants')).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('only the selected organization\'s grants are listed', async ({ page }) => {
  // RLS lets an admin of two organizations, or a platform admin, read both.
  // Without a filter the other organization's grants would be listed here as
  // if they were Boxed2Built's.
  const OTHER_ORG: Row = {
    ...OPEN_SOON,
    id: 'grant-other',
    organization_id: 'org-2',
    name: 'Another Business Grant',
  };
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/business_grants')) requests.push(request.url());
  });
  await stubGrants(page, [OPEN_LATER, OTHER_ORG]);
  await open(page);

  await expect(card(page, OPEN_LATER)).toBeVisible();
  await expect(card(page, OTHER_ORG)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Open now/ })).toContainText('1');
  expect(requests.length).toBeGreaterThan(0);
  for (const url of requests) {
    expect(new URL(url).searchParams.get('organization_id')).toBe('eq.org-1');
  }
});

test('with no organization selected it asks for nothing and says why the list is empty', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/business_grants')) requests.push(request.url());
  });
  await stubGrants(page, [OPEN_LATER]);
  await page.clock.setFixedTime(NOW);
  await page.goto('/tests/harness/grants.html?org=none');

  await expect(page.getByRole('alert')).toContainText('No organization is selected');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  expect(requests).toEqual([]);
});
