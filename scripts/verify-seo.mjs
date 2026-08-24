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

/** Every aggregateRating found across the build, for the site-wide drift check. */
const aggregateRatings = [];

/**
 * Review totals are partly hand-maintained in index.html and partly derived from
 * the database, so they drift silently — the site claimed 8 reviews while the
 * Google Business Profile showed 9 ratings.
 *
 * ratingCount is every rating; reviewCount is only the ones with written text
 * (Google lets customers leave a star rating with no words). So ratingCount can
 * exceed reviewCount, never the reverse, and reviewCount has to match the number
 * of Review nodes actually published alongside it.
 */
function checkAggregateRating(page, node) {
  const rating = node?.aggregateRating;
  if (!rating || typeof rating !== 'object') return;

  const num = (value) => (value === undefined ? undefined : Number(value));
  const ratingCount = num(rating.ratingCount);
  const reviewCount = num(rating.reviewCount);
  const ratingValue = num(rating.ratingValue);

  if (ratingCount === undefined && reviewCount === undefined) {
    fail(page, 'aggregateRating has neither ratingCount nor reviewCount — Google needs one');
  }
  for (const [label, value] of [['ratingCount', ratingCount], ['reviewCount', reviewCount]]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
      fail(page, `aggregateRating ${label} is "${rating[label]}" (want a positive integer)`);
    }
  }
  if (ratingCount !== undefined && reviewCount !== undefined && reviewCount > ratingCount) {
    fail(page, `aggregateRating reviewCount (${reviewCount}) exceeds ratingCount (${ratingCount})`);
  }

  const best = num(rating.bestRating) ?? 5;
  const worst = num(rating.worstRating) ?? 1;
  if (ratingValue === undefined || Number.isNaN(ratingValue)) {
    fail(page, 'aggregateRating is missing a numeric ratingValue');
  } else if (ratingValue < worst || ratingValue > best) {
    fail(page, `aggregateRating ratingValue ${ratingValue} is outside ${worst}-${best}`);
  }

  // Star-only ratings carry no body, so they must not appear as Review nodes.
  const published = [].concat(node.review ?? []);
  if (published.length > 0) {
    const bodied = published.filter((r) => String(r?.reviewBody ?? '').trim().length > 0);
    if (bodied.length !== published.length) {
      fail(page, `${published.length - bodied.length} Review node(s) have an empty reviewBody`);
    }
    if (reviewCount !== undefined && reviewCount !== published.length) {
      fail(page, `aggregateRating reviewCount is ${reviewCount} but ${published.length} Review node(s) are published`);
    }
  }

  aggregateRatings.push({ page, ratingValue, ratingCount, reviewCount });
}

/** All pages must publish the same review totals — one stale copy poisons the SERP. */
function reportRatingDrift() {
  const seen = new Map();
  for (const entry of aggregateRatings) {
    const key = `${entry.ratingValue} / ${entry.ratingCount ?? '-'} ratings / ${entry.reviewCount ?? '-'} reviews`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(entry.page);
  }
  if (seen.size > 1) {
    const variants = [...seen]
      .map(([key, pages]) => `${key} on ${[...new Set(pages)].sort().join(', ')}`)
      .join(' | ');
    fail('site-wide', `aggregateRating totals disagree between pages: ${variants}`);
  }
}

/**
 * index.html's review totals are placeholders that the review-aggregate-rating
 * plugin fills at build time. If one ships unfilled, the JSON-LD carries
 * "__GBP_RATING_COUNT__" where a number belongs.
 */
function checkNoUnfilledPlaceholders(page, html) {
  for (const token of new Set(all(html, /(__GBP_[A-Z_]*__)/g))) {
    fail(page, `build-time placeholder ${token} was never filled in`);
  }
}

function checkPage(file, html) {
  const page = pathFor(file);
  const head = html.slice(0, html.indexOf('</head>'));
  const noIndex = /content="[^"]*noindex/i.test(head);

  checkNoUnfilledPlaceholders(page, html);

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
      checkAggregateRating(page, node);
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

/**
 * A page that says both "index" and "noindex" is asking Google to pick, and the
 * pages that get it wrong are the ones that must stay out of the index —
 * /404 and the two order-confirmation pages. It happens the same way the
 * duplicate-canonical bug did: index.html states a site-wide value, <Head>
 * prepends the page-level one, and both survive into the pre-rendered HTML.
 * Directives that only describe SERP presentation (max-snippet and friends)
 * are not in conflict with anything and are ignored here.
 */
function checkRobotsDirectives(page, html) {
  const head = html.slice(0, html.indexOf('</head>'));
  const directives = all(head, /<meta[^>]*name="robots"[^>]*content="([^"]*)"/g)
    .concat(all(head, /<meta[^>]*content="([^"]*)"[^>]*name="robots"/g))
    .flatMap((content) => content.split(',').map((d) => d.trim().toLowerCase()));

  const indexing = new Set(directives.filter((d) => d === 'index' || d === 'noindex'));
  if (indexing.size > 1) {
    fail(page, 'carries both "index" and "noindex" in its robots meta — Google has to guess which one you meant');
  }
}

/**
 * The canonical URL form on this site is "no trailing slash", and nothing
 * declares that — it falls out of the build shape. ssgOptions.dirStyle: 'flat'
 * writes dist/about.html, so Netlify answers /about with a 200 and 301s
 * /about/ onto it. Switch dirStyle to 'nested' and dist/about/index.html
 * inverts the pair: /about/ becomes the served URL and /about starts
 * redirecting — which means every <loc> in sitemap.xml, every rel="canonical"
 * and every internal link now points at a redirect. Search Console fills up
 * with "Page with redirect", the pages fall out of the index, and no build
 * step notices, because the HTML itself is still perfectly valid.
 */
function checkFlatOutput(files) {
  for (const file of files) {
    const rel = relative(DIST, file).split(sep).join('/');
    if (rel !== 'index.html' && rel.endsWith('/index.html')) {
      fail(
        `/${rel.replace(/\/index\.html$/, '')}`,
        `pre-rendered as ${rel} (a directory index) — ssgOptions.dirStyle must stay "flat", or the canonical URL of every page becomes a 301`,
      );
    }
  }
}

/**
 * /contact and /contact/ are two URLs to Google and only the bare one is
 * served; the slashed form 301s. Emitting the slashed form anywhere — a
 * canonical, an og:url, a breadcrumb in JSON-LD, a plain <a href> — hands the
 * crawler a URL it can only ever redirect, which is exactly how the "Page with
 * redirect" report fills up and how link equity gets spent on a hop. The
 * homepage is the one legitimate trailing slash.
 */
function checkNoTrailingSlashUrls(file, html) {
  const page = pathFor(file);
  const candidates = [
    // Absolute — catches JSON-LD and meta content as well as attributes.
    ...all(html, /(https:\/\/boxed2built\.com[^\s"'<>\\&]*)/g),
    // Root-relative, from link attributes only: "/foo" shows up in prose too.
    ...all(html, /(?:href|content)="(\/[^"]*)"/g),
  ];

  for (const url of new Set(candidates)) {
    const path = url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url;
    const [withoutQuery] = path.split(/[?#]/);
    if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
      fail(page, `links ${url}, which 301s to the same URL without the trailing slash`);
    }
  }
}

/**
 * Unmatched URLs have to answer with a real 404. They used to hit a blanket
 * `/*  /index.html  200` in _redirects, so every typo, every stale inbound link
 * and every retired path returned the homepage shell at HTTP 200 — a soft 404
 * that Google indexes as a duplicate of the homepage. Netlify serves
 * dist/404.html with a 404 status for anything that matches no file and no
 * rule, so the guard is: that file exists, it is noindex, and no rule reaches
 * past it.
 */
async function checkNotFoundHandling(pages) {
  const notFound = pages.find((p) => p.page === '/404');
  if (!notFound) {
    fail('/404', 'no dist/404.html — Netlify would answer unmatched URLs with its own generic page');
  } else if (!notFound.noIndex) {
    fail('/404', 'the 404 page is indexable — it must carry <meta name="robots" content="noindex">');
  }

  const redirects = await readFile(join(DIST, '_redirects'), 'utf-8');
  for (const line of redirects.split('\n')) {
    const rule = line.trim();
    if (!rule || rule.startsWith('#')) continue;
    const [from, , status] = rule.split(/\s+/);
    if (/^\/\*+$/.test(from) && (status ?? '200').startsWith('200')) {
      fail('_redirects', `\`${rule}\` swallows every unmatched URL into a 200 — scope the SPA fallback to the route families that are not pre-rendered`);
    }
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
    checkNoTrailingSlashUrls(file, html);
    checkRobotsDirectives(pathFor(file), html);
  }

  checkFlatOutput(files);
  checkNoPrivatePages(pages);
  await checkNotFoundHandling(pages);
  reportDuplicates(pages);
  reportRatingDrift();
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
