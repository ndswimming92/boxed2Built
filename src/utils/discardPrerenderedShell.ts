import { isSpaOnlyPath } from './spaOnlyRoutes.ts';

interface ShellRoot {
  hasAttribute(name: string): boolean;
  removeAttribute(name: string): void;
  replaceChildren(): void;
}

interface HydrationWindow {
  __staticRouterHydrationData?: unknown;
}

/**
 * On a route that is never pre-rendered, the host serves the HOME page's
 * pre-rendered HTML. vite-react-ssg sees `data-server-rendered="true"` on it
 * and hydrates, so React compares the admin/portal screen with home-page
 * markup, throws minified errors #418 and #422, and discards the server HTML
 * and re-renders from scratch. It also flashes the home page until then.
 *
 * Dropping the marker, the stale markup and the home page's router data before
 * the app starts makes the library take its ordinary client-render path.
 * Pre-rendered routes are left alone and still hydrate.
 *
 * Returns true when it removed anything.
 */
export function discardPrerenderedShell(
  pathname: string,
  root: ShellRoot | null,
  win: HydrationWindow,
): boolean {
  if (!root || !isSpaOnlyPath(pathname)) return false;
  if (!root.hasAttribute('data-server-rendered')) return false;

  root.removeAttribute('data-server-rendered');
  root.replaceChildren();
  delete win.__staticRouterHydrationData;
  return true;
}
