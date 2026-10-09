import { test, expect, type Page } from '@playwright/test';

/**
 * Admin > Competitor Watch is two lists on one page, both written by the weekly
 * competitor watch: a checklist of things competitors do that Boxed2Built does
 * not yet, and the competitors themselves. What these cover is that an item can
 * be ticked off or removed and that nothing else is ever written, that a
 * competitor's card opens on everything found about it, and that a saved link
 * or address is never rendered as something dangerous.
 */

type Row = Record<string, unknown>;

// 12:00 Central on Monday, October 12, 2026.
const NOW = new Date('2026-10-12T17:00:00Z');

const itemBase = {
  organization_id: 'org-1',
  suggestion: null,
  category: 'services',
  priority: 'medium',
  effort: 'moderate',
  competitor_names: [],
  source_url: null,
  status: 'open',
  status_changed_at: null,
  status_changed_by: null,
  last_seen_on: '2026-10-12',
  created_at: '2026-09-28T11:00:00Z',
  updated_at: '2026-10-12T11:00:00Z',
};

const ITEM_HIGH: Row = {
  ...itemBase,
  id: 'item-1',
  title: 'Show starting prices on the website',
  detail: 'Three local competitors list a starting price for each kind of furniture.',
  suggestion: 'Add a "from" price beside each service.\nLink each one to the booking page.',
  category: 'pricing',
  priority: 'high',
  effort: 'quick',
  competitor_names: ['Example Assembly Co.', 'Taskrabbit'],
  source_url: 'https://example.com/pricing',
  created_at: '2026-10-12T11:00:00Z',
};

const ITEM_MEDIUM: Row = {
  ...itemBase,
  id: 'item-2',
  title: 'Offer a haul-away add-on for boxes and packaging',
  detail: 'Two competitors take the packaging with them for a small fee.',
  category: 'services',
  competitor_names: ['Example Assembly Co.'],
};

const ITEM_LOW: Row = {
  ...itemBase,
  id: 'item-3',
  title: 'List the business on Nextdoor',
  detail: 'One competitor has a recommended Nextdoor business page.',
  category: 'marketing',
  priority: 'low',
  effort: 'quick',
};

const ITEM_DONE: Row = {
  ...itemBase,
  id: 'item-4',
  title: 'Add online booking',
  detail: 'Most competitors let customers pick a time online.',
  category: 'booking',
  status: 'done',
  status_changed_at: '2026-10-06T15:00:00Z',
};

const competitorBase = {
  organization_id: 'org-1',
  operating_status: 'operating',
  location: null,
  website_url: null,
  owner_name: null,
  email: null,
  phone: null,
  service_area: null,
  services: null,
  pricing: null,
  booking: null,
  standout: null,
  reviews: null,
  other_notes: null,
  links: [],
  last_verified_on: '2026-10-12',
  removed_at: null,
  removed_by: null,
  created_at: '2026-09-28T11:00:00Z',
  updated_at: '2026-10-12T11:00:00Z',
};

const LOCAL: Row = {
  ...competitorBase,
  id: 'competitor-1',
  name: 'Example Assembly Co.',
  category: 'local',
  location: 'Franklin, TN',
  summary: 'A two-person furniture assembly crew working across Williamson County.',
  website_url: 'https://www.example.com/',
  owner_name: 'Jordan Example',
  email: 'hello@example.com',
  phone: '(615) 555-0100',
  service_area: 'Franklin, Brentwood and Spring Hill.',
  services: 'Furniture assembly\nTV mounting\nPlayset assembly',
  pricing: 'From $65 an item.\n$95 minimum per visit.',
  booking: 'Online booking with a deposit.',
  standout: 'Same-day appointments.\nA one-year workmanship guarantee.',
  reviews: '4.9 stars from 120 Google reviews.',
  other_notes: 'In business since 2019.',
  links: [
    { label: 'Facebook', url: 'https://facebook.com/exampleassembly' },
    { label: 'Not a web address', url: 'javascript:alert(1)' },
  ],
  created_at: '2026-10-12T11:00:00Z',
};

const PLATFORM: Row = {
  ...competitorBase,
  id: 'competitor-2',
  name: 'Taskrabbit',
  category: 'platform',
  location: 'Nationwide',
  summary: 'A marketplace where customers book independent taskers for assembly.',
  website_url: 'https://www.taskrabbit.example/',
};

const RETAILER: Row = {
  ...competitorBase,
  id: 'competitor-3',
  name: 'Big Box Assembly Service',
  category: 'retailer',
  summary: 'Assembly sold at checkout by a furniture retailer.',
};

const BAD_CONTACT: Row = {
  ...competitorBase,
  id: 'competitor-4',
  name: 'Unsafe Details LLC',
  category: 'local',
  summary: 'Saved with a website and an email that are not what they claim to be.',
  website_url: 'javascript:alert(1)',
  email: 'a@example.com,b@example.com',
  phone: 'call us',
};

interface Write {
  table: string;
  method: string;
  id: string | null;
  organization: string | null;
  body: unknown;
}

/**
 * Reads answer the way PostgREST would: only the rows of the organization the
 * request filtered on, and of those the slice it asked for (the page reads each
 * table in pages until one comes back empty). A PATCH is applied to the stored
 * row and answered with the saved row, so the page shows what the database
 * holds. Every write is recorded, so a test can assert exactly what was sent.
 */
async function stubWatch(
  page: Page,
  data: { items?: Row[]; competitors?: Row[] },
  options: { failWrites?: boolean } = {},
) {
  const writes: Write[] = [];
  const tables: Record<string, Row[]> = {
    competitor_action_items: (data.items ?? []).map((row) => ({ ...row })),
    competitors: (data.competitors ?? []).map((row) => ({ ...row })),
  };

  await page.route(/\/rest\/v1\/(competitor_action_items|competitors)(\?|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop() as string;
    const rows = tables[table];
    const eq = (name: string) => /^eq\.(.+)$/.exec(url.searchParams.get(name) ?? '')?.[1] ?? null;
    const organization = eq('organization_id');

    if (request.method() === 'GET' || request.method() === 'HEAD') {
      const visible = organization ? rows.filter((row) => row.organization_id === organization) : rows;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? visible.length);
      return route.fulfill({ json: visible.slice(offset, offset + limit) });
    }

    const body = request.postDataJSON();
    writes.push({ table, method: request.method(), id: eq('id'), organization, body });
    if (request.method() !== 'PATCH' || options.failWrites) {
      return route.fulfill({ status: 403, json: { message: 'permission denied' } });
    }

    const row = rows.find((candidate) => candidate.id === eq('id') && candidate.organization_id === organization);
    if (!row) {
      return route.fulfill({ status: 406, json: { code: 'PGRST116', message: '0 rows', details: '0 rows' } });
    }
    Object.assign(row, body);
    // The database stamps these; the browser never sends them.
    if (table === 'competitor_action_items') row.status_changed_at = NOW.toISOString();
    return route.fulfill({ json: row });
  });

  return writes;
}

async function open(page: Page, query = '') {
  await page.clock.setFixedTime(NOW);
  await page.goto(`/tests/harness/competitors.html${query}`);
  await expect(page.getByRole('heading', { name: 'Competitor Watch', exact: true })).toBeVisible();
}

function checklist(page: Page) {
  return page.getByRole('region', { name: 'Things to work on' });
}

function item(page: Page, row: Row) {
  return checklist(page).getByRole('listitem', { name: row.title as string, exact: true });
}

function card(page: Page, row: Row) {
  return page.getByRole('article', { name: row.name as string });
}

async function expand(page: Page, row: Row) {
  await card(page, row).getByRole('button', { name: row.name as string }).click();
}

test('the checklist lists what to work on, highest impact first', async ({ page }) => {
  await stubWatch(page, { items: [ITEM_LOW, ITEM_MEDIUM, ITEM_HIGH, ITEM_DONE] });
  await open(page);

  await expect(page.getByRole('tab', { name: /To do/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /To do/ })).toContainText('3');
  await expect(page.getByRole('tab', { name: /Done/ })).toContainText('1');
  await expect(checklist(page).getByRole('heading', { level: 3 })).toHaveText([
    'Show starting prices on the website',
    'Offer a haul-away add-on for boxes and packaging',
    'List the business on Nextdoor',
  ]);

  const high = item(page, ITEM_HIGH);
  await expect(high.getByText(ITEM_HIGH.detail as string)).toBeVisible();
  await expect(high.getByText('New', { exact: true })).toBeVisible();
  await expect(high.getByText('High impact', { exact: true })).toBeVisible();
  await expect(high.getByText('Quick win', { exact: true })).toBeVisible();
  await expect(high.getByText('Pricing', { exact: true })).toBeVisible();
  await expect(high.getByText('Example Assembly Co., Taskrabbit')).toBeVisible();
  await expect(item(page, ITEM_MEDIUM).getByText('New', { exact: true })).toHaveCount(0);

  await expect(page.getByText('Last checked October 12, 2026')).toBeVisible();
});

test('how to do it, and the example link, open under an item', async ({ page }) => {
  await stubWatch(page, { items: [ITEM_HIGH, ITEM_MEDIUM] });
  await open(page);

  const high = item(page, ITEM_HIGH);
  const toggle = high.getByRole('button', { name: 'How Boxed2Built could do it' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(high.getByText('Add a "from" price beside each service.')).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(high.getByRole('listitem')).toHaveText([
    'Add a "from" price beside each service.',
    'Link each one to the booking page.',
  ]);
  const example = high.getByRole('link', { name: /See an example/ });
  await expect(example).toHaveAttribute('href', 'https://example.com/pricing');
  await expect(example).toHaveAttribute('target', '_blank');
  await expect(example).toHaveAttribute('rel', /noopener/);

  // Nothing more was saved for this one, so there is nothing to open.
  await expect(item(page, ITEM_MEDIUM).getByRole('button', { name: 'How Boxed2Built could do it' })).toHaveCount(0);
});

test('ticking an item moves it to Done, and unticking brings it back', async ({ page }) => {
  const writes = await stubWatch(page, { items: [ITEM_HIGH, ITEM_MEDIUM] });
  await open(page);

  await page.getByRole('checkbox', { name: `Mark as done: ${ITEM_HIGH.title}` }).click();
  await expect(item(page, ITEM_HIGH)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /To do/ })).toContainText('1');
  await expect(page.getByRole('tab', { name: /Done/ })).toContainText('1');
  // The one thing the browser may change, and nothing else rides along with it.
  expect(writes).toEqual([
    { table: 'competitor_action_items', method: 'PATCH', id: 'item-1', organization: 'org-1', body: { status: 'done' } },
  ]);

  await page.getByRole('tab', { name: /Done/ }).click();
  await expect(item(page, ITEM_HIGH)).toBeVisible();
  const ticked = page.getByRole('checkbox', { name: `Move back to To do: ${ITEM_HIGH.title}` });
  await expect(ticked).toBeChecked();

  await ticked.click();
  await expect(item(page, ITEM_HIGH)).toHaveCount(0);
  await page.getByRole('tab', { name: /To do/ }).click();
  await expect(item(page, ITEM_HIGH)).toBeVisible();
  expect(writes[1].body).toEqual({ status: 'open' });
});

test('removing an item keeps it under Removed, where it can be put back', async ({ page }) => {
  const writes = await stubWatch(page, { items: [ITEM_HIGH, ITEM_MEDIUM] });
  await open(page);

  await page.getByRole('button', { name: `Remove: ${ITEM_MEDIUM.title}` }).click();
  await expect(item(page, ITEM_MEDIUM)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Removed/ })).toContainText('1');
  // Removed, not deleted: the weekly run reads the row to know not to suggest it again.
  expect(writes).toEqual([
    {
      table: 'competitor_action_items',
      method: 'PATCH',
      id: 'item-2',
      organization: 'org-1',
      body: { status: 'dismissed' },
    },
  ]);

  await page.getByRole('tab', { name: /Removed/ }).click();
  await expect(item(page, ITEM_MEDIUM)).toBeVisible();
  await expect(checklist(page).getByRole('checkbox')).toHaveCount(0);

  await page.getByRole('button', { name: `Put back on the list: ${ITEM_MEDIUM.title}` }).click();
  await expect(page.getByText(/Nothing removed/)).toBeVisible();
  await page.getByRole('tab', { name: /To do/ }).click();
  await expect(item(page, ITEM_MEDIUM)).toBeVisible();
  expect(writes[1].body).toEqual({ status: 'open' });
});

test('a save that fails says so and leaves the item where it was', async ({ page }) => {
  await stubWatch(page, { items: [ITEM_HIGH] }, { failWrites: true });
  await open(page);

  await page.getByRole('checkbox', { name: `Mark as done: ${ITEM_HIGH.title}` }).click();
  await expect(page.getByRole('alert')).toContainText('Failed to save');
  await expect(item(page, ITEM_HIGH)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: `Mark as done: ${ITEM_HIGH.title}` })).not.toBeChecked();
  await expect(page.getByRole('tab', { name: /Done/ })).toContainText('0');
});

test('a competitor card starts collapsed and opens on everything found about it', async ({ page }) => {
  await stubWatch(page, { competitors: [LOCAL] });
  await open(page);

  const competitor = card(page, LOCAL);
  const toggle = competitor.getByRole('button', { name: 'Example Assembly Co.' });
  await expect(competitor.getByText('Local', { exact: true })).toBeVisible();
  await expect(competitor.getByText('New', { exact: true })).toBeVisible();
  await expect(competitor.getByText('Franklin, TN')).toBeVisible();
  await expect(competitor.getByText(LOCAL.summary as string)).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(competitor.getByText('Jordan Example')).toHaveCount(0);
  await expect(competitor.getByRole('link')).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const website = competitor.getByRole('link', { name: 'example.com', exact: true });
  await expect(website).toHaveAttribute('href', 'https://www.example.com/');
  await expect(website).toHaveAttribute('target', '_blank');
  await expect(website).toHaveAttribute('rel', /noopener/);
  await expect(competitor.getByText('Jordan Example')).toBeVisible();
  await expect(competitor.getByRole('link', { name: 'hello@example.com' })).toHaveAttribute(
    'href',
    'mailto:hello@example.com',
  );
  await expect(competitor.getByRole('link', { name: '(615) 555-0100' })).toHaveAttribute('href', 'tel:6155550100');

  const services = competitor.locator('section').filter({ has: page.getByRole('heading', { name: 'Services' }) });
  await expect(services.getByRole('listitem')).toHaveText(['Furniture assembly', 'TV mounting', 'Playset assembly']);
  await expect(competitor.getByText('$95 minimum per visit.')).toBeVisible();
  await expect(competitor.getByText('Online booking with a deposit.')).toBeVisible();
  await expect(competitor.getByText('A one-year workmanship guarantee.')).toBeVisible();
  await expect(competitor.getByText('4.9 stars from 120 Google reviews.')).toBeVisible();
  await expect(competitor.getByText('In business since 2019.')).toBeVisible();
  await expect(competitor.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
    'href',
    'https://facebook.com/exampleassembly',
  );
  await expect(competitor.getByText('Last checked October 12, 2026')).toBeVisible();

  // A second click closes it again.
  await toggle.click();
  await expect(competitor.getByText('Jordan Example')).toHaveCount(0);
});

test('details that were not found say so, and unsafe ones are never clickable', async ({ page }) => {
  await stubWatch(page, { competitors: [RETAILER, BAD_CONTACT, LOCAL] });
  await open(page);

  await expand(page, RETAILER);
  await expect(card(page, RETAILER).getByText('Not found')).toHaveCount(4);

  // Saved as a website and an email, but neither is one: shown as text or not at all, never as a link.
  await expand(page, BAD_CONTACT);
  const bad = card(page, BAD_CONTACT);
  await expect(bad.getByRole('link')).toHaveCount(0);
  await expect(bad.getByText('a@example.com,b@example.com')).toBeVisible();
  await expect(bad.getByText('call us')).toBeVisible();

  await expand(page, LOCAL);
  await expect(card(page, LOCAL).getByRole('link', { name: 'Not a web address' })).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
});

test('competitors can be narrowed by kind and by search', async ({ page }) => {
  await stubWatch(page, { competitors: [RETAILER, PLATFORM, LOCAL] });
  await open(page);

  // Local businesses first, then platforms, then retailers.
  await expect(page.getByRole('article').getByRole('heading', { level: 3 })).toHaveText([
    'Example Assembly Co.',
    'Taskrabbit',
    'Big Box Assembly Service',
  ]);
  const filters = page.getByRole('group', { name: 'Filter competitors' });
  await expect(filters.getByRole('button', { name: /All/ })).toContainText('3');
  await expect(filters.getByRole('button', { name: /Removed/ })).toHaveCount(0);

  await filters.getByRole('button', { name: /National platform/ }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(card(page, PLATFORM)).toBeVisible();

  await filters.getByRole('button', { name: /Out of area/ }).click();
  await expect(page.getByText('No competitors in this group.')).toBeVisible();

  await filters.getByRole('button', { name: /All/ }).click();
  await page.getByLabel('Search competitors').fill('franklin');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(card(page, LOCAL)).toBeVisible();
  await expect(filters.getByRole('button', { name: /All/ })).toContainText('1');

  await page.getByLabel('Search competitors').fill('nothing matches this');
  await expect(page.getByText('No competitors here match "nothing matches this".')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByRole('article')).toHaveCount(3);
});

test('a business can be marked as not a competitor, and put back', async ({ page }) => {
  const writes = await stubWatch(page, { competitors: [LOCAL, PLATFORM] });
  await open(page);
  await expand(page, PLATFORM);

  await card(page, PLATFORM).getByRole('button', { name: 'Not a competitor' }).click();
  await expect(card(page, PLATFORM)).toHaveCount(0);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ table: 'competitors', method: 'PATCH', id: 'competitor-2', organization: 'org-1' });
  // Only the removal is sent; nothing the weekly run wrote can be changed from here.
  expect(Object.keys(writes[0].body as object)).toEqual(['removed_at']);
  expect((writes[0].body as { removed_at: unknown }).removed_at).toEqual(expect.any(String));

  const filters = page.getByRole('group', { name: 'Filter competitors' });
  await expect(filters.getByRole('button', { name: /All/ })).toContainText('1');
  await filters.getByRole('button', { name: /Removed/ }).click();
  await expect(card(page, PLATFORM).getByText('Removed', { exact: true })).toBeVisible();

  await expand(page, PLATFORM);
  await card(page, PLATFORM).getByRole('button', { name: 'Put back' }).click();
  await expect(card(page, PLATFORM)).toHaveCount(0);
  expect(writes[1].body).toEqual({ removed_at: null });
  await filters.getByRole('button', { name: /All/ }).click();
  await expect(card(page, PLATFORM)).toBeVisible();
});

test('empty lists explain where their contents come from', async ({ page }) => {
  await stubWatch(page, {});
  await open(page);

  await expect(page.getByText(/Nothing to work on right now\. The weekly competitor watch adds new items/)).toBeVisible();
  await expect(page.getByText(/No competitors saved yet\. The weekly competitor watch adds them/)).toBeVisible();
  await expect(page.getByText(/Last checked/)).toHaveCount(0);
});

test('a weekly check that has missed a week is flagged', async ({ page }) => {
  await stubWatch(page, {
    items: [{ ...ITEM_MEDIUM, last_seen_on: '2026-09-28' }],
    competitors: [{ ...PLATFORM, last_verified_on: '2026-09-28' }],
  });
  await open(page);

  await expect(page.getByText(/Last checked September 28, 2026\. The weekly check has not run since/)).toBeVisible();
});

test('a failed load shows the error and nothing that reads like an empty list', async ({ page }) => {
  await stubWatch(page, { competitors: [LOCAL] });
  await page.route('**/rest/v1/competitor_action_items*', (route) =>
    route.fulfill({ status: 500, json: { message: 'boom' } }),
  );
  await open(page);

  await expect(page.getByRole('alert')).toContainText('Failed to load the checklist');
  // What is saved is unknown, so the page must not claim there is nothing,
  // and must not show half of itself as if it were the whole.
  await expect(page.getByText(/Nothing to work on right now/)).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByLabel('Search competitors')).toHaveCount(0);
});

test('only the selected organization\'s rows are listed', async ({ page }) => {
  // RLS lets an admin of two organizations, or a platform admin, read both.
  // Without a filter the other organization's competitors would be listed
  // here as if they were Boxed2Built's.
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/\/rest\/v1\/competitor/.test(request.url())) requests.push(request.url());
  });
  await stubWatch(page, {
    items: [ITEM_HIGH, { ...ITEM_MEDIUM, id: 'item-other', organization_id: 'org-2', title: 'Another business item' }],
    competitors: [LOCAL, { ...PLATFORM, id: 'competitor-other', organization_id: 'org-2', name: 'Another Business Rival' }],
  });
  await open(page);

  await expect(item(page, ITEM_HIGH)).toBeVisible();
  await expect(page.getByText('Another business item')).toHaveCount(0);
  await expect(page.getByText('Another Business Rival')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /To do/ })).toContainText('1');
  expect(requests.length).toBeGreaterThan(1);
  for (const url of requests) {
    expect(new URL(url).searchParams.get('organization_id')).toBe('eq.org-1');
  }
});

test('with no organization selected it asks for nothing and says why the page is empty', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/\/rest\/v1\/competitor/.test(request.url())) requests.push(request.url());
  });
  await stubWatch(page, { items: [ITEM_HIGH], competitors: [LOCAL] });
  await page.clock.setFixedTime(NOW);
  await page.goto('/tests/harness/competitors.html?org=none');

  await expect(page.getByRole('alert')).toContainText('No organization is selected');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  expect(requests).toEqual([]);
});
