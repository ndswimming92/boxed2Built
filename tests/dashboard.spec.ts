import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * The admin dashboard is the first screen of the day. It used to be twelve
 * equal-weight tiles, read once on load: the two inquiries waiting on a reply
 * sat at the same size as the count of service areas, and a failed load showed
 * a wall of zeros that looked like a business with no customers.
 *
 * These specs mount the shipped page against stubbed Supabase responses and
 * pin down what the redesign is for: what needs attention comes first, the
 * headline numbers add up, the numbers stay current without a reload, and a
 * failed refresh keeps the last good figures on screen.
 */

type Row = Record<string, unknown>;

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * DAY));
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

function completedJob(id: string, completed: string, price: number, hours: number): Row {
  return {
    id,
    business_id: 'biz-1',
    client_name: `Client ${id}`,
    job_type: 'Furniture Assembly',
    job_status: 'completed',
    date_scheduled: completed,
    date_completed: completed,
    final_price: price,
    hours_worked: hours,
    is_active: true,
    is_test: false,
  };
}

function inquiry(id: string, name: string, overrides: Row = {}): Row {
  return {
    id,
    business_id: 'biz-1',
    client_name: name,
    client_email: `${id}@example.com`,
    furniture_type: 'Desk',
    pieces: 1,
    estimated_price: '$185',
    submission_date: hoursAgo(6),
    status: 'pending',
    viewed: true,
    first_responded_at: null,
    is_test: false,
    is_active: true,
    ...overrides,
  };
}

interface Db {
  [table: string]: Row[];
}

function seed(): Db {
  return {
    business_info: [{ id: 'biz-1', name: 'Boxed2Built', is_active: true }],
    jobs: [
      completedJob('j1', isoDay(new Date()), 300, 3),
      completedJob('j2', daysAgo(70), 450, 4.5),
      completedJob('j3', daysAgo(130), 250, 2),
      { ...completedJob('j4', daysAgo(1), 0, 0), job_status: 'scheduled', date_completed: null, final_price: null, hours_worked: null },
    ],
    services: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    service_areas: [{ id: 'a1' }, { id: 'a2' }],
    customer_reviews: [{ rating_value: 5 }, { rating_value: 4 }],
    form_inquiries: [
      inquiry('i1', 'Dana Ruiz'),
      inquiry('i2', 'Marcus Webb'),
      inquiry('i3', 'Tom Nguyen', {
        status: 'converted_to_job',
        submission_date: hoursAgo(30),
        first_responded_at: hoursAgo(29.5),
      }),
      inquiry('i4', 'Casey Lind', { status: 'archived' }),
    ],
    job_completion_reminders: [
      {
        id: 'r1',
        scheduled_date: daysAgo(3),
        reminder_type: 'follow_up_call',
        admin_notes: 'Ask about the second bookcase',
        status: 'pending',
        job: { client_name: 'Hill Angel', client_phone: '(615) 555-0101', job_type: 'Furniture Assembly' },
      },
    ],
    business_goals: [],
  };
}

function fulfillRows(route: Route, rows: Row[]) {
  const request = route.request();
  const headers = { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' };
  if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers });
  const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
  if (wantsObject) return route.fulfill({ status: 200, headers, json: rows[0] ?? null });
  return route.fulfill({ status: 200, headers, json: rows });
}

interface Mounted {
  db: Db;
  /** Tables whose reads should fail from now on. */
  failing: Set<string>;
}

async function mountDashboard(page: Page, db: Db = seed()): Promise<Mounted> {
  const mounted: Mounted = { db, failing: new Set() };

  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/rest/v1/')[1]?.split('/')[0] ?? '';
    if (mounted.failing.has(table)) {
      return route.fulfill({ status: 500, json: { message: 'boom', code: '500', details: null, hint: null } });
    }
    let rows = mounted.db[table] ?? [];
    const status = url.searchParams.get('status');
    if (status?.startsWith('eq.')) rows = rows.filter((r) => r.status === status.slice(3));
    if (status?.startsWith('neq.')) rows = rows.filter((r) => r.status !== status.slice(4));
    if (url.searchParams.get('first_responded_at') === 'not.is.null') {
      rows = rows.filter((r) => r.first_responded_at != null);
    }
    return fulfillRows(route, rows);
  });
  await page.route('**/functions/v1/list-scheduled-emails', (route) => route.fulfill({ json: { emails: [] } }));

  await page.goto('/tests/harness/dashboard.html');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back!' })).toBeVisible();
  await expect(page.getByText('Total Revenue')).toBeVisible();
  return mounted;
}

const kpi = (page: Page, label: string) => page.getByRole('link').filter({ hasText: label }).first();

test('what needs attention is listed first and links to where it gets handled', async ({ page }) => {
  await mountDashboard(page);

  const attention = page.getByRole('region', { name: 'Needs attention' });
  await expect(attention.getByRole('link', { name: /2 inquiries pending/ })).toHaveAttribute('href', '/admin/inquiries');
  const reminders = attention.getByRole('link', { name: /1 follow-up reminder due/ });
  await expect(reminders).toContainText('1 overdue');
  await expect(reminders).toHaveAttribute('href', '/admin/reminders');
  // Nothing outstanding for goals or emails, so those do not appear as zeros.
  await expect(attention.getByRole('link')).toHaveCount(2);
});

test('with nothing outstanding the strip collapses to a single all-clear line', async ({ page }) => {
  const db = seed();
  db.form_inquiries = db.form_inquiries.filter((i) => i.status !== 'pending');
  db.job_completion_reminders = [];
  await mountDashboard(page, db);

  await expect(page.getByText(/All caught up/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Needs attention' })).toHaveCount(0);
});

test('headline numbers come from completed jobs, with this month called out', async ({ page }) => {
  await mountDashboard(page);

  await expect(kpi(page, 'Total Revenue')).toContainText('$1,000');
  await expect(kpi(page, 'Total Revenue')).toContainText('$300 this month');
  // Four jobs on the books; the scheduled one counts as a job but earns nothing yet.
  await expect(kpi(page, 'Total Jobs')).toContainText('4');
  await expect(kpi(page, 'Total Jobs')).toContainText('1 completed this month');
  await expect(kpi(page, 'Hours Given Back to Customers')).toContainText('9.5 hrs');
  await expect(kpi(page, 'Avg Rating')).toContainText('4.5/5');
  await expect(kpi(page, 'Avg Rating')).toContainText('From 2 reviews');
});

test('the inquiry pipeline shows conversion, the status split and reply speed', async ({ page }) => {
  await mountDashboard(page);

  const pipeline = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Inquiry pipeline' }) });
  await expect(pipeline).toContainText('25%');
  await expect(pipeline).toContainText('of inquiries became jobs');
  await expect(pipeline.getByRole('img')).toHaveAttribute('aria-label', '1 became jobs, 2 pending, 1 archived');
  // One inquiry answered half an hour after it arrived.
  await expect(pipeline).toContainText('30m');
  await expect(pipeline).toContainText('Fast');
});

test('revenue and jobs are charted by month', async ({ page }) => {
  await mountDashboard(page);

  const trends = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Last 12 months' }) });
  await expect(trends.locator('figure')).toHaveCount(2);
  await expect(trends.locator('figure').first()).toContainText('Revenue');
  await expect(trends.locator('figure').first()).toContainText('$1,000');
  await expect(trends.locator('figure').nth(1)).toContainText('Jobs completed');
  await expect(trends.locator('.recharts-bar-rectangle').first()).toBeVisible();
});

test('refreshing picks up new data without a page reload', async ({ page }) => {
  const mounted = await mountDashboard(page);
  const attention = page.getByRole('region', { name: 'Needs attention' });
  await expect(attention.getByRole('link', { name: /2 inquiries pending/ })).toBeVisible();

  mounted.db.form_inquiries.push(inquiry('i5', 'Priya Shah'));
  await page.getByRole('button', { name: 'Refresh dashboard' }).click();

  await expect(attention.getByRole('link', { name: /3 inquiries pending/ })).toBeVisible();
  await expect(page.getByText('Priya Shah')).toBeVisible();
});

test('a failed refresh keeps the last good numbers and offers a retry', async ({ page }) => {
  const mounted = await mountDashboard(page);
  await expect(kpi(page, 'Avg Rating')).toContainText('4.5/5');

  mounted.failing.add('customer_reviews');
  await page.getByRole('button', { name: 'Refresh dashboard' }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('may be out of date');
  await expect(kpi(page, 'Avg Rating')).toContainText('4.5/5');

  mounted.failing.clear();
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(alert).toHaveCount(0);
});
