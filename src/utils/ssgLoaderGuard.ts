// Note: `window.__VITE_REACT_SSG_HASH__` and
// `window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__` are declared globally by
// vite-react-ssg's client entry; despite the non-optional types they are only
// set at runtime in production SSG builds, so we still guard against absence.

/**
 * vite-react-ssg attaches a loader to every route on the client that fetches
 * `static-loader-data-manifest-<hash>.json` and calls `.json()` on the
 * response without checking it. When the file is missing (e.g. a tab that was
 * opened before a redeploy, so its hash points at deleted files), the Netlify
 * SPA fallback returns index.html with a 200 and the loader throws
 * `Unexpected token '<' ... is not valid JSON`, killing every subsequent
 * client-side navigation with react-router's error screen.
 *
 * Fetching the manifest ourselves with proper error handling and seeding the
 * window global vite-react-ssg reads means its own unguarded fetch never runs.
 * On failure we seed an empty manifest: route loader data then resolves to
 * null and pages fall back to fetching their own data client-side.
 */
export async function primeStaticLoaderManifest(): Promise<void> {
  if (typeof window === 'undefined') return;

  const hash = window.__VITE_REACT_SSG_HASH__;
  if (!hash || window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__) return;

  try {
    const response = await fetch(`/static-loader-data-manifest-${hash}.json`);
    const contentType = response.headers.get('content-type') ?? '';

    if (response.ok && contentType.includes('json')) {
      window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__ = await response.json();
      return;
    }
  } catch {
    // Network error — fall through to the empty manifest below.
  }

  window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__ = {};
}
