#!/usr/bin/env node

const baseUrl = process.env.SYNTHETIC_BASE_URL || 'http://localhost:4173';
const invoiceId = process.env.SYNTHETIC_INVOICE_ID || 'synthetic-invoice';
const timeoutMs = Number(process.env.SYNTHETIC_TIMEOUT_MS || 10000);

async function timedCheck(name, path, expectedStatus = [200, 302, 401, 403]) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(new URL(path, baseUrl), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    const durationMs = Math.round(performance.now() - started);
    const ok = expectedStatus.includes(response.status);

    return { name, ok, status: response.status, durationMs };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 0,
      durationMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

const checks = [
  await timedCheck('portal_login', '/portal/login', [200]),
  await timedCheck('portal_dashboard_load', '/portal/dashboard', [200, 302]),
  await timedCheck('invoice_open', `/pay/${invoiceId}`, [200, 404]),
  // The Deals & News page itself, and the cached route its sales come from
  // (netlify/functions/news-cache.ts). That route answers 503 when Supabase is
  // failing, which is what this is here to catch. A 404 only means the function
  // is not deployed to this site yet; the page falls back to Supabase then, so
  // it is not an outage.
  await timedCheck('news_page', '/news', [200]),
  await timedCheck(
    'news_feed_cache',
    '/api/news-cache/rest/v1/news_items?select=id&status=eq.published&limit=1',
    [200, 404],
  ),
];

const summary = {
  baseUrl,
  generatedAt: new Date().toISOString(),
  checks,
  allHealthy: checks.every((check) => check.ok),
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.allHealthy) {
  process.exitCode = 1;
}
