import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// vite-react-ssg adds a <link rel="modulepreload"> for every chunk a page can
// ever reach, including ones behind `await import('jspdf')` that only load when
// someone clicks "download PDF". The browser fetches those at high priority
// ahead of first paint. This drops the preload links for third-party libraries
// that are only loaded on demand (and the chunks only they use). Nothing about
// loading changes otherwise: the dynamic import still fetches them when called.

interface ManifestChunk {
  file: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
}

type Manifest = Record<string, ManifestChunk>;

const isOnDemandLibrary = (key: string) => key.startsWith('node_modules/');

/** Files reachable from the entry points without going through an on-demand library import. */
export function eagerFiles(manifest: Manifest): Set<string> {
  const seen = new Set<string>();
  const visit = (key: string) => {
    const chunk = manifest[key];
    if (!chunk || seen.has(key)) return;
    seen.add(key);
    chunk.imports?.forEach(visit);
    // Lazy routes and lazy components are app code that the page may have
    // rendered on the server, so they still need to be ready for hydration.
    chunk.dynamicImports?.filter(dep => !isOnDemandLibrary(dep)).forEach(visit);
  };
  Object.keys(manifest)
    .filter(key => manifest[key].isEntry)
    .forEach(visit);
  return new Set([...seen].map(key => manifest[key].file));
}

const PRELOAD_LINK = /<link\b[^>]*\brel="modulepreload"[^>]*>/g;

export function stripLazyPreloads(html: string, manifest: Manifest, base = '/'): string {
  const eager = eagerFiles(manifest);
  const known = new Set(Object.values(manifest).map(chunk => chunk.file));
  return html.replace(PRELOAD_LINK, link => {
    const href = /\bhref="([^"]+)"/.exec(link)?.[1];
    if (!href || !href.startsWith(base)) return link;
    const file = href.slice(base.length);
    // Only remove links we can positively identify as on-demand.
    return known.has(file) && !eager.has(file) ? '' : link;
  });
}

/** `ssgOptions.onPageRendered` hook. The client manifest is on disk by the time pages render. */
export function createLazyPreloadFilter(outDir = 'dist') {
  let manifest: Manifest | undefined;
  return (_route: string, html: string): string => {
    manifest ??= JSON.parse(
      readFileSync(join(process.cwd(), outDir, '.vite', 'manifest.json'), 'utf8'),
    ) as Manifest;
    return stripLazyPreloads(html, manifest);
  };
}
