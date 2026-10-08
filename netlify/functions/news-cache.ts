/**
 * A shared, short-lived cache in front of the two public reads the /news page
 * makes, so a burst of visitors costs the database one answer instead of one
 * each.
 *
 * Every visitor sees the same published, unexpired sales, and they change about
 * once a day. Left alone, each page view asked Supabase directly; on the free
 * plan, under a rush, that shares limits with the quote form, the admin area
 * and the customer portal. Here the response carries cache headers, so
 * Netlify's CDN answers repeat requests itself.
 *
 * Nothing about the data changes: this forwards the same read-only requests the
 * browser used to send, with the anonymous key, and returns the same JSON. If
 * this function is missing or failing, the page falls back to asking Supabase
 * directly (see src/services/newsService.ts), so it can only help.
 */

const MOUNT = '/api/news-cache';

/** The only two reads the public page makes. Anything else is refused. */
const ALLOWED_PATHS = new Set(['/rest/v1/news_items', '/rest/v1/rpc/news_sale_filter_options']);

/**
 * The query parameters the page uses. Refusing the rest keeps this from being a
 * general-purpose proxy, and stops random parameters from being used to dodge
 * the cache and reach the database every time.
 */
const ALLOWED_PARAMS = new Set([
  'select',
  'status',
  'topic',
  'store_slug',
  'sale_scope',
  'furniture_types',
  'published_at',
  'or',
  'order',
  'limit',
]);

const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 2000;
const UPSTREAM_TIMEOUT_MS = 8000;

/**
 * Fresh for a minute; for five more minutes a stale copy is served while a new
 * one is fetched; and if the database is down, a copy up to an hour old is
 * served rather than an error. So a newly approved sale shows up within about a
 * minute, and the page stays up if Supabase does not.
 */
const CDN_CACHE = 'public, s-maxage=60, stale-while-revalidate=300, stale-if-error=3600';
/** The browser keeps it briefly so filter clicks and the back button are instant. */
const BROWSER_CACHE = 'public, max-age=30';

/**
 * 503 is what this answers when Supabase itself is failing or slow. The page
 * reads it as "do not also ask Supabase directly", which would only add load to
 * a database that is already struggling.
 */
function refuse(status: number, message: string): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return refuse(405, 'Method not allowed');

  const url = new URL(request.url);
  const path = url.pathname.startsWith(MOUNT) ? url.pathname.slice(MOUNT.length) : '';
  if (!ALLOWED_PATHS.has(path)) return refuse(404, 'Not found');
  if (url.search.length > MAX_QUERY_LENGTH) return refuse(400, 'Query too long');

  for (const [name, value] of url.searchParams) {
    if (!ALLOWED_PARAMS.has(name)) return refuse(400, `Unsupported parameter: ${name}`);
    if (name === 'limit' && !(Number(value) >= 1 && Number(value) <= MAX_LIMIT)) {
      return refuse(400, 'Unsupported limit');
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return refuse(500, 'Not configured');

  // Always the anonymous key, never the caller's: a cached answer is shared by
  // everyone, so it must be exactly what an anonymous visitor would be shown.
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: 'application/json',
  };
  // The first page asks for the total. Nothing else is forwarded.
  if (request.headers.get('prefer') === 'count=exact') headers.Prefer = 'count=exact';

  let upstream: Response;
  try {
    upstream = await fetch(`${supabaseUrl.replace(/\/+$/, '')}${path}${url.search}`, {
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return refuse(503, 'Upstream unavailable');
  }

  // Errors are never cached, so one bad moment cannot be served to everyone.
  if (!upstream.ok) return refuse(503, 'Upstream error');

  const responseHeaders = new Headers({
    'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    'Cache-Control': BROWSER_CACHE,
    'Netlify-CDN-Cache-Control': CDN_CACHE,
    // The total only comes back when it was asked for, so the two are kept apart.
    'Netlify-Vary': 'header=prefer',
    'X-Robots-Tag': 'noindex',
  });
  const contentRange = upstream.headers.get('content-range');
  if (contentRange) responseHeaders.set('Content-Range', contentRange);

  return new Response(await upstream.text(), { status: 200, headers: responseHeaders });
}

export const config = { path: `${MOUNT}/*` };
