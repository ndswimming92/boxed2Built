import { useEffect, useState } from 'react';
import { isRouteErrorResponse, useLocation, useRouteError } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import PageLoader from './ui/PageLoader';

const RELOAD_GUARD_KEY = 'routeErrorAutoReloadAt';
const RELOAD_GUARD_WINDOW_MS = 15_000;

function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * After a redeploy, tabs opened against the previous build reference hashed
 * files (JS chunks, static loader data) that no longer exist. Those requests
 * come back as the SPA fallback HTML, which surfaces as a JSON SyntaxError or
 * a failed dynamic import on the next navigation. A full reload picks up the
 * new build and fixes all of them.
 */
function isStaleDeploymentError(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  const message = getErrorMessage(error);
  return /is not valid JSON|Unexpected token '<'|dynamically imported module|Importing a module script|ChunkLoadError/i.test(
    message,
  );
}

export default function RouteErrorPage() {
  const error = useRouteError();
  const location = useLocation();
  const [autoReloading, setAutoReloading] = useState(false);

  useEffect(() => {
    console.error('Route error:', error);

    if (!isStaleDeploymentError(error)) return;

    // Only auto-reload once per window so a genuinely broken page can't loop.
    let lastReloadAt = 0;
    try {
      lastReloadAt = Number(sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0;
    } catch {
      // sessionStorage unavailable — still reload, the guard just won't persist.
    }
    if (Date.now() - lastReloadAt < RELOAD_GUARD_WINDOW_MS) return;

    try {
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    } catch {
      // Ignore storage failures.
    }
    setAutoReloading(true);
    window.location.reload();
  }, [error]);

  if (autoReloading) {
    return <PageLoader message="Updating to the latest version..." />;
  }

  const homeHref = location.pathname.startsWith('/admin')
    ? '/admin/dashboard'
    : location.pathname.startsWith('/portal')
      ? '/portal/dashboard'
      : '/';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">
            The page hit an unexpected error. Reloading usually fixes this — it can happen when a
            new version of the site was just published.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload page
            </button>
            <a
              href={homeHref}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Go to {homeHref === '/' ? 'home' : 'dashboard'}
            </a>
          </div>
          <details className="mt-6 text-left">
            <summary className="text-sm text-gray-400 cursor-pointer">Technical details</summary>
            <pre className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
              {getErrorMessage(error)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
