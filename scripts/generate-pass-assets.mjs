#!/usr/bin/env node
// Generates the Apple Wallet pass artwork from the Boxed2Built logo and emits
// it as a TypeScript module of base64 constants.
//
// WHY BASE64 RATHER THAN FILES
// Supabase edge functions have no reliable way to ship and read binary assets
// alongside the handler, and a pass without icon.png is rejected by iOS with no
// error message at all. Inlining the bytes removes that whole failure mode; the
// artwork is a few KB and changes roughly never.
//
// HOW TO USE IT
// Same convention as scripts/optimize-images.mjs: sharp is a native binary and
// has no business in every Netlify deploy, so it is installed only for the run.
//
//     npm install --no-save sharp
//     node scripts/generate-pass-assets.mjs
//
// Then commit supabase/functions/_shared/pass-assets/index.ts.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'public/boxed2built_logo.png');
const OUT = resolve(root, 'supabase/functions/_shared/pass-assets/index.ts');

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error(
    '\n[pass-assets] sharp is not installed.\n' +
      '    npm install --no-save sharp && node scripts/generate-pass-assets.mjs\n',
  );
  process.exit(1);
}

// Apple's sizes. icon is mandatory — Wallet shows it in the pass list and in
// notifications, and its absence is what most silently-rejected passes are.
const TARGETS = [
  { name: 'icon.png', width: 29, height: 29 },
  { name: 'icon@2x.png', width: 58, height: 58 },
  { name: 'icon@3x.png', width: 87, height: 87 },
  { name: 'logo.png', width: 50, height: 50 },
  { name: 'logo@2x.png', width: 100, height: 100 },
  { name: 'logo@3x.png', width: 150, height: 150 },
];

const source = await readFile(SOURCE);
const entries = [];

for (const { name, width, height } of TARGETS) {
  const png = await sharp(source)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  entries.push({ name, base64: png.toString('base64'), bytes: png.length });
  console.log(`[pass-assets] ${name.padEnd(14)} ${width}x${height}  ${png.length} bytes`);
}

const body = `// GENERATED FILE — do not edit by hand.
// Regenerate with: npm install --no-save sharp && node scripts/generate-pass-assets.mjs
//
// Apple Wallet pass artwork, inlined as base64 because an edge function cannot
// reliably read binary files shipped beside it, and a pass missing icon.png is
// rejected by iOS without an error.
import type { PassFiles } from '../pkpass.ts';

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const ENCODED: Record<string, string> = {
${entries.map((e) => `  ${JSON.stringify(e.name)}:\n    '${e.base64}',`).join('\n')}
};

export const PASS_ASSETS: PassFiles = Object.fromEntries(
  Object.entries(ENCODED).map(([name, base64]) => [name, decode(base64)]),
);
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, body);
console.log(`\n[pass-assets] wrote ${OUT}`);
