import { expect, type Page, type Request, type Route } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

/**
 * What the job card specs stand on: fixtures for a job and for each thing the
 * edge functions answer with, and a small in-memory stand-in for Supabase.
 *
 * The stand-in is not a mock of any one call. It holds tables of rows, answers
 * PostgREST-shaped reads with the `eq.` / `is.null` / `in.` filters the app
 * uses, and applies writes to the rows — so a card action is followed by a
 * refetch that really reflects it, and a spec can assert on what was written
 * rather than on what a stub was told to say.
 *
 * Not a spec itself: playwright only runs *.spec.ts.
 */

export type Row = Record<string, unknown>;

/** A 1x1 PNG, standing in for the Mapbox route image the edge function returns. */
export const MAP_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export const FUNCTION_NAMES = {
  travel: 'job-travel-estimate',
  reminder: 'send-customer-job-reminders',
  followup: 'send-followup-email',
  schedule: 'send-job-schedule-email',
} as const;

export type FunctionKey = keyof typeof FUNCTION_NAMES;

export function job(overrides: Row = {}): Row {
  return {
    id: 'job-1',
    business_id: 'biz-1',
    client_id: 'client-1',
    client_name: 'Kurt Zollner',
    client_phone: '(423) 368-3950',
    client_email: 'kjzollner21@yahoo.com',
    client_address: '2014 Beamon Drive Franklin, TN 37064',
    service_address: null,
    client_type: 'residential',
    job_type: 'Furniture Assembly',
    job_description: null,
    location_city: 'Franklin',
    job_status: 'completed',
    date_quoted: '2026-09-11',
    date_scheduled: '2026-09-26',
    date_completed: '2026-09-26',
    hours_worked: 4.5,
    quoted_price: 300,
    final_price: 300,
    materials_cost: 45.5,
    has_signature: true,
    is_free: false,
    is_active: true,
    repeat_client: false,
    created_at: '2026-09-11T12:00:00Z',
    updated_at: '2026-09-26T12:00:00Z',
    ...overrides,
  };
}

/** A job that is booked but not done: the state the workflow buttons act on. */
export function scheduledJob(overrides: Row = {}): Row {
  return job({
    job_status: 'scheduled',
    date_completed: null,
    has_signature: false,
    hours_worked: null,
    final_price: null,
    ...overrides,
  });
}

export function invoice(overrides: Row = {}): Row {
  return {
    id: 'inv-1',
    business_id: 'biz-1',
    job_id: 'job-1',
    invoice_number: 'INV-1001',
    invoice_type: 'invoice',
    status: 'sent',
    invoice_date: '2026-09-26',
    due_date: '2026-10-10',
    client_name: 'Kurt Zollner',
    client_email: 'kjzollner21@yahoo.com',
    total_amount: 300,
    amount_due: 300,
    is_active: true,
    created_at: '2026-09-26T12:00:00Z',
    ...overrides,
  };
}

export function travelOk(overrides: Row = {}): Row {
  return {
    status: 'ok',
    originAddress: '10 Home Base Ln, Spring Hill, TN',
    destinationAddress: '2014 Beamon Drive Franklin, TN 37064',
    durationSeconds: 24 * 60,
    distanceMeters: 12.8 * 1609.344,
    departureBufferMinutes: 10,
    leaveBy: {
      time: '10:56',
      daysEarlier: 0,
      driveMinutes: 24,
      bufferMinutes: 10,
      leadMinutes: 34,
      label: '10:56 AM (24 min drive + 10 min buffer)',
    },
    mapImage: MAP_PNG,
    cached: false,
    refreshedAt: '2026-09-25T12:00:00Z',
    ...overrides,
  };
}

export function reminderPreview(overrides: Row = {}): Row {
  return {
    subject: 'Reminder: your appointment tomorrow',
    html: '<p>See you tomorrow at 11 AM.</p>',
    text: 'See you tomorrow at 11 AM.',
    recipient: 'kjzollner21@yahoo.com',
    status: 'scheduled',
    reason: null,
    // 5:00 PM on the business's clock (CDT, UTC-5).
    sendAt: '2026-09-25T22:00:00Z',
    sentAt: null,
    timeZone: 'America/Chicago',
    ...overrides,
  };
}

export function followupPreview(overrides: Row = {}): Row {
  return {
    subject: 'Thanks, Kurt — how did we do?',
    html: '<p>Leave us a Google review.</p>',
    text: 'Leave us a Google review.',
    recipient: 'kjzollner21@yahoo.com',
    status: 'scheduled',
    reason: null,
    sendAt: '2026-09-26T22:00:00Z',
    sentAt: null,
    timeZone: 'America/Chicago',
    ...overrides,
  };
}

export interface Call {
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface Write {
  table: string;
  method: string;
  url: string;
  body: Row | Row[] | null;
}

type Answer = { status?: number; json: unknown };

export interface Stubs {
  jobs?: Row[];
  invoices?: Row[];
  contractors?: Row[];
  jobContractors?: Row[];
  /** Any other table, by name. Tables nobody names are empty. */
  tables?: Record<string, Row[]>;
  /** Per-call answers; a function returns what the edge function would. */
  travel?: (call: Call) => Answer;
  reminder?: (call: Call) => Answer;
  followup?: (call: Call) => Answer;
  schedule?: (call: Call) => Answer;
  /** Make a write fail the way the database would. Returning nothing lets it through. */
  rejectWrite?: (write: Write) => Answer | undefined;
  /** Make a read of one table fail. Returning nothing lets it through. */
  rejectRead?: (table: string) => Answer | undefined;
}

export interface Mounted {
  calls: Record<FunctionKey, Call[]>;
  /** Every insert, update and delete the page made, in order. */
  writes: Write[];
  /** The tables as they stand now, after any writes. */
  db: Record<string, Row[]>;
  deletes: string[];
}

export function readCall(request: Request): Call {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(request.postData() || '{}');
  } catch {
    // an unreadable body is recorded as empty
  }
  return { headers: request.headers(), body };
}

/** The `eq.` / `neq.` / `is.` / `in.` filters PostgREST puts in the query string. */
function applyFilters(rows: Row[], url: URL): Row[] {
  let out = rows;

  for (const [key, value] of url.searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;

    const dot = value.indexOf('.');
    if (dot < 0) continue;
    const op = value.slice(0, dot);
    const operand = value.slice(dot + 1);

    out = out.filter((row) => {
      const cell = row[key];
      switch (op) {
        case 'eq':
          return String(cell) === operand;
        case 'neq':
          return String(cell) !== operand;
        case 'is':
          return operand === 'null' ? cell === null || cell === undefined : String(cell) === operand;
        case 'in':
          return operand
            .replace(/^\(|\)$/g, '')
            .split(',')
            .map((v) => v.replace(/^"|"$/g, ''))
            .includes(String(cell));
        default:
          return true;
      }
    });
  }

  return out;
}

/**
 * PostgREST answers a `.single()` / `.maybeSingle()` with one object, and a
 * plain read with an array — the Accept header says which.
 */
function reply(route: Route, rows: Row[], status = 200) {
  const wantsObject = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');

  if (!wantsObject) return route.fulfill({ status, json: rows });
  if (rows.length === 1) return route.fulfill({ status, json: rows[0] });

  return route.fulfill({
    status: 406,
    json: {
      code: 'PGRST116',
      details: `The result contains ${rows.length} rows`,
      hint: null,
      message: 'JSON object requested, multiple (or no) rows returned',
    },
  });
}

function bodyOf(request: Request): Row | Row[] | null {
  try {
    return JSON.parse(request.postData() || 'null');
  } catch {
    return null;
  }
}

let nextId = 1;

export async function stubNetwork(page: Page, stubs: Stubs): Promise<Mounted> {
  const mounted: Mounted = {
    calls: { travel: [], reminder: [], followup: [], schedule: [] },
    writes: [],
    db: {
      business_info: [
        { id: 'biz-1', name: 'Boxed2Built', street_address: '10 Home Base Ln', phone: '', email: '', is_active: true },
      ],
      jobs: [...(stubs.jobs ?? [job()])],
      invoices: [...(stubs.invoices ?? [])],
      contractors: [...(stubs.contractors ?? [])],
      job_contractors: [...(stubs.jobContractors ?? [])],
      ...Object.fromEntries(Object.entries(stubs.tables ?? {}).map(([name, rows]) => [name, [...rows]])),
    },
    deletes: [],
  };

  // Everything not named is an empty table, so an unrelated query never takes
  // the page down. Registered first: Playwright tries the last route first.
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/rest/v1/')[1]?.split('/')[0] ?? '';
    const method = request.method();
    const rows = (mounted.db[table] ??= []);

    if (method === 'GET' || method === 'HEAD') {
      const refused = stubs.rejectRead?.(table);
      if (refused) return route.fulfill({ status: refused.status ?? 500, json: refused.json as object });

      let found = applyFilters(rows, url);

      // `contractor:contractors(*)` — the embedded row a job's contractor list reads.
      if (table === 'job_contractors' && (url.searchParams.get('select') ?? '').includes('contractor:contractors')) {
        found = found.map((row) => ({
          ...row,
          contractor: (mounted.db.contractors ?? []).find((c) => c.id === row.contractor_id) ?? null,
        }));
      }

      return reply(route, found);
    }

    const body = bodyOf(request);
    const write: Write = { table, method, url: request.url(), body };
    mounted.writes.push(write);

    const rejection = stubs.rejectWrite?.(write);
    if (rejection) return route.fulfill({ status: rejection.status ?? 400, json: rejection.json as object });

    if (method === 'POST') {
      // The columns the real tables fill in themselves.
      const created = (Array.isArray(body) ? body : [body ?? {}]).map((row) => ({
        id: `new-${table}-${nextId++}`,
        is_active: true,
        created_at: new Date().toISOString(),
        ...row,
      }));
      rows.push(...created);
      return reply(route, created, 201);
    }

    const targets = applyFilters(rows, url);

    if (method === 'PATCH') {
      for (const row of targets) Object.assign(row, body);
      return reply(route, targets);
    }

    if (method === 'DELETE') {
      mounted.deletes.push(request.url());
      mounted.db[table] = rows.filter((row) => !targets.includes(row));
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ json: [] });
  });

  for (const [key, name] of Object.entries(FUNCTION_NAMES) as [FunctionKey, string][]) {
    await page.route(`**/functions/v1/${name}`, async (route) => {
      const call = readCall(route.request());
      mounted.calls[key].push(call);

      const answer = stubs[key]?.(call) ?? defaultAnswer(key, call);
      return route.fulfill({ status: answer.status ?? 200, json: answer.json as object });
    });
  }

  return mounted;
}

/** What each function says when a spec does not care. */
function defaultAnswer(key: FunctionKey, call: Call): Answer {
  if (key === 'travel') return { json: travelOk() };
  if (key === 'schedule') return { json: { success: true } };

  const preview = key === 'reminder' ? reminderPreview() : followupPreview();
  if (call.body.preview) return { json: { preview } };

  // A send: the shape both send paths read their result from.
  return {
    json: {
      sent: 1,
      results: [{ sent: true, to: call.body.test ? 'nick@boxed2built.com' : 'kjzollner21@yahoo.com' }],
    },
  };
}

/**
 * A customer who is signed in to the portal: the session supabase-js keeps in
 * localStorage, which is all `getSession()` reads, plus the auth endpoint that
 * answers for the user. Call before the page loads.
 */
export async function signInAsPortalCustomer(page: Page) {
  const user = {
    id: 'user-1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'kjzollner21@yahoo.com',
    app_metadata: { provider: 'google' },
    user_metadata: {},
    created_at: '2026-09-11T12:00:00Z',
  };

  await page.addInitScript((session) => {
    localStorage.setItem('boxed2built.auth.token', JSON.stringify(session));
  }, {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  });

  await page.route('**/auth/v1/user', (route) => route.fulfill({ json: user }));
}

export async function mountJobs(page: Page, stubs: Stubs = {}): Promise<Mounted> {
  const mounted = await stubNetwork(page, stubs);
  await page.goto('/tests/harness/job-card.html');
  await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
  return mounted;
}

/**
 * A signed-in admin who belongs to an organization. Some controls — the calendar
 * subscription — only exist for an admin whose organization has loaded.
 */
export async function signInAsAdmin(page: Page): Promise<Record<string, Row[]>> {
  await signInAsPortalCustomer(page);

  return {
    organization_members: [
      {
        id: 'member-1',
        user_id: 'user-1',
        organization_id: 'org-1',
        role: 'owner',
        is_active: true,
        organization: { id: 'org-1', name: 'Boxed2Built', slug: 'boxed2built', created_at: '2026-01-01T12:00:00Z' },
      },
    ],
  };
}

/** Any of the other views the job card harness can mount. */
export async function mountView(page: Page, view: string, stubs: Stubs = {}): Promise<Mounted> {
  const mounted = await stubNetwork(page, stubs);
  await page.goto(`/tests/harness/job-card.html?view=${view}`);
  return mounted;
}

export async function mountFollowup(page: Page, stubs: Stubs = {}): Promise<Mounted> {
  const mounted = await stubNetwork(page, stubs);
  await page.goto('/tests/harness/job-card.html?view=followup');
  await expect(page.getByText('Post-Job Follow-Up', { exact: false }).first()).toBeVisible();
  return mounted;
}

export function header(page: Page, name: string) {
  return page.getByRole('button', { name: new RegExp(name) });
}

/** Opens a card. Cards start collapsed and only mount their panels once open. */
export async function expandCard(page: Page, name = 'Kurt Zollner') {
  const toggle = header(page, name);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

/** One of the small labelled tiles inside an open card, found by its label. */
export function tile(page: Page, label: string) {
  // Starts-with rather than exact: the Work Location label carries a badge
  // ("Different address") inside the same paragraph.
  return page.locator('p', { hasText: new RegExp(`^${label}`) }).locator('xpath=..').first();
}

/** The row a write carried. An insert arrives as a one-element array. */
export function rowOf(write: Write): Row {
  const body = write.body;
  return (Array.isArray(body) ? body[0] : body) ?? {};
}

/** The writes made to one table, optionally narrowed to one method. */
export function writesTo(mounted: Mounted, table: string, method?: string): Write[] {
  return mounted.writes.filter((w) => w.table === table && (!method || w.method === method));
}

// ─────────────────────────────────────────────────────────────────────────────
// The browser-to-function contract
// ─────────────────────────────────────────────────────────────────────────────

const CORS_RELEVANT = /^(x-|authorization$|apikey$|content-type$|prefer$)/;

export function allowedHeadersFor(functionName: string): string[] {
  const file = new URL(`../../supabase/functions/${functionName}/index.ts`, import.meta.url);
  expect(existsSync(file), `supabase/functions/${functionName}/index.ts should exist`).toBe(true);

  const source = readFileSync(file, 'utf8');
  const match = source.match(/Access-Control-Allow-Headers['"]?\s*:\s*(['"`])([^'"`]*)\1/i);
  expect(match, `${functionName} should declare Access-Control-Allow-Headers`).not.toBeNull();

  return match![2].split(',').map((h) => h.trim().toLowerCase());
}

export function sentHeaders(call: Call): string[] {
  return Object.keys(call.headers)
    .map((h) => h.toLowerCase())
    .filter((h) => CORS_RELEVANT.test(h));
}
