#!/usr/bin/env node
// Makes the pre-rendered site compatible with a script-src that has no
// 'unsafe-inline'. Runs after `vite-react-ssg build`, on dist/ only.
//
//   1. Each page's `window.__staticRouterHydrationData = ...` inline script is
//      unique to that page, so it cannot be covered by one header. It moves
//      into a content-hashed file under /assets/ and the page loads it with a
//      plain <script src>. It stays a classic script ahead of the deferred
//      module entry, so it still runs first.
//   2. Every inline script left over (the admin manifest bootstrap, the GA
//      bootstrap, the build hash) and every inline event-handler attribute
//      (the font preload's onload) is hashed. The hashes replace the
//      {{CSP_SCRIPT_HASHES}} token in dist/_headers.
//
// Hashing here, rather than pasting hashes into public/_headers, means editing
// one of those inline scripts cannot silently stop it running in production.
// A page that still has an unhashed inline script after this step fails the
// build rather than shipping a broken page.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const TOKEN = '{{CSP_SCRIPT_HASHES}}';

function fail(message) {
  console.error(`[apply-csp] ${message}`);
  process.exit(1);
}

if (!existsSync(dist)) fail('dist/ not found. Run the build first.');

function htmlFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? htmlFiles(path) : path.endsWith('.html') ? [path] : [];
  });
}

const sha256 = text => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

function decodeEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Scripts that are data, not code, are not governed by script-src.
const isData = attrs => /type\s*=\s*["']?(application\/ld\+json|application\/json|importmap|speculationrules)/i.test(attrs);

const SCRIPT_RE = /<script([^>]*)>([\s\S]*?)<\/script>/g;
const HANDLER_RE = /\son[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

const hashes = new Set();
let moved = 0;

for (const file of htmlFiles(dist)) {
  let html = readFileSync(file, 'utf8');

  html = html.replace(SCRIPT_RE, (whole, attrs, body) => {
    if (/\ssrc\s*=/.test(attrs) || isData(attrs) || body.trim() === '') return whole;

    if (body.trimStart().startsWith('window.__staticRouterHydrationData')) {
      const name = `hydration-${createHash('sha256').update(body).digest('hex').slice(0, 16)}.js`;
      writeFileSync(join(dist, 'assets', name), body);
      moved += 1;
      return `<script${attrs} src="/assets/${name}"></script>`;
    }

    hashes.add(sha256(body));
    return whole;
  });

  for (const match of html.matchAll(HANDLER_RE)) {
    hashes.add(sha256(decodeEntities(match[1] ?? match[2])));
  }

  writeFileSync(file, html);
}

const headersPath = join(dist, '_headers');
if (!existsSync(headersPath)) fail('dist/_headers not found.');
const headers = readFileSync(headersPath, 'utf8');
if (!headers.includes(TOKEN)) fail(`dist/_headers has no ${TOKEN} token to fill.`);

const filled = headers.replaceAll(TOKEN, [...hashes].sort().join(' '));
if (filled.includes('{{')) fail('dist/_headers still has an unfilled {{ }} placeholder.');
writeFileSync(headersPath, filled);

console.log(`[apply-csp] moved ${moved} hydration scripts to /assets, allowed ${hashes.size} inline hashes`);
