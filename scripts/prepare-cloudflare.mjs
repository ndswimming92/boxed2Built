#!/usr/bin/env node
// Adapts a finished build in dist/ for Cloudflare Pages.
//
// Runs after `npm run build`, only in the Cloudflare build (npm run
// build:cloudflare). Netlify never runs it, so the Netlify deploy is
// unchanged while both hosts exist.
//
//   1. dist/_redirects is replaced with cloudflare/_redirects. Netlify's file
//      relies on Netlify-only behaviour (the `!` force flag, slash-insensitive
//      matching, netlify.toml rules) that Cloudflare does not have.
//   2. dist/_headers becomes public/_headers followed by cloudflare/_headers,
//      which carries the netlify.toml [[headers]] blocks Cloudflare ignores.
//   3. The build fails if dist/404.html is missing. Without it Cloudflare
//      silently switches to single-page-app mode and answers every unknown
//      URL with the homepage at 200, which Google indexes as duplicates.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const cfDir = join(root, 'cloudflare');

function fail(message) {
  console.error(`[prepare-cloudflare] ${message}`);
  process.exit(1);
}

if (!existsSync(dist)) fail('dist/ not found. Run `npm run build` first.');
if (!existsSync(join(dist, '404.html'))) {
  fail('dist/404.html is missing. Cloudflare would serve the homepage for every unknown URL.');
}

// 1. Redirects
const redirects = readFileSync(join(cfDir, '_redirects'), 'utf8');
writeFileSync(join(dist, '_redirects'), redirects);

// 2. Headers
// Drop lines that are not a valid rule start. public/_headers ends its first
// block with a stray `*/` line, which Netlify ignores but Cloudflare would
// read as a URL pattern.
const baseHeaders = readFileSync(join(root, 'public', '_headers'), 'utf8')
  .split('\n')
  .filter(line => line.trim() !== '*/')
  .join('\n');
const extraHeaders = readFileSync(join(cfDir, '_headers'), 'utf8');
const headers = `${baseHeaders.trimEnd()}\n\n${extraHeaders}`;

const ruleCount = headers
  .split('\n')
  .filter(line => line.length > 0 && !/^\s/.test(line) && !line.startsWith('#')).length;
if (ruleCount > 100) fail(`_headers has ${ruleCount} rules; Cloudflare allows 100.`);

writeFileSync(join(dist, '_headers'), headers);

console.log(`[prepare-cloudflare] wrote dist/_redirects and dist/_headers (${ruleCount} header rules)`);
