import { test, expect, type Page } from '@playwright/test';

/**
 * How the public /news page behaves when the database is busy or down: it asks
 * the cached route first, falls back to Supabase if that route is not there,
 * does not pile onto a database that is failing, and shows the visitor's last
 * good list rather than an error.
 */

const sale = (id: string, title: string) => ({
  id,
  organization_id: 'org-1',
  title,
  summary: 'A sale.',
  source_name: 'Example Store',
  source_url: `https://example.com/${id}`,
  topic: 'deals',
  source_published_on: '2026-10-06',
  ends_on: null,
  store_name: 'Example Store',
  store_slug: 'example-store',
  sale_scope: 'online',
  furniture_types: [],
  status: 'published',
  published_at: `2026-10-0${id}T12:00:00Z`,
  created_at: '2026-10-06T11:00:00Z',
  updated_at: '2026-10-06T11:00:00Z',
});

const SALES = [sale('1', 'Sofa sale'), sale('2', 'Bed sale')];
const cards = (page: Page) => page.locator('[data-news-card] h2');
const open = (page: Page) => page.goto('/tests/harness/news-public.html');

/** Answers feed requests from either route, recording which route was used. */
async function stubFeed(page: Page, answer: (route: 'cache' | 'direct') => { status: number } | null) {
  const hits: Array<'cache' | 'direct'> = [];
  await page.route('**/rest/v1/rpc/news_sale_filter_options*', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/news_items*', (route) => {
    const via = route.request().url().includes('/api/news-cache/') ? 'cache' : 'direct';
    hits.push(via);
    const failure = answer(via);
    if (failure) return route.fulfill({ status: failure.status, json: { message: 'no' } });
    return route.fulfill({
      json: SALES,
      headers: { 'content-range': `0-1/${SALES.length}` },
    });
  });
  return hits;
}

test('the sales come through the cached route, and Supabase is not asked directly', async ({ page }) => {
  const hits = await stubFeed(page, () => null);
  await open(page);
  await expect(cards(page)).toHaveText(['Sofa sale', 'Bed sale']);
  expect(hits).toEqual(['cache']);
});

test('if the cached route is not there the page reads from Supabase instead', async ({ page }) => {
  const hits = await stubFeed(page, (via) => (via === 'cache' ? { status: 404 } : null));
  await open(page);
  await expect(cards(page)).toHaveText(['Sofa sale', 'Bed sale']);
  expect(hits).toEqual(['cache', 'direct']);
});

test('when the cached route says the database is down, the page does not also hit it directly', async ({ page }) => {
  const hits = await stubFeed(page, () => ({ status: 503 }));
  await open(page);
  await expect(page.getByText('The news feed could not be loaded. Please try again.')).toBeVisible({ timeout: 20_000 });
  expect(hits.length).toBeGreaterThan(1); // it retried...
  expect(hits.every((via) => via === 'cache')).toBe(true); // ...but only through the cache
});

test('a brief failure is retried and the visitor never sees an error', async ({ page }) => {
  let calls = 0;
  const hits = await stubFeed(page, () => (++calls <= 2 ? { status: 500 } : null));
  await open(page);
  await expect(cards(page)).toHaveText(['Sofa sale', 'Bed sale']);
  await expect(page.getByText('could not be loaded')).toHaveCount(0);
  expect(hits.length).toBe(3);
});

test('after a failed refresh the visitor sees the list they had last time, with a notice', async ({ page }) => {
  let down = false;
  await stubFeed(page, () => (down ? { status: 500 } : null));
  await open(page);
  await expect(cards(page)).toHaveText(['Sofa sale', 'Bed sale']);
  await expect(page.getByRole('status').filter({ hasText: 'one you saw last' })).toHaveCount(0);

  down = true;
  await open(page);
  await expect(cards(page)).toHaveText(['Sofa sale', 'Bed sale'], { timeout: 20_000 });
  await expect(page.getByText('so this is the one you saw last')).toBeVisible();
  await expect(page.getByText('The news feed could not be loaded')).toHaveCount(0);

  down = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('so this is the one you saw last')).toHaveCount(0);
  await expect(cards(page)).toHaveText(['Sofa sale', 'Bed sale']);
});
