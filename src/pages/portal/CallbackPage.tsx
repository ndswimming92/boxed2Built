import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageLoader from '../../components/ui/PageLoader';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/authorization';
import { runPortalPostLogin, type PortalLoginSource } from '../../services/portalPostLoginService';
import { resolveNextPath } from '../../utils/portalNextPath';

const PORTAL_POST_LOGIN_PATH_KEY = 'portalPostLoginPath';

export default function PortalCallbackPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const hasTrackedLogin = useRef(false);

  const callbackError = useMemo(() => {
    const errorDescription = searchParams.get('error_description');
    const oauthError = searchParams.get('error');

    if (errorDescription) return decodeURIComponent(errorDescription);
    if (oauthError) return `Authentication error: ${oauthError}`;
    return '';
  }, [searchParams]);

  // Set by sendMagicLinkForPortal on the redirect it mails. There is no way to
  // read this off the session instead: app_metadata.provider reports the
  // provider the account was created with and never changes, so a customer who
  // signed up with Google and later used a link still reports 'google'.
  const isMagicLink = searchParams.get('flow') === 'magic_link';

  useEffect(() => {
    if (loading || callbackError) return;

    if (!user) {
      // A magic link that arrives without a session is almost always the PKCE
      // case: the code verifier lives in the browser that asked for the link, so
      // opening the mail on another device cannot complete the exchange. Calling
      // that "session expired" sends people looking for a problem they do not
      // have.
      navigate(
        isMagicLink ? '/portal/login?error=magic_link_failed' : '/portal/login?error=session_expired',
        { replace: true },
      );
      return;
    }

    if (isAdminUser(user)) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    if (!hasTrackedLogin.current) {
      hasTrackedLogin.current = true;
      const source: PortalLoginSource = isMagicLink ? 'magic_link' : 'oauth_callback';
      runPortalPostLogin(user, source);
    }

    // The URL wins over storage. sessionStorage is per-tab and a mail client
    // always opens a new tab, so the value LoginPage stored is guaranteed
    // missing on every magic-link landing; Google still uses it because it
    // redirects the same tab.
    const storedPath = window.sessionStorage.getItem(PORTAL_POST_LOGIN_PATH_KEY);
    if (storedPath) {
      window.sessionStorage.removeItem(PORTAL_POST_LOGIN_PATH_KEY);
    }

    navigate(resolveNextPath(searchParams.get('next'), storedPath), { replace: true });
  }, [loading, user, callbackError, navigate, isMagicLink, searchParams]);

  if (callbackError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Sign-in failed</h1>
          <p className="mt-2 text-sm text-red-700">{callbackError}</p>
          <Link
            to="/portal/login"
            className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return <PageLoader message="Completing sign in..." />;
}
