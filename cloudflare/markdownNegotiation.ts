// Content negotiation for "Markdown for Agents".
//
// Pure helpers, kept apart from functions/_middleware.ts so they can be unit
// tested under node (tests/unit/markdownNegotiation.test.ts) without a
// Cloudflare runtime.

/** q-value of a media type in an Accept header, or null when it is not listed. */
function qualityOf(accept: string, mediaType: string): number | null {
  for (const part of accept.split(',')) {
    const [type, ...params] = part.split(';').map(piece => piece.trim().toLowerCase());
    if (type !== mediaType) continue;
    const q = params.find(param => param.startsWith('q='));
    if (!q) return 1;
    const value = Number.parseFloat(q.slice(2));
    return Number.isFinite(value) ? value : 0;
  }
  return null;
}

/**
 * True when the client asked for markdown and likes it at least as much as
 * HTML. Browsers never list text/markdown, and a wildcard alone does not opt
 * in, so HTML stays the default for everything that did not ask by name.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;
  const markdown = qualityOf(accept, 'text/markdown');
  if (markdown === null || markdown <= 0) return false;
  const html = qualityOf(accept, 'text/html');
  return html === null || markdown >= html;
}

/**
 * Where the markdown twin of a page lives, or null when the path cannot have
 * one. The build writes about.md next to about.html (scripts/
 * generate-markdown.mjs), so /about and /about/ both map to /about.md.
 */
export function markdownPathFor(pathname: string): string | null {
  let path = pathname;
  if (path.endsWith('/index.html')) path = path.slice(0, -'index.html'.length);
  else if (path.endsWith('.html')) path = path.slice(0, -'.html'.length);
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path === '/' || path === '') return '/index.md';
  // Anything else with an extension is a file (image, script, .md itself).
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  if (lastSegment.includes('.')) return null;
  return `${path}.md`;
}

/** Rough token count, the same chars/4 rule of thumb agents budget with. */
export function estimateTokens(byteLength: number): number {
  return Math.max(1, Math.ceil(byteLength / 4));
}
