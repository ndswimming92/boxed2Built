import { test, expect, type Page } from '@playwright/test';

/**
 * The Sales tab's filters: store chips, local or online, furniture type, and
 * the page link that carries them. The real page runs against stubbed REST
 * responses; the stub applies the same filters the database would, so what is
 * checked is which requests the page makes and what it does with the answers.
 */

type Row = Record<string, unknown>;

function sale(id: string, store: string | null, scope: string | null, types: string[], endsOn: string | null): Row {
  return {
    id,
    organization_id: 'org-1',
    title: `${store ?? 'Unlabelled'} sale ${id}`,
    summary: 'A sale.',
    source_name: 'Yahoo Shopping',
    source_url: `https://example.com/${id}`,
    topic: 'deals',
    source_published_on: '2026-10-06',
    ends_on: endsOn,
    store_name: store,
    store_slug: store ? store.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null,
    sale_scope: scope,
    furniture_types: types,
    status: 'published',
    published_at: `2026-10-0${id}T12:00:00Z`,
    created_at: '2026-10-06T11:00:00Z',
    updated_at: '2026-10-06T11:00:00Z',
  };
}

const SALES: Row[] = [
  sale('1', 'Wayfair', 'online', ['living_room', 'bedroom'], '2026-10-09'),
  sale('2', 'Bassett Home Furnishings', 'local', ['living_room'], '2026-10-11'),
  sale('3', 'Wayfair', 'online', ['outdoor'], '2026-10-20'),
  sale('4', 'IKEA', 'online', [], null),
  sale('5', null, null, [], null),
];

const NEWS: Row = {
  ...sale('6', null, null, [], null),
  topic: 'flat_pack',
  title: 'A flat pack story',
};

async function stub(page: Page, rows: Row[] = [...SALES, NEWS]) {
  const requests: URLSearchParams[] = [];

  await page.route('**/rest/v1/rpc/news_sale_filter_options*', (route) => {
    const groups = new Map<string, Row & { sale_count: number }>();
    for (const row of rows.filter((r) => r.topic === 'deals')) {
      const key = JSON.stringify([row.store_name, row.sale_scope, row.furniture_types]);
      const group = groups.get(key);
      if (group) group.sale_count += 1;
      else {
        groups.set(key, {
          store_name: row.store_name,
          store_slug: row.store_slug,
          sale_scope: row.sale_scope,
          furniture_types: row.furniture_types,
          sale_count: 1,
        });
      }
    }
    return route.fulfill({ json: [...groups.values()] });
  });

  await page.route('**/rest/v1/news_items*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params);
    let result = rows;
    const eq = (name: string) => params.get(name)?.replace(/^eq\./, '') ?? null;
    if (eq('topic')) result = result.filter((row) => row.topic === eq('topic'));
    if (eq('store_slug')) result = result.filter((row) => row.store_slug === eq('store_slug'));
    if (eq('sale_scope')) result = result.filter((row) => row.sale_scope === eq('sale_scope'));
    const contains = /^cs\.\{(.+)\}$/.exec(params.get('furniture_types') ?? '')?.[1];
    if (contains) result = result.filter((row) => (row.furniture_types as string[]).includes(contains));
    return route.fulfill({
      json: result,
      headers: { 'content-range': `0-${Math.max(result.length - 1, 0)}/${result.length}` },
    });
  });

  return requests;
}

const open = async (page: Page, search = '') => {
  await page.goto(`/tests/harness/news-public.html${search}`);
  await expect(page.getByRole('button', { name: 'Sales', exact: true })).toBeVisible();
};

const cards = (page: Page) => page.locator('[data-news-card] h2');

test('store chips list the stores with live sales, busiest first, with counts', async ({ page }) => {
  await stub(page);
  await open(page);
  await expect(cards(page)).toHaveCount(5);

  const stores = page.getByRole('group', { name: 'Store' });
  await expect(stores.getByRole('button')).toHaveText([/All stores\s*5/, /Wayfair\s*2/, /Bassett Home Furnishings\s*1/, /IKEA\s*1/]);
});

test('choosing a store narrows the list and puts the store in the page link', async ({ page }) => {
  const requests = await stub(page);
  await open(page);

  await page.getByRole('group', { name: 'Store' }).getByRole('button', { name: /Wayfair/ }).click();

  await expect(cards(page)).toHaveText(['Wayfair sale 1', 'Wayfair sale 3']);
  await expect(page).toHaveURL(/\?store=wayfair$/);
  expect(requests.at(-1)?.get('store_slug')).toBe('eq.wayfair');
  await expect(page.getByText('2 sales match your filters')).toBeVisible();
});

test('a shared page link opens already filtered, and the back button undoes a filter', async ({ page }) => {
  await stub(page);
  await open(page, '?store=wayfair&where=online&type=bedroom');

  await expect(cards(page)).toHaveText(['Wayfair sale 1']);
  await expect(page.getByRole('button', { name: /Wayfair/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^Online/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Furniture type')).toHaveValue('bedroom');

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(cards(page)).toHaveCount(5);
  await expect(page).not.toHaveURL(/store=/);

  await page.goBack();
  await expect(cards(page)).toHaveText(['Wayfair sale 1']);
  await expect(page).toHaveURL(/store=wayfair&where=online&type=bedroom/);
});

test('local and online narrow the list, and the counts follow the other filters', async ({ page }) => {
  await stub(page);
  await open(page);

  await page.getByRole('button', { name: /^Local stores/ }).click();
  await expect(cards(page)).toHaveText(['Bassett Home Furnishings sale 2']);
  // With Local chosen, only stores with local sales are offered.
  await expect(page.getByRole('group', { name: 'Store' }).getByRole('button')).toHaveText([
    /All stores\s*1/,
    /Bassett Home Furnishings\s*1/,
  ]);
});

test('a filter with no matches says so and offers a way out', async ({ page }) => {
  await stub(page);
  await open(page, '?store=ikea&type=bedroom');

  await expect(page.getByText('No sales match those filters.')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(cards(page)).toHaveCount(5);
});

test('the filters belong to Sales: other tabs have none and a stray link is ignored', async ({ page }) => {
  const requests = await stub(page);
  await open(page, '?tab=all&store=wayfair');

  await expect(page.getByRole('group', { name: 'Store' })).toHaveCount(0);
  await expect(cards(page)).toHaveCount(6);
  expect(requests.every((params) => !params.has('store_slug'))).toBe(true);
});

test('a sale shows its store and whether it is local or online', async ({ page }) => {
  await stub(page);
  await open(page, '?store=bassett-home-furnishings');

  const card = page.locator('[data-news-card]').first();
  await expect(card).toContainText('Bassett Home Furnishings');
  await expect(card).toContainText('Local stores');
});

test('with no sales at all the page still falls back to All news', async ({ page }) => {
  await stub(page, [NEWS]);
  await page.goto('/tests/harness/news-public.html');
  await expect(cards(page)).toHaveText(['A flat pack story']);
});
