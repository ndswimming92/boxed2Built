import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const FUNCTIONS_DIR = new URL('../../supabase/functions/', import.meta.url);

// Called from outside the app (calendar clients, API keys) rather than through
// supabase-js, so they intentionally have their own header lists.
const EXTERNAL = new Set(['api-v1', 'job-calendar-feed']);

// What supabase-js sends from the browser. If a function's preflight response
// leaves any of these out, the browser blocks the POST and the admin sees only
// "Failed to send a request to the Edge Function".
const REQUIRED = ['content-type', 'authorization', 'apikey', 'x-client-info'];

function allowedHeaders(source: string): string | null {
  const match = source.match(/Access-Control-Allow-Headers['"]?\s*:\s*(['"`])([^'"`]*)\1/i);
  return match ? match[2] : null;
}

test('edge functions allow the headers supabase-js sends', () => {
  const problems: string[] = [];

  for (const entry of readdirSync(FUNCTIONS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || EXTERNAL.has(entry.name)) continue;
    const file = new URL(`${entry.name}/index.ts`, FUNCTIONS_DIR);
    if (!existsSync(file)) continue;

    const allowed = allowedHeaders(readFileSync(file, 'utf8'));
    if (allowed === null) continue; // no CORS block, or not a browser-facing function
    if (allowed.trim() === '*') continue;

    const have = allowed.split(',').map((h) => h.trim().toLowerCase());
    const missing = REQUIRED.filter((h) => !have.includes(h));
    if (missing.length) problems.push(`${entry.name}: missing ${missing.join(', ')}`);
  }

  assert.deepEqual(problems, []);
});

test('no function allows the misspelled x-customer-info header', () => {
  const offenders = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(new URL(`${e.name}/index.ts`, FUNCTIONS_DIR)))
    .filter((e) => /x-customer-info/i.test(readFileSync(new URL(`${e.name}/index.ts`, FUNCTIONS_DIR), 'utf8')))
    .map((e) => e.name);
  assert.deepEqual(offenders, []);
});
