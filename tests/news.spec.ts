import { test, expect, type Page } from '@playwright/test';

/**
 * The News Feed screen is the only thing standing between an automated news
 * check and the public site. These cover the part that has to be right: a
 * draft stays a draft until someone approves it, approving writes exactly
 * `status = 'published'`, and an item that should not go live cannot.
 */

type Row = Record<string, unknown>;

const base = {
  organization_id: 'org-1',
  topic: 'flat_pack',
  source_published_on: '2026-10-05',
  published_at: null,
  created_at: '2026-10-06T11:47:00Z',
  updated_at: '2026-10-06T11:47:00Z',
};

const DRAFT: Row = {
  ...base,
  id: 'news-1',
  title: 'Retailer adds assembly at checkout',
  summary: 'Customers in more areas can now add assembly when they order.',
  source_name: 'Example Newsroom',
  source_url: 'https://example.com/assembly',
  topic: 'furniture_assembly',
  status: 'draft',
};

const PUBLISHED: Row = {
  ...base,
  id: 'news-2',
  title: 'Dresser recalled over tip-over risk',
  summary: 'Owners are told to anchor the dresser or return it for a refund.',
  source_name: 'Example Regulator',
  source_url: 'https://example.com/recall',
  status: 'published',
  published_at: '2026-10-06T12:00:00Z',
};

const BAD_LINK: Row = {
  ...base,
  id: 'news-3',
  title: 'A story with a link that is not a web address',
  summary: 'This one should never be publishable.',
  source_name: 'Unknown',
  source_url: 'javascript:alert(1)',
  status: 'draft',
};

/**
 * One news table. Reads return it; a PATCH applies the change to the matching
 * row and answers with that row, the way PostgREST does for `.select().single()`.
 * Every write is recorded so a test can assert on exactly what was sent.
 */
async function stubNews(page: Page, rows: Row[]) {
  const table = rows.map((row) => ({ ...row }));
  const writes: Array<{ method: string; id: string | null; body: Row }> = [];

  await page.route('**/rest/v1/news_items*', async (route) => {
    const request = route.request();
    const method = request.method();
    const id = /id=eq\.([\w-]+)/.exec(request.url())?.[1] ?? null;

    if (method === 'GET' || method === 'HEAD') {
      return route.fulfill({ json: table });
    }

    const body = (request.postDataJSON() ?? {}) as Row;
    writes.push({ method, id, body });
    const row = table.find((candidate) => candidate.id === id);

    if (method === 'DELETE') {
      if (row) table.splice(table.indexOf(row), 1);
      return route.fulfill({ status: 204, body: '' });
    }

    if (!row) return route.fulfill({ status: 404, json: { message: 'not found' } });
    Object.assign(row, body);
    return route.fulfill({ json: row });
  });

  return writes;
}

async function open(page: Page) {
  await page.goto('/tests/harness/news.html');
  await expect(page.getByRole('heading', { name: 'News Feed' })).toBeVisible();
}

test('drafts are what the page opens on, and published items are kept apart', async ({ page }) => {
  await stubNews(page, [DRAFT, PUBLISHED]);
  await open(page);

  await expect(page.getByRole('tab', { name: /Drafts/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: DRAFT.title as string })).toBeVisible();
  await expect(page.getByRole('heading', { name: PUBLISHED.title as string })).toHaveCount(0);

  await page.getByRole('tab', { name: /Published/ }).click();
  await expect(page.getByRole('heading', { name: PUBLISHED.title as string })).toBeVisible();
  await expect(page.getByRole('heading', { name: DRAFT.title as string })).toHaveCount(0);
});

test('approving a draft publishes it and nothing else', async ({ page }) => {
  const writes = await stubNews(page, [DRAFT, PUBLISHED]);
  await open(page);

  await page.getByRole('button', { name: 'Approve' }).click();

  await expect(page.getByText('Published to the News page.')).toBeVisible();
  expect(writes).toEqual([{ method: 'PATCH', id: 'news-1', body: { status: 'published' } }]);

  // It leaves the draft queue and joins the published list.
  await expect(page.getByRole('heading', { name: DRAFT.title as string })).toHaveCount(0);
  await page.getByRole('tab', { name: /Published/ }).click();
  await expect(page.getByRole('heading', { name: DRAFT.title as string })).toBeVisible();
});

test('rejecting a draft keeps the row so the same story is not saved again', async ({ page }) => {
  const writes = await stubNews(page, [DRAFT]);
  await open(page);

  await page.getByRole('button', { name: 'Reject' }).click();

  await expect(page.getByText('Item rejected.')).toBeVisible();
  // A status change, not a delete: the unique source link is what stops the
  // daily check from bringing the story back tomorrow.
  expect(writes).toEqual([{ method: 'PATCH', id: 'news-1', body: { status: 'rejected' } }]);

  await page.getByRole('tab', { name: /Rejected/ }).click();
  await expect(page.getByRole('heading', { name: DRAFT.title as string })).toBeVisible();
});

test('an edit saves the trimmed text without changing the status', async ({ page }) => {
  const writes = await stubNews(page, [DRAFT]);
  await open(page);

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Title').fill('  Assembly can now be added at checkout  ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Changes saved.')).toBeVisible();
  expect(writes).toEqual([
    {
      method: 'PATCH',
      id: 'news-1',
      body: {
        title: 'Assembly can now be added at checkout',
        summary: DRAFT.summary,
        topic: 'furniture_assembly',
      },
    },
  ]);
  // Still a draft: editing is not approving.
  await expect(page.getByRole('heading', { name: 'Assembly can now be added at checkout' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
});

test('unpublishing takes a live item back to drafts', async ({ page }) => {
  const writes = await stubNews(page, [PUBLISHED]);
  await open(page);

  await page.getByRole('tab', { name: /Published/ }).click();
  await page.getByRole('button', { name: 'Unpublish' }).click();

  await expect(page.getByText('Removed from the News page and moved back to drafts.')).toBeVisible();
  expect(writes).toEqual([{ method: 'PATCH', id: 'news-2', body: { status: 'draft' } }]);
});

test('an item whose source is not a web link cannot be approved', async ({ page }) => {
  const writes = await stubNews(page, [BAD_LINK]);
  await open(page);

  await expect(page.getByText(/Source link is not a valid web address/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toBeDisabled();
  // And the bad value is never rendered as something clickable.
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  expect(writes).toEqual([]);
});
