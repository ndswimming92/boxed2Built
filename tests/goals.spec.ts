import { test, expect, type Page } from '@playwright/test';

/**
 * Business Goals used to be one long list of large cards where finished goals
 * sat above the overdue one, every goal carried a number ("0 Bought / 1
 * Bought"), and any change meant opening a popup form.
 *
 * These specs mount the shipped page against a stubbed Supabase and pin down
 * what the redesign is for: what is overdue comes first, finished goals leave
 * the list but stay findable, and a goal is edited where it sits.
 */

type Row = Record<string, unknown>;

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDay(d);
};

function goal(id: string, title: string, overrides: Row = {}): Row {
  return {
    id,
    business_id: 'biz-1',
    title,
    description: '',
    category: 'operational',
    priority: 'medium',
    status: 'in_progress',
    target_value: 1,
    current_value: 0,
    unit_type: 'custom',
    unit_label: null,
    start_date: inDays(-60),
    due_date: null,
    completion_date: null,
    progress_percentage: 0,
    is_archived: false,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function seed(): Row[] {
  return [
    goal('g-done', 'Build a client sign-off system', {
      status: 'completed',
      current_value: 1,
      unit_label: 'Client Sign Off System',
      completion_date: inDays(-40),
      is_archived: true,
    }),
    goal('g-insurance', 'Get General Liability Insurance', { priority: 'high', unit_label: 'Bought', due_date: inDays(-12) }),
    goal('g-revenue', 'Earn $750 from referrals', {
      category: 'financial',
      priority: 'high',
      unit_type: 'revenue',
      target_value: 750,
      current_value: 250,
      due_date: inDays(45),
    }),
    goal('g-reviews', 'Ask five customers for reviews', { priority: 'low', due_date: inDays(5) }),
    goal('g-someday', 'Design a yard sign'),
  ];
}

interface Mounted {
  goals: Row[];
  patches: Row[];
}

async function mountGoals(page: Page, goals: Row[] = seed()): Promise<Mounted> {
  const mounted: Mounted = { goals, patches: [] };

  await page.route('**/rest/v1/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/rest/v1/')[1]?.split('/')[0] ?? '';
    const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');

    if (table === 'business_info') return route.fulfill({ json: { id: 'biz-1' } });
    if (table !== 'business_goals') return route.fulfill({ status: 201, json: wantsObject ? {} : [] });

    const id = url.searchParams.get('id')?.replace('eq.', '');
    if (request.method() === 'POST') {
      const created = goal(`g-new-${mounted.goals.length}`, '', { status: 'not_started', ...request.postDataJSON() });
      mounted.goals.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Row;
      mounted.patches.push({ id, ...body });
      const row = mounted.goals.find((g) => g.id === id)!;
      Object.assign(row, body);
      return route.fulfill({ json: wantsObject ? row : [row] });
    }
    const rows = id ? mounted.goals.filter((g) => g.id === id) : mounted.goals.filter((g) => g.is_active);
    return route.fulfill({ json: wantsObject ? rows[0] ?? null : rows });
  });

  await page.goto('/tests/harness/goals.html');
  await expect(page.getByRole('heading', { level: 1, name: 'Business Goals' })).toBeVisible();
  return mounted;
}

const group = (page: Page, name: string) => page.getByRole('region', { name });
const openGoal = (page: Page, title: string) => page.locator('button[aria-expanded]').filter({ hasText: title }).click();

test('active goals are grouped by urgency, with the overdue one on top', async ({ page }) => {
  await mountGoals(page);

  await expect(page.getByText('4 in progress · 1 overdue')).toBeVisible();
  await expect(page.getByRole('region')).toHaveCount(4);
  await expect(page.getByRole('region').first()).toHaveAccessibleName('Overdue');

  await expect(group(page, 'Overdue')).toContainText('Get General Liability Insurance');
  await expect(group(page, 'Overdue')).toContainText('12 days overdue');
  await expect(group(page, 'Due in the next 2 weeks')).toContainText('Ask five customers for reviews');
  await expect(group(page, 'Later')).toContainText('Earn $750 from referrals');
  await expect(group(page, 'No due date')).toContainText('Design a yard sign');
});

test('yes/no goals show no numbers; number goals show a progress bar', async ({ page }) => {
  await mountGoals(page);

  await expect(group(page, 'Overdue')).not.toContainText('Bought');
  await expect(group(page, 'Overdue').getByRole('progressbar')).toHaveCount(0);
  await expect(group(page, 'Later')).toContainText('$250 of $750 · 33%');
  await expect(group(page, 'Later').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
});

test('completed goals are off the active list and found under Completed', async ({ page }) => {
  await mountGoals(page);

  await expect(page.getByText('Build a client sign-off system')).toHaveCount(0);
  await page.getByRole('tab', { name: /Completed/ }).click();
  await expect(page.getByText('Build a client sign-off system')).toBeVisible();
  await expect(page.getByText(/^Completed \w+ \d+/)).toBeVisible();
});

test('searching from Active points to matches sitting in Completed', async ({ page }) => {
  await mountGoals(page);

  await page.getByRole('searchbox', { name: 'Search goals' }).fill('sign-off');
  await expect(page.getByText('No active goals match')).toBeVisible();
  await page.getByRole('button', { name: '1 more match in Completed' }).click();
  await expect(page.getByText('Build a client sign-off system')).toBeVisible();
});

test('completing a goal moves it to Completed, and Undo brings it back', async ({ page }) => {
  const mounted = await mountGoals(page);

  await page.getByRole('button', { name: 'Mark "Get General Liability Insurance" complete' }).click();
  await expect(group(page, 'Overdue')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Completed/ })).toContainText('2');
  expect(mounted.patches.at(-1)).toMatchObject({ id: 'g-insurance', status: 'completed', current_value: 1 });

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(group(page, 'Overdue')).toContainText('Get General Liability Insurance');
  expect(mounted.patches.at(-1)).toMatchObject({ id: 'g-insurance', status: 'not_started', current_value: 0, completion_date: null });
});

test('a completed goal can be reopened from the Completed tab', async ({ page }) => {
  const mounted = await mountGoals(page);

  await page.getByRole('tab', { name: /Completed/ }).click();
  await page.getByRole('button', { name: 'Reopen "Build a client sign-off system"' }).click();
  await expect(page.getByText('Nothing completed yet')).toBeVisible();
  expect(mounted.patches.at(-1)).toMatchObject({ id: 'g-done', status: 'not_started', is_archived: false });

  await page.getByRole('tab', { name: /Active/ }).click();
  await expect(group(page, 'No due date')).toContainText('Build a client sign-off system');
});

test('a goal is edited in place and each change saves on its own', async ({ page }) => {
  const mounted = await mountGoals(page);

  await openGoal(page, 'Design a yard sign');
  await expect(page.getByText('Changes save automatically')).toBeVisible();

  const title = page.getByLabel('Goal', { exact: true });
  await title.fill('Design and order a yard sign');
  await title.press('Enter');
  await expect(page.getByText('All changes saved')).toBeVisible();
  expect(mounted.patches.at(-1)).toMatchObject({ id: 'g-someday', title: 'Design and order a yard sign' });

  await page.getByRole('radio', { name: 'High' }).click();
  await expect(page.getByRole('radio', { name: 'High' })).toBeChecked();
  await expect.poll(() => mounted.patches.at(-1)).toMatchObject({ priority: 'high' });

  // Giving it a due date moves it out of "No due date" without closing the editor.
  await page.getByRole('textbox', { name: 'Due date' }).fill(isoDay(new Date(Date.now() + 3 * 86_400_000)));
  await expect(group(page, 'Due in the next 2 weeks')).toContainText('Design and order a yard sign');
  await expect(page.getByLabel('Goal', { exact: true })).toBeVisible();
});

test('progress toward a number is updated in the same place', async ({ page }) => {
  const mounted = await mountGoals(page);

  await openGoal(page, 'Earn $750 from referrals');
  await page.getByLabel('So far').fill('600');
  await page.getByLabel('So far').press('Enter');
  await expect(group(page, 'Later')).toContainText('$600 of $750 · 80%');
  await expect.poll(() => mounted.patches.at(-1)).toMatchObject({ id: 'g-revenue', current_value: 600, target_value: 750 });
});

test('a progress edit and Mark complete in one motion still ends completed', async ({ page }) => {
  const goals = seed();
  goals.find((g) => g.id === 'g-revenue')!.status = 'not_started';
  goals.find((g) => g.id === 'g-revenue')!.current_value = 0;
  const mounted = await mountGoals(page, goals);

  await openGoal(page, 'Earn $750 from referrals');
  await page.getByLabel('So far').fill('750');
  // Clicking away from the field saves it (moving the goal to in progress) and completes it at once.
  await page.getByRole('button', { name: /mark complete$/i }).last().click();

  await expect(page.getByRole('tab', { name: /Completed/ })).toContainText('2');
  await expect.poll(() => mounted.patches.length).toBe(2);
  expect(mounted.patches[0]).toMatchObject({ id: 'g-revenue', current_value: 750, status: 'in_progress' });
  expect(mounted.patches[1]).toMatchObject({ id: 'g-revenue', status: 'completed' });
  expect(mounted.goals.find((g) => g.id === 'g-revenue')).toMatchObject({ status: 'completed', current_value: 750 });
});

test('a new goal needs only a title and opens ready for details', async ({ page }) => {
  const mounted = await mountGoals(page);

  await page.getByLabel('New goal').fill('Renew business license');
  await page.getByLabel('New goal').press('Enter');

  await expect(group(page, 'No due date')).toContainText('Renew business license');
  await expect(page.getByLabel('Goal', { exact: true })).toHaveValue('Renew business license');
  await expect(page.getByRole('radio', { name: 'Done / not done' })).toBeChecked();
  expect(mounted.goals.at(-1)).toMatchObject({ title: 'Renew business license', target_value: 1 });
});
