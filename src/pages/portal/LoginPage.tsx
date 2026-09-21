import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Home, KeyRound, LogIn, Mail, MailCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/authorization';
import { isPasskeySupported } from '../../services/passkeyService';
import { runPortalPostLogin } from '../../services/portalPostLoginService';
import { getSafeNextPath } from '../../utils/portalNextPath';
import {
  describeMagicLinkError,
  isEmailRateLimited,
  isKnownMagicLinkCode,
  isMagicLinkSendBlocked,
  isProbablyEmail,
  normalizeEmail,
  parseEmailRateLimitSeconds,
} from '../../utils/magicLinkErrors';

const PORTAL_BENEFITS = [
  'Track your project timeline and job status updates',
  'Review invoices, balances, and payment history',
  'Download important documents and receipts anytime',
];

const PORTAL_POST_LOGIN_PATH_KEY = 'portalPostLoginPath';

/** Matches Supabase's own per-address cooldown; the server's number wins when it sends one. */
const RESEND_COOLDOWN_SECONDS = 60;

const OTP_LENGTH = 6;

export default function PortalLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [passkeysAvailable, setPasskeysAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'form' | 'sent'>('form');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const {
    user,
    signInWithGoogleForPortal,
    signInWithPasskeyForPortal,
    sendMagicLinkForPortal,
    verifyPortalEmailOtp,
  } = useAuth();

  // Feature-detect after mount, not during render — the prerender pass has a
  // mocked DOM that would answer for a browser that is not there.
  useEffect(() => {
    setPasskeysAvailable(isPasskeySupported());
  }, []);

  // Same reason as above: the admin invite deep-links ?email=, and reading
  // search params during render is not safe under the prerender pass.
  useEffect(() => {
    const invited = searchParams.get('email');
    if (invited) setEmail(invited);
  }, [searchParams]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;

    const timer = window.setTimeout(() => setCooldownSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!user) return;

    const nextPath = getSafeNextPath(searchParams.get('next'));

    if (isAdminUser(user)) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    navigate(nextPath, { replace: true });
  }, [user, navigate, searchParams]);

  useEffect(() => {
    const errorDescription = searchParams.get('error_description');
    const errorCode = searchParams.get('error_code');
    const oauthError = searchParams.get('error');

    if (oauthError === 'session_expired') {
      setError('Your session expired. Please sign in again.');
      return;
    }

    // Set by CallbackPage, and by Supabase when a link is stale. Both land on
    // the same copy, which names the 6-digit code as the way through — the
    // client runs PKCE, so a link is only usable in the browser that asked for
    // it and "try the link again" is not advice that can work.
    if (oauthError === 'magic_link_failed' || errorCode === 'otp_expired' || oauthError === 'otp_expired') {
      setError(describeMagicLinkError({ code: 'magic_link_failed' }));
      return;
    }

    if (isKnownMagicLinkCode(errorCode)) {
      setError(describeMagicLinkError({ code: errorCode }));
      return;
    }

    if (errorDescription) {
      setError(decodeURIComponent(errorDescription));
      return;
    }

    if (oauthError) {
      setError(`Authentication error: ${oauthError}${errorCode ? ` (${errorCode})` : ''}`);
      return;
    }

    if (errorCode) {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  const sendLink = async (address: string) => {
    setError('');
    setLoading(true);

    const nextPath = getSafeNextPath(searchParams.get('next'));
    const { error: sendError } = await sendMagicLinkForPortal(address, nextPath);

    setLoading(false);

    // Nothing was sent and nothing will be until someone changes a setting or
    // fixes the address, so saying "check your email" would just waste their
    // time. Neither case reveals whether the address belongs to a customer.
    if (sendError && isMagicLinkSendBlocked(sendError)) {
      setError(describeMagicLinkError(sendError));
      return;
    }

    if (sendError && isEmailRateLimited(sendError)) {
      setCooldownSeconds(parseEmailRateLimitSeconds(sendError.message) ?? RESEND_COOLDOWN_SECONDS);
      setError(describeMagicLinkError(sendError));
      setMode('sent');
      return;
    }

    // Every other outcome — delivered, or failed for a reason specific to this
    // address — shows the identical card. A known and an unknown address have
    // to be indistinguishable here, or the form becomes a free way to test
    // whether someone is a customer.
    setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    setMode('sent');
  };

  const handleMagicLinkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const address = normalizeEmail(email);
    if (!isProbablyEmail(address)) {
      setError('Enter a valid email address.');
      return;
    }

    setEmail(address);
    await sendLink(address);
  };

  const handleResend = async () => {
    if (cooldownSeconds > 0 || loading) return;
    await sendLink(normalizeEmail(email));
  };

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const code = otpCode.replace(/\D/g, '');
    if (code.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code from the email.`);
      return;
    }

    setVerifying(true);
    const nextPath = getSafeNextPath(searchParams.get('next'));
    const { error: verifyError, user: signedInUser } = await verifyPortalEmailOtp(normalizeEmail(email), code);

    if (verifyError) {
      setError(describeMagicLinkError(verifyError));
      setVerifying(false);
      return;
    }

    if (!signedInUser) {
      setError(describeMagicLinkError({}));
      setVerifying(false);
      return;
    }

    // Same reasoning as the passkey path below: context `user` lags this
    // promise by an awaited organization fetch, so the pipeline runs here with
    // the user we were handed rather than through /portal/callback.
    runPortalPostLogin(signedInUser, 'magic_link');

    if (isAdminUser(signedInUser)) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    navigate(nextPath, { replace: true });
  };

  const handlePasskeySignIn = async () => {
    setError('');
    setLoading(true);

    const nextPath = getSafeNextPath(searchParams.get('next'));
    const { error, user: signedInUser } = await signInWithPasskeyForPortal();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!signedInUser) {
      // A dismissed prompt. Nothing to say; just give the button back.
      setLoading(false);
      return;
    }

    // Google sign-in reaches this pipeline by redirecting through
    // /portal/callback. A passkey never leaves the page, and routing there
    // would misfire anyway: AuthContext sets `user` only after an awaited
    // organization fetch, so the callback page would still see a null user and
    // bounce to "session expired". Run it here with the user we were handed.
    runPortalPostLogin(signedInUser, 'passkey');

    if (isAdminUser(signedInUser)) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    navigate(nextPath, { replace: true });
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    const nextPath = getSafeNextPath(searchParams.get('next'));
    window.sessionStorage.setItem(PORTAL_POST_LOGIN_PATH_KEY, nextPath);

    const { error } = await signInWithGoogleForPortal();

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 px-4 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row lg:items-stretch">
        <section className="flex-1 rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-lg backdrop-blur-sm">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            <ShieldCheck className="h-4 w-4" />
            Secure Customer Access
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome to the Client Portal</h1>
          <p className="mt-3 max-w-xl text-slate-600">
            Sign in, or create an account in one step — we&rsquo;ll email you a secure link. No password to remember.
          </p>

          <ul className="mt-6 space-y-3">
            {PORTAL_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 text-sm text-slate-700">
                <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Home className="h-4 w-4" />
              Back to Homepage
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Need help? Contact us
            </Link>
          </div>
        </section>

        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-xl lg:max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              {mode === 'sent' ? (
                <MailCheck className="h-8 w-8 text-blue-600" />
              ) : (
                <LogIn className="h-8 w-8 text-blue-600" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'sent' ? 'Check your email' : 'Client Portal'}
            </h2>
            <p className="mt-2 text-slate-600">
              {mode === 'sent' ? (
                <>
                  If that address can receive mail, we just sent a sign-in link to{' '}
                  <span className="font-semibold text-slate-900">{email}</span>. It expires in 15 minutes.
                </>
              ) : (
                <>Enter your email and we&rsquo;ll send you a sign-in link. New here? The same link creates your account.</>
              )}
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4" role="alert" aria-live="polite">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {mode === 'form' ? (
            <form onSubmit={handleMagicLinkSubmit} className="mb-6">
              <label htmlFor="portal-email" className="mb-2 block text-sm font-semibold text-slate-700">
                Email address
              </label>
              <input
                id="portal-email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mb-4 w-full rounded-lg border-2 border-slate-300 px-4 py-3 text-slate-900 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3.5 font-semibold text-white transition-all hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Mail className="h-5 w-5" />
                {loading ? 'Sending...' : 'Email me a sign-in link'}
              </button>
            </form>
          ) : (
            <div className="mb-6 space-y-4">
              <form onSubmit={handleOtpSubmit}>
                <label htmlFor="portal-otp" className="mb-2 block text-sm font-semibold text-slate-700">
                  Or enter the {OTP_LENGTH}-digit code from the email
                </label>
                <p className="mb-2 text-xs text-slate-500">
                  Use the code if you opened the email on a different device — a sign-in link only works in the
                  browser that requested it.
                </p>
                <input
                  id="portal-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={OTP_LENGTH}
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="mb-4 w-full rounded-lg border-2 border-slate-300 px-4 py-3 text-center font-mono text-lg tracking-[0.4em] text-slate-900 transition-all placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200"
                />
                <button
                  type="submit"
                  disabled={verifying || otpCode.length !== OTP_LENGTH}
                  className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3.5 font-semibold text-white transition-all hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogIn className="h-5 w-5" />
                  {verifying ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldownSeconds > 0 || loading}
                  className="font-semibold text-blue-700 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : "Didn't get it? Resend"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('form');
                    setOtpCode('');
                    setError('');
                  }}
                  className="font-semibold text-slate-600 transition hover:text-slate-800"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}

          <div className="mb-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">or</span>
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          </div>

          {passkeysAvailable && (
            <button
              type="button"
              onClick={handlePasskeySignIn}
              disabled={loading}
              className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg border-2 border-slate-300 bg-white px-4 py-3.5 font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <KeyRound className="h-5 w-5" />
              Sign in with a passkey
            </button>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border-2 border-slate-300 bg-white px-4 py-3.5 font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>

          <Link
            to="/"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to main site
          </Link>
        </section>
      </div>
    </div>
  );
}
