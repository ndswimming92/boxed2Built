import React, { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageLoader from '../../components/ui/PageLoader';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/authorization';
import { customerPortalService } from '../../services/customerPortalService';
import { portalAccountLinkingService } from '../../services/portalAccountLinkingService';

const PORTAL_POST_LOGIN_PATH_KEY = 'portalPostLoginPath';

const getSafeNextPath = (value: string | null): string => {
  if (!value || !value.startsWith('/portal')) {
    return '/portal/dashboard';
  }

  return value;
};

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

  useEffect(() => {
    if (loading || callbackError) return;

    if (!user) {
      navigate('/portal/login?error=session_expired', { replace: true });
      return;
    }

    if (isAdminUser(user)) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    if (!hasTrackedLogin.current) {
      hasTrackedLogin.current = true;

      void (async () => {
        const userEmail = user.email?.toLowerCase() ?? '';
        const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
        let linked = false;

        if (userEmail.endsWith('@gmail.com')) {
          try {
            const result = await portalAccountLinkingService.autoLinkGmailAccount(userEmail);
            linked = result.status === 'linked' || result.status === 'already_linked';
          } catch {
            // best-effort auto-linking; do not block sign-in flow
          }
        }

        if (!linked && userEmail) {
          try {
            await portalAccountLinkingService.autoCreatePortalCustomer(userEmail, fullName);
          } catch {
            // best-effort auto-create; do not block sign-in flow
          }
        }

        await customerPortalService.trackFunnelEvent('login', {
          source: 'oauth_callback',
        }).catch(() => undefined);
      })();
    }

    const storedPath = window.sessionStorage.getItem(PORTAL_POST_LOGIN_PATH_KEY);
    if (storedPath) {
      window.sessionStorage.removeItem(PORTAL_POST_LOGIN_PATH_KEY);
    }

    navigate(getSafeNextPath(storedPath), { replace: true });
  }, [loading, user, callbackError, navigate]);

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
