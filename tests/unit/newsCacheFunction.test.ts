import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../netlify/functions/news-cache.ts';

const realFetch = globalThis.fetch;
let upstream: { url: string; headers: Headers }[] = [];

function stubUpstream(response: () => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    upstream.push({ url: String(input), headers: new Headers(init?.headers) });
    return response();
  }) as typeof fetch;
}

beforeEach(() => {
  upstream = [];
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co/';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const get = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
  handler(new Request(`https://boxed2built.com/api/news-cache${path}`, { method, headers }));

test('forwards the read with the anonymous key and makes the answer cacheable', async () => {
  stubUpstream(
    () => new Response('[{"id":"1"}]', { headers: { 'content-type': 'application/json', 'content-range': '0-0/7' } }),
  );
  const response = await get(
    '/rest/v1/news_items?select=*&status=eq.published&limit=26',
    { prefer: 'count=exact', authorization: 'Bearer an-admin-session', cookie: 'x=1' },
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '[{"id":"1"}]');
  assert.equal(response.headers.get('content-range'), '0-0/7');
  assert.match(response.headers.get('netlify-cdn-cache-control') ?? '', /s-maxage=60/);
  assert.match(response.headers.get('netlify-cdn-cache-control') ?? '', /stale-if-error/);
  // Each view must be its own cache entry, and the total-or-not request too.
  assert.equal(response.headers.get('netlify-vary'), 'query,header=prefer');

  assert.equal(upstream[0].url, 'https://example.supabase.co/rest/v1/news_items?select=*&status=eq.published&limit=26');
  assert.equal(upstream[0].headers.get('authorization'), 'Bearer anon-key');
  assert.equal(upstream[0].headers.get('apikey'), 'anon-key');
  assert.equal(upstream[0].headers.get('prefer'), 'count=exact');
  assert.equal(upstream[0].headers.get('cookie'), null);
});

test('serves the sale filter choices too, and forwards no other Prefer value', async () => {
  stubUpstream(() => new Response('[]'));
  const response = await get('/rest/v1/rpc/news_sale_filter_options', { prefer: 'return=minimal' });
  assert.equal(response.status, 200);
  assert.equal(upstream[0].headers.get('prefer'), null);
});

test('refuses anything but the two public reads', async () => {
  stubUpstream(() => new Response('[]'));
  assert.equal((await get('/rest/v1/news_items', {}, 'POST')).status, 405);
  assert.equal((await get('/rest/v1/news_facebook_posts?select=*')).status, 404);
  assert.equal((await get('/rest/v1/rpc/something_else')).status, 404);
  assert.equal((await get('/auth/v1/user')).status, 404);
  assert.equal((await get('/rest/v1/news_items?select=*&cachebust=123')).status, 400);
  assert.equal((await get('/rest/v1/news_items?select=*&limit=100000')).status, 400);
  assert.equal(upstream.length, 0);
});

test('a failing database is a 503 that is never cached', async () => {
  stubUpstream(() => new Response('boom', { status: 500 }));
  const failed = await get('/rest/v1/news_items?select=*&limit=26');
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('cache-control'), 'no-store');
  assert.equal(failed.headers.get('netlify-cdn-cache-control'), null);

  globalThis.fetch = (async () => {
    throw new Error('network');
  }) as typeof fetch;
  assert.equal((await get('/rest/v1/news_items?select=*&limit=26')).status, 503);
});

test('without the database settings it says so rather than guessing', async () => {
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  assert.equal((await get('/rest/v1/news_items?select=*')).status, 500);
});
