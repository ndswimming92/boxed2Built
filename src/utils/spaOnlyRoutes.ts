/**
 * Routes that are never pre-rendered. The host answers them with the home
 * page's index.html (see public/_redirects and cloudflare/_redirects) and the
 * client router takes over.
 *
 * Keep in step with the exclusions in `ssgOptions.includedRoutes` in
 * vite.config.ts and the 200-rewrites in both _redirects files.
 *
 * Kept free of React and import.meta.env so `node --test` can import it.
 */
// Answered both bare and with a sub-path.
const SECTIONS = ['/admin', '/portal'];
// Answered with a sub-path only, so the bare path is still the pre-rendered 404.
const SUB_PATH_ONLY = ['/go', '/r', '/pay'];

export function isSpaOnlyPath(pathname: string): boolean {
  // /R/* is rewritten as well as /r/*, so match without regard to case.
  const path = pathname.toLowerCase();
  if (path === '/book') return true;
  if (SECTIONS.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) return true;
  return SUB_PATH_ONLY.some(prefix => path.startsWith(`${prefix}/`));
}
