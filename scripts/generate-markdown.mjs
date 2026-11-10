#!/usr/bin/env node
// Writes a markdown twin next to every public pre-rendered page in dist/
// (about.html -> about.md), for "Markdown for Agents".
//
// AI agents that send `Accept: text/markdown` are answered with these files by
// functions/_middleware.ts, so they read clean text instead of scraping the
// HTML layout. Browsers keep getting HTML.
//
// Runs as part of `npm run build:cloudflare`, after the pages are rendered.
// Only the page's <main> is converted: the header, footer and navigation repeat
// on every page and are noise to a reader that fetched one URL.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import TurndownService from 'turndown';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE_URL = 'https://boxed2built.com';

function fail(message) {
  console.error(`[generate-markdown] ${message}`);
  process.exit(1);
}

if (!existsSync(dist)) fail('dist/ not found. Run `npm run build` first.');

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'assets' ? [] : htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

function unescapeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'));
  return match ? unescapeHtml(match[1]) : '';
}

function metaContent(head, name) {
  const tag = head.match(new RegExp(`<meta[^>]*\\sname="${name}"[^>]*>`, 'i'));
  return tag ? attribute(tag[0], 'content') : '';
}

/** Double-quoted YAML scalar. */
function yaml(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function absolute(href, pageUrl) {
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return href;
  }
}

function converterFor(pageUrl) {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    hr: '---',
  });

  // Things that carry no text an agent can use: scripts, icons, embeds, and
  // interactive controls (the quote form is reachable through its page link).
  turndown.remove(['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'canvas', 'video', 'audio']);
  turndown.remove(['form', 'button', 'input', 'select', 'textarea', 'dialog']);
  turndown.addRule('hidden', {
    filter: node => node.getAttribute?.('aria-hidden') === 'true' || node.hasAttribute?.('hidden'),
    replacement: () => '',
  });
  // The breadcrumb restates the URL.
  turndown.addRule('breadcrumb', {
    filter: node => node.nodeName === 'NAV',
    replacement: () => '',
  });

  // Keep a heading on one line even when it holds a <br>.
  turndown.addRule('singleLineHeading', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    replacement(content, node) {
      const text = content.replace(/\s+/g, ' ').trim();
      return text ? `\n\n${'#'.repeat(Number(node.nodeName[1]))} ${text}\n\n` : '';
    },
  });
  turndown.addRule('absoluteLink', {
    filter: node => node.nodeName === 'A' && node.getAttribute('href'),
    replacement(content, node) {
      const text = content.replace(/\s+/g, ' ').trim();
      const href = node.getAttribute('href');
      if (!text) return '';
      if (href.startsWith('#')) return text;
      return `[${text}](${absolute(href, pageUrl)})`;
    },
  });
  // Keep only images that say something; the alt text is the content.
  turndown.addRule('describedImage', {
    filter: 'img',
    replacement(_content, node) {
      const alt = (node.getAttribute('alt') || '').replace(/\s+/g, ' ').trim();
      const src = node.getAttribute('src');
      if (!alt || !src || src.startsWith('data:')) return '';
      return `![${alt}](${absolute(src, pageUrl)})`;
    },
  });
  return turndown;
}

let written = 0;
const skipped = [];

for (const file of htmlFiles(dist)) {
  const html = readFileSync(file, 'utf8');
  const page = relative(dist, file).split(sep).join('/');
  const head = html.slice(0, html.indexOf('</head>'));

  // noindex pages (404, checkout results, unsubscribe) are not content.
  if (/noindex/i.test(metaContent(head, 'robots'))) {
    skipped.push(page);
    continue;
  }

  const main = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/i);
  if (!main) fail(`${page} has no <main> element to convert.`);

  const canonicalTag = head.match(/<link[^>]*\srel="canonical"[^>]*>/i);
  const route = page === 'index.html' ? '/' : `/${page.replace(/\.html$/, '')}`;
  const pageUrl = (canonicalTag && attribute(canonicalTag[0], 'href')) || `${SITE_URL}${route}`;
  const title = unescapeHtml((head.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '').trim();
  const description = metaContent(head, 'description');

  const body = converterFor(pageUrl)
    .turndown(main[1].replace(/<span class="block\b/g, ' $&'))
    // Side-by-side buttons and cards come out as links with nothing between.
    .replace(/\)\[(?=[^\]]*\]\()/g, ')\n\n[')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (body.length < 50) fail(`${page} converted to only ${body.length} characters of markdown.`);

  const frontMatter = ['---', `title: ${yaml(title)}`];
  if (description) frontMatter.push(`description: ${yaml(description)}`);
  frontMatter.push(`url: ${pageUrl}`, '---');

  const footer = `---\n\nBoxed2Built site overview for AI agents: ${SITE_URL}/llms.txt`;
  writeFileSync(file.replace(/\.html$/, '.md'), `${frontMatter.join('\n')}\n\n${body}\n\n${footer}\n`);
  written += 1;
}

if (written === 0) fail('no pages were converted.');
console.log(
  `[generate-markdown] wrote ${written} markdown pages` +
    (skipped.length ? ` (skipped noindex: ${skipped.join(', ')})` : ''),
);
