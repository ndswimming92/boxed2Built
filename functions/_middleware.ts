// Markdown for Agents: content negotiation on Cloudflare Pages.
//
// A request that sends `Accept: text/markdown` gets the markdown twin of the
// page (about.md, written next to about.html by scripts/generate-markdown.mjs)
// at the same URL. Everything else, browsers included, gets the HTML exactly as
// before. Pages with no markdown twin (admin, portal, 404, checkout results)
// fall through to HTML too.
//
// dist/_routes.json (written by scripts/prepare-cloudflare.mjs) keeps this
// function off static files so they do not count against the Functions quota.
import { estimateTokens, markdownPathFor, prefersMarkdown } from '../cloudflare/markdownNegotiation.ts';

interface PagesContext {
  request: Request;
  env: { ASSETS: { fetch(request: Request): Promise<Response> } };
  next(): Promise<Response>;
}

// Same policy as the Content-Signal line in public/robots.txt.
const CONTENT_SIGNAL = 'search=yes, ai-input=yes, ai-train=no';

function withVaryAccept(response: Response): Response {
  const copy = new Response(response.body, response);
  const vary = copy.headers.get('Vary');
  if (!vary) copy.headers.set('Vary', 'Accept');
  else if (!/(^|,)\s*(accept|\*)\s*(,|$)/i.test(vary)) copy.headers.set('Vary', `${vary}, Accept`);
  return copy;
}

async function markdownResponse({ request, env }: PagesContext): Promise<Response | null> {
  const url = new URL(request.url);
  const markdownPath = markdownPathFor(url.pathname);
  if (!markdownPath) return null;

  const asset = await env.ASSETS.fetch(new Request(new URL(markdownPath, url), request));
  if (asset.status !== 200 && asset.status !== 304) return null;

  // Read the body (a few KB) to report its size; Pages sends no Content-Length.
  const text = asset.status === 200 && request.method === 'GET' ? await asset.text() : null;
  const response = withVaryAccept(text === null ? asset : new Response(text, asset));
  response.headers.set('Content-Type', 'text/markdown; charset=utf-8');
  response.headers.set('Content-Signal', CONTENT_SIGNAL);
  // Direct .md URLs are noindex so they never compete with the HTML page in
  // search. Here the markdown is answering for the canonical URL itself.
  response.headers.delete('X-Robots-Tag');
  if (text !== null) response.headers.set('X-Markdown-Tokens', String(estimateTokens(text.length)));
  return response;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request } = context;
  const readOnly = request.method === 'GET' || request.method === 'HEAD';

  if (readOnly && prefersMarkdown(request.headers.get('Accept'))) {
    const markdown = await markdownResponse(context);
    if (markdown) return markdown;
  }

  const response = await context.next();
  // Tell caches the HTML at this URL is one of two representations.
  const type = response.headers.get('Content-Type') ?? '';
  return type.includes('text/html') ? withVaryAccept(response) : response;
};
