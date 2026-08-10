#!/usr/bin/env node
// Asserts the SEO invariants of the pre-rendered site.
//
// Run against a completed build:
//
//     npm run build && npm run verify:seo
//
// WHY THIS EXISTS
// The site previously shipped every interior page with two <link rel="canonical">
// tags — the correct one, plus a hardcoded homepage canonical inherited from
// index.html. Google discards canonicals outright when a page carries
// conflicting values, so every interior page was being kept out of the index by
// a single duplicated line. Nothing failed, nothing logged, and the built HTML
// looked fine unless you counted the tags.
//
// That class of bug is invisible to typecheck, lint and tests, so it needs its
// own guard. Everything below is a check that would have caught a real defect
// found in this codebase.
//
// Exits non-zero with a grouped report on failure.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE_URL = 'https://boxed2built.com';

/** SERP display limits. Beyond these, Google rewrites or truncates. */
const TITLE_MAX = 62;
const DESC_MIN = 110;
const DESC_MAX = 170;

const failures = [];
const fail = (page, message) => failures.push({ page, message });

function unescapeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

/** dist/about.html -> /about ; dist/index.html -> / (ssgOptions.dirStyle: 'flat') */
function pathFor(file) {
  const rel = relative(DIST, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  return `/${rel.replace(/\.html$/, '')}`;
}

const all = (html, re) => [...html.matchAll(re)].map((m) => m[1]);

function checkPage(file, html) {
  const page = pathFor(file);
  const head = html.slice(0, html.indexOf('</head>'));
  const noIndex = /content="[^"]*noindex/i.test(head);

  const titles = all(html, /<title[^>]*>([\s\S]*?)<\/title>/g).map(unescapeHtml);
  const descs = all(html, /<meta[^>]*name="description"[^>]*content="([^"]*)"/g).map(unescapeHtml);
  const canons = all(html, /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/g);
  const ogUrls = all(html, /<meta[^>]*property="og:url"[^>]*content="([^"]*)"/g);
  const ogTitles = all(html, /<meta[^>]*property="og:title"[^>]*content="([^"]*)"/g);
  const h1s = all(html, /<h1[^>]*>([\s\S]*?)<\/h1>/g);

  // Exactly one of each. More than one canonical is the bug this file exists for;
  // more than one <h1> was a real defect too (a stray one inside <noscript>).
  const singles = [
    ['<title>', titles],
    ['<meta name="description">', descs],
    ['<link rel="canonical">', canons],
    ['<meta property="og:url">', ogUrls],
    ['<meta property="og:title">', ogTitles],
  ];
  for (const [label, found] of singles) {
    if (found.length !== 1) fail(page, `expected exactly 1 ${label}, found ${found.length}`);
  }
  // A noindex confirmation page legitimately renders no <h1>.
  if (h1s.length !== 1 && !(noIndex && h1s.length === 0)) {
    fail(page, `expected exactly 1 <h1>, found ${h1s.length}`);
  }

  // Canonical and og:url must point at this page, not another one.
  const expected = `${SITE_URL}${page}`;
  if (canons.length === 1 && canons[0] !== expected) {
    fail(page, `canonical points at ${canons[0]} (expected ${expected})`);
  }
  if (ogUrls.length === 1 && ogUrls[0] !== expected) {
    fail(page, `og:url points at ${ogUrls[0]} (expected ${expected})`);
  }

  // Length limits (skip noindex pages — they never appear in a SERP).
  if (!noIndex) {
    for (const t of titles) {
      if (t.length > TITLE_MAX) fail(page, `title is ${t.length} chars (max ${TITLE_MAX}): "${t}"`);
    }
    for (const d of descs) {
      if (d.length < DESC_MIN || d.length > DESC_MAX) {
        fail(page, `description is ${d.length} chars (want ${DESC_MIN}-${DESC_MAX})`);
      }
    }
  }

  // Structured data must parse — a JSON syntax error silently voids the whole block.
  const types = new Set();
  for (const block of all(html, /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let data;
    try {
      data = JSON.parse(block);
    } catch {
      try {
        data = JSON.parse(unescapeHtml(block));
      } catch (error) {
        fail(page, `invalid JSON-LD: ${error.message}`);
        continue;
      }
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      for (const t of [].concat(node['@type'] ?? [])) types.add(t);
    }
  }

  // Landing pages carry the schema that earns rich results; losing it is silent.
  const isLanding =
    page.startsWith('/service-areas/') ||
    ['/services/furniture-assembly', '/services/tv-mounting'].includes(page) ||
    (page.startsWith('/services/') && page !== '/services');
  if (isLanding) {
    for (const required of ['Service', 'FAQPage', 'BreadcrumbList']) {
      if (!types.has(required)) fail(page, `missing ${required} schema`);
    }
  }

  return { page, title: titles[0], desc: descs[0], canon: canons[0], noIndex };
}

function checkAssets(file, html) {
  const page = pathFor(file);
  for (const attr of all(html, /(?:src|srcset)="([^"]+)"/g)) {
    for (const candidate of attr.split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (!url.startsWith('/images/')) continue;

      if (url.includes('?')) {
        // Netlify serves static files verbatim; ?fm=/?w= params do nothing and
        // previously made the site claim formats it wasn't serving.
        fail(page, `image URL carries transform params that Netlify ignores: ${url}`);
      }
      const onDisk = join(DIST, url.split('?')[0]);
      if (!existsSync(onDisk)) fail(page, `references missing image ${url}`);
      if (/^\/images\/marketing-images\/.*\.(png|jpe?g)$/i.test(url)) {
        fail(page, `marketing image served as PNG/JPEG instead of WebP: ${url}`);
      }
    }
  }
}

async function checkSitemaps(pages) {
  const rendered = new Set(pages.map((p) => p.page));
  const indexable = new Set(pages.filter((p) => !p.noIndex).map((p) => p.page));

  const sitemap = await readFile(join(DIST, 'sitemap.xml'), 'utf-8');
  const listed = new Set(
    all(sitemap, /<loc>([^<]+)<\/loc>/g).map((loc) => loc.replace(SITE_URL, '') || '/'),
  );

  for (const path of listed) {
    if (!rendered.has(path)) fail('sitemap.xml', `lists ${path}, which is not pre-rendered`);
    if (!indexable.has(path)) fail('sitemap.xml', `lists ${path}, which is noindex`);
  }
  for (const path of indexable) {
    if (!listed.has(path)) fail('sitemap.xml', `missing indexable page ${path}`);
  }

  const imageSitemap = await readFile(join(DIST, 'sitemap-images.xml'), 'utf-8');
  const images = all(imageSitemap, /<image:loc>([^<]+)<\/image:loc>/g);
  if (images.length === 0) fail('sitemap-images.xml', 'contains no images');
  for (const loc of images) {
    // The old hand-written sitemap listed deleted files and third-party stock.
    if (!loc.startsWith(SITE_URL)) {
      fail('sitemap-images.xml', `lists a third-party image: ${loc}`);
      continue;
    }
    if (!existsSync(join(DIST, loc.replace(SITE_URL, '')))) {
      fail('sitemap-images.xml', `lists missing image ${loc}`);
    }
  }
  for (const loc of all(imageSitemap, /<loc>([^<]+)<\/loc>/g)) {
    const path = loc.replace(SITE_URL, '') || '/';
    if (!rendered.has(path)) fail('sitemap-images.xml', `attaches images to unrendered ${path}`);
  }
}

function checkNoPrivatePages(pages) {
  for (const { page } of pages) {
    if (/^\/(admin|portal)(\/|$)/.test(page)) {
      fail(page, 'auth-gated page was pre-rendered into dist');
    }
  }
}

function reportDuplicates(pages) {
  const group = (key, label) => {
    const byValue = new Map();
    for (const p of pages) {
      if (!p[key]) continue;
      if (!byValue.has(p[key])) byValue.set(p[key], []);
      byValue.get(p[key]).push(p.page);
    }
    for (const [value, owners] of byValue) {
      if (owners.length > 1) {
        fail('site-wide', `duplicate ${label} on ${owners.join(', ')}: "${String(value).slice(0, 60)}"`);
      }
    }
  };
  group('title', 'title');
  group('desc', 'description');
  group('canon', 'canonical');
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('[verify:seo] no dist/ — run `npm run build` first');
    process.exit(1);
  }

  const files = await htmlFiles(DIST);
  if (files.length === 0) {
    console.error('[verify:seo] dist/ contains no HTML');
    process.exit(1);
  }

  const pages = [];
  for (const file of files) {
    const html = await readFile(file, 'utf-8');
    pages.push(checkPage(file, html));
    checkAssets(file, html);
  }

  checkNoPrivatePages(pages);
  reportDuplicates(pages);
  await checkSitemaps(pages);

  console.log(`[verify:seo] checked ${pages.length} pre-rendered pages`);

  if (failures.length === 0) {
    console.log('[verify:seo] all checks passed');
    return;
  }

  const byPage = new Map();
  for (const { page, message } of failures) {
    if (!byPage.has(page)) byPage.set(page, []);
    byPage.get(page).push(message);
  }
  console.error(`\n[verify:seo] ${failures.length} problem(s):\n`);
  for (const [page, messages] of [...byPage].sort()) {
    console.error(`  ${page}`);
    for (const m of messages) console.error(`    - ${m}`);
  }
  console.error('');
  process.exit(1);
}

main().catch((error) => {
  console.error('[verify:seo] failed to run:', error);
  process.exit(1);
});
