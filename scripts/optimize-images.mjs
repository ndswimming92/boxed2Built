#!/usr/bin/env node
// Converts the source marketing photography in assets/images-src/ into the
// responsive WebP variants that ship in public/images/.
//
// WHY THIS EXISTS
// The marketing images were originally committed as full-size PNGs (1254x1254
// photographs, ~2 MB each — 18 MB in total, 3.85 MB of it on the homepage
// alone). PNG is a lossless format meant for flat graphics; for photographs it
// is the worst possible choice. The same image as WebP is ~93% smaller.
//
// HOW TO USE IT
// This is a content operation, not a build step, so sharp is deliberately NOT
// a project dependency — pulling a native binary into every Netlify deploy to
// serve a script that runs a few times a year is a bad trade. Install it just
// for the run:
//
//     npm install --no-save sharp
//     npm run images
//
// Drop new source photography in assets/images-src/, run the above, and commit
// the generated .webp files. Sources stay out of public/ so they are never
// published — only the optimized variants ship.
//
// OUTPUT
// For each source image, three widths are emitted so a phone never downloads a
// desktop-sized file:
//     <name>-640.webp    (small screens)
//     <name>-960.webp    (phones at DPR 2, desktop at DPR 1-2)
//     <name>.webp        (full size, capped at MAX_WIDTH — also the lightbox)
// Call sites reference these through a srcset. See src/constants/marketingImages.ts.

import { readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'assets', 'images-src');
const OUT_DIR = join(ROOT, 'public', 'images', 'marketing-images');

// Widths emitted for every source image. These are chosen from how the images
// actually render: roughly 450 CSS px on desktop and 350 on mobile. A phone at
// device-pixel-ratio 2 therefore needs ~700px and would otherwise be forced up
// to the full-size file, so the middle width exists specifically for it.
const SMALL_WIDTH = 640;
const MEDIUM_WIDTH = 960;
/** Nothing on the site displays these larger than this, so don't ship more. */
const MAX_WIDTH = 1254;
const QUALITY = 80;

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error(
    '\n[images] sharp is not installed.\n' +
      '[images] It is intentionally not a project dependency — install it for this run:\n\n' +
      '    npm install --no-save sharp && npm run images\n',
  );
  process.exit(1);
}

if (!existsSync(SRC_DIR)) {
  console.error(`[images] no source directory at ${SRC_DIR}`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const sources = (await readdir(SRC_DIR)).filter((name) =>
  ['.png', '.jpg', '.jpeg'].includes(extname(name).toLowerCase()),
);

if (sources.length === 0) {
  console.log('[images] no source images found — nothing to do');
  process.exit(0);
}

let totalIn = 0;
let totalOut = 0;
let filesWritten = 0;

for (const name of sources) {
  const srcPath = join(SRC_DIR, name);
  const stem = basename(name, extname(name));
  const inBytes = (await stat(srcPath)).size;
  totalIn += inBytes;

  const image = sharp(srcPath);
  const { width: srcWidth = MAX_WIDTH } = await image.metadata();

  const targets = [
    { suffix: `-${SMALL_WIDTH}`, width: Math.min(SMALL_WIDTH, srcWidth) },
    { suffix: `-${MEDIUM_WIDTH}`, width: Math.min(MEDIUM_WIDTH, srcWidth) },
    { suffix: '', width: Math.min(MAX_WIDTH, srcWidth) },
  ];

  const written = [];
  for (const { suffix, width } of targets) {
    const outPath = join(OUT_DIR, `${stem}${suffix}.webp`);
    await sharp(srcPath)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(outPath);
    const outBytes = (await stat(outPath)).size;
    totalOut += outBytes;
    filesWritten += 1;
    written.push(`${basename(outPath)} ${(outBytes / 1024).toFixed(0)}KB`);
  }

  console.log(
    `[images] ${name} (${(inBytes / 1048576).toFixed(2)}MB) -> ${written.join(', ')}`,
  );
}

const saved = 100 - (totalOut / totalIn) * 100;
console.log(
  `\n[images] ${sources.length} source images: ` +
    `${(totalIn / 1048576).toFixed(1)}MB -> ${(totalOut / 1048576).toFixed(2)}MB ` +
    `(${saved.toFixed(0)}% smaller across ${filesWritten} generated files)`,
);
