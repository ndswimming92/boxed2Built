#!/usr/bin/env node
// Checks a finished build in dist/ against the Cloudflare Pages rules that
// fail silently in production. Runs as the last step of `npm run build`.
//
//   1. dist/404.html must exist. Without it Cloudflare switches to
//      single-page-app mode and answers every unknown URL with the homepage
//      at 200, which Google indexes as duplicates.
//   2. dist/_headers may hold at most 100 rules.
//   3. No dist/_headers line may pass 2,000 characters. The CSP line grows
//      with every inline-script hash apply-csp.mjs adds, and a line over the
//      cap would stop the policy being applied.
//   4. Every unindented dist/_headers line must be a comment or a path. A
//      stray line there is read as a URL pattern and swallows the headers
//      under it.
//   5. dist/_routes.json (from public/_routes.json) must exist. It keeps the
//      Pages Function that serves markdown to AI agents
//      (functions/_middleware.ts) off static files and the signed-in app.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function fail(message) {
  console.error(`[check-cloudflare-output] ${message}`);
  process.exit(1);
}

if (!existsSync(dist)) fail('dist/ not found. Run `npm run build` first.');
if (!existsSync(join(dist, '404.html'))) {
  fail('dist/404.html is missing. Cloudflare would serve the homepage for every unknown URL.');
}
if (!existsSync(join(dist, '_redirects'))) fail('dist/_redirects is missing.');
if (!existsSync(join(dist, '_headers'))) fail('dist/_headers is missing.');
if (!existsSync(join(dist, '_routes.json'))) {
  fail('dist/_routes.json is missing. The markdown function would run on every request, images included.');
}

const lines = readFileSync(join(dist, '_headers'), 'utf8').split('\n');

const rules = lines.filter(line => line.length > 0 && !/^\s/.test(line) && !line.startsWith('#'));
if (rules.length > 100) fail(`_headers has ${rules.length} rules; Cloudflare allows 100.`);

const badRule = rules.find(rule => !rule.startsWith('/') && !rule.startsWith('https://'));
if (badRule) fail(`_headers has an unindented line that is not a path or a comment: ${badRule}`);

const longLine = lines.find(line => line.length > 2000);
if (longLine) {
  fail(`a _headers line is ${longLine.length} characters; Cloudflare allows 2,000: ${longLine.slice(0, 60)}…`);
}

console.log(`[check-cloudflare-output] dist/ is ready for Cloudflare Pages (${rules.length} header rules)`);
