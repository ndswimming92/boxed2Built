#!/usr/bin/env node
// Generates public/sitemap.xml and public/sitemap-images.xml from the data that
// actually drives the app.
//
// The sitemap used to be maintained by hand, which meant every new page needed
// a second edit in a second file and drifted the moment someone forgot. This
// reads src/constants/serviceLocations.ts and serviceLandingPages.ts directly
// (bundled through esbuild, since they are TypeScript) so a new city or service
// page shows up in the sitemap automatically on the next build.
//
// The image sitemap is generated the same way, from PAGE_IMAGES in
// src/constants/marketingImages.ts. The old hand-written one had rotted
// completely: every local image it listed 404'd, and the rest pointed at Pexels
// stock photography the business does not own.
//
// Run via `npm run sitemap`, or automatically as part of `npm run build`.

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://boxed2built.com';
const SITEMAP_PATH = join(ROOT, 'public', 'sitemap.xml');
const IMAGE_SITEMAP_PATH = join(ROOT, 'public', 'sitemap-images.xml');

/**
 * Bundle a TypeScript module to a temp .mjs and import it, so this plain-Node
 * script can read the same constants the app does without duplicating them.
 */
async function importTypeScript(entry) {
  const dir = await mkdtemp(join(tmpdir(), 'b2b-sitemap-'));
  const outfile = join(dir, 'bundle.mjs');
  try {
    await build({
      entryPoints: [join(ROOT, entry)],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node20',
      logLevel: 'silent',
    });
    return await import(pathToFileURL(outfile).href);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Static pages, in the priority order we want crawlers to read them.
 * Anything generated from data is appended below rather than listed here.
 */
const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/services', priority: '0.9', changefreq: 'weekly' },
  { path: '/services/furniture-assembly', priority: '0.9', changefreq: 'weekly' },
  { path: '/services/tv-mounting', priority: '0.9', changefreq: 'weekly' },
  { path: '/contact', priority: '0.8', changefreq: 'monthly' },
  { path: '/about', priority: '0.7', changefreq: 'monthly' },
  { path: '/gallery', priority: '0.7', changefreq: 'weekly' },
  { path: '/faq', priority: '0.7', changefreq: 'monthly' },
  { path: '/partners', priority: '0.6', changefreq: 'monthly' },
  { path: '/store', priority: '0.7', changefreq: 'weekly' },
  { path: '/gift-cards', priority: '0.6', changefreq: 'monthly' },
  { path: '/redeem-gift-card', priority: '0.4', changefreq: 'yearly' },
  { path: '/lookup-request', priority: '0.4', changefreq: 'yearly' },
  { path: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms-of-service', priority: '0.3', changefreq: 'yearly' },
];

function urlEntry({ path, priority, changefreq }, lastmod) {
  return [
    '  <url>',
    `    <loc>${SITE_URL}${path === '/' ? '/' : path}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

/**
 * Reuse the previous run's <lastmod> for URLs whose entry is unchanged, so a
 * rebuild does not tell Google that all 27 pages changed today. Only genuinely
 * new URLs get today's date.
 */
async function readExistingLastmods() {
  if (!existsSync(SITEMAP_PATH)) return new Map();
  const xml = await readFile(SITEMAP_PATH, 'utf-8');
  const entries = new Map();
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const block of urlBlocks) {
    const loc = block.match(/<loc>(.*?)<\/loc>/)?.[1];
    const lastmod = block.match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
    if (loc && lastmod) entries.set(loc, lastmod);
  }
  return entries;
}

function xmlEscape(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Image sitemap. Only lists images that a page genuinely renders, keyed off the
 * same constants the components import, so it cannot drift out of sync.
 */
function buildImageSitemap(pageImages, images) {
  const blocks = pageImages.map(({ path, images: entries }) => {
    const imageTags = entries
      .map(({ key, title, caption }) => {
        const image = images[key];
        if (!image) throw new Error(`PAGE_IMAGES references unknown image key "${key}"`);
        return [
          '    <image:image>',
          `      <image:loc>${SITE_URL}${image.src}</image:loc>`,
          `      <image:title>${xmlEscape(title)}</image:title>`,
          `      <image:caption>${xmlEscape(caption)}</image:caption>`,
          '    </image:image>',
        ].join('\n');
      })
      .join('\n');

    return [
      '  <url>',
      `    <loc>${SITE_URL}${path}</loc>`,
      imageTags,
      '  </url>',
    ].join('\n');
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  GENERATED FILE — do not edit by hand.
  Run \`npm run sitemap\` (or \`npm run build\`) to regenerate from
  PAGE_IMAGES in src/constants/marketingImages.ts.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

${blocks.join('\n\n')}

</urlset>
`;
}

async function main() {
  const [{ SERVICE_LOCATIONS }, { SERVICE_LANDING_PAGES }, { PAGE_IMAGES, MARKETING_IMAGES }] =
    await Promise.all([
      importTypeScript('src/constants/serviceLocations.ts'),
      importTypeScript('src/constants/serviceLandingPages.ts'),
      importTypeScript('src/constants/marketingImages.ts'),
    ]);

  const today = new Date().toISOString().slice(0, 10);
  const existing = await readExistingLastmods();

  const servicePages = SERVICE_LANDING_PAGES.map((page) => ({
    path: `/services/${page.slug}`,
    priority: '0.9',
    changefreq: 'monthly',
  }));

  const hubPage = { path: '/service-areas', priority: '0.9', changefreq: 'monthly' };

  const locationPages = SERVICE_LOCATIONS.map((location) => ({
    path: `/service-areas/${location.slug}`,
    // The home city gets the strongest signal; the rest sit just below the
    // core service pages.
    priority: location.isHomeBase ? '0.9' : '0.8',
    changefreq: 'monthly',
  }));

  const pages = [
    ...STATIC_PAGES.slice(0, 4),
    ...servicePages,
    hubPage,
    ...locationPages,
    ...STATIC_PAGES.slice(4),
  ];

  const seen = new Set();
  const body = pages
    .filter((page) => {
      if (seen.has(page.path)) return false;
      seen.add(page.path);
      return true;
    })
    .map((page) => urlEntry(page, existing.get(`${SITE_URL}${page.path}`) ?? today))
    .join('\n\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  GENERATED FILE — do not edit by hand.
  Run \`npm run sitemap\` (or \`npm run build\`) to regenerate from
  src/constants/serviceLocations.ts and src/constants/serviceLandingPages.ts.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${body}

</urlset>
`;

  await writeFile(SITEMAP_PATH, xml, 'utf-8');
  console.log(`[sitemap] wrote ${seen.size} URLs to public/sitemap.xml`);

  await writeFile(IMAGE_SITEMAP_PATH, buildImageSitemap(PAGE_IMAGES, MARKETING_IMAGES), 'utf-8');
  const imageCount = PAGE_IMAGES.reduce((sum, page) => sum + page.images.length, 0);
  console.log(
    `[sitemap] wrote ${imageCount} images across ${PAGE_IMAGES.length} pages to public/sitemap-images.xml`,
  );
}

main().catch((error) => {
  console.error('[sitemap] generation failed:', error);
  process.exit(1);
});
