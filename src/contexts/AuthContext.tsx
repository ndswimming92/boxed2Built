import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { logAction } from '../services/auditLogService';
import {
  getAccountLinkingError,
  getAuthorizationError,
  isAdminUser,
  isClientAuthorized,
  isUserAuthorized,
} from '../utils/authorization';
import { getSecureAuthRedirectUrl } from '../utils/authHardening';
import { getSafeNextPath } from '../utils/portalNextPath';
import { signInWithPasskey as runPasskeySignIn } from '../services/passkeyService';
import { resetPortalPostLogin } from '../services/portalPostLoginService';
import { describePasskeyError, isPasskeyCeremonyCancelled } from '../utils/passkeyErrors';
import { Organization, OrganizationRole } from '../types';
import { organizationService } from '../services/organizationService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  currentOrganization: Organization | null;
  currentRole: OrganizationRole | null;
  userOrganizations: Organization[];
  isPlatformAdmin: boolean;
  setCurrentOrganization: (org: Organization) => void;
  refreshOrganizations: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithGoogleForPortal: () => Promise<{ error: Error | null }>;
  signInWithGoogleForBooking: () => Promise<{ error: Error | null }>;
  sendMagicLinkForPortal: (email: string, nextPath: string) => Promise<{ error: Error | null }>;
  verifyPortalEmailOtp: (email: string, token: string) => Promise<{ error: Error | null; user: User | null }>;
  signInWithPasskeyForAdmin: () => Promise<{ error: Error | null }>;
  signInWithPasskeyForPortal: () => Promise<{ error: Error | null; user: User | null }>;
  getHomeRouteForUser: (authUser: User | null) => string;
  signOut: () => Promise<void>;
  signOutAllSessions: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_FLOW_KEY = 'authLoginFlow';

type AuthFlow = 'admin' | 'portal' | 'booking';

const setAuthFlow = (flow: AuthFlow) => {
  localStorage.setItem(AUTH_FLOW_KEY, flow);
};

const getAuthFlow = (): AuthFlow | null => {
  const flow = localStorage.getItem(AUTH_FLOW_KEY);
  if (flow === 'admin' || flow === 'portal' || flow === 'booking') return flow;
  return null;
};

const clearAuthFlow = () => {
  localStorage.removeItem(AUTH_FLOW_KEY);
};

/**
 * How the current sign-in was started, when knowing that later matters.
 *
 * localStorage rather than a module variable, unlike pendingPasskeyFlow: a
 * passkey ceremony never leaves the page, but an emailed link is a fresh page
 * load in a brand new tab, so nothing in memory survives to label it. This is
 * the same reason AUTH_FLOW_KEY is stored rather than held.
 *
 * Cleared by whoever reads it, and by the Google and passkey entry points, so
 * an unused link request cannot mislabel a later sign-in by another route.
 */
const AUTH_LOGIN_METHOD_KEY = 'authLoginMethod';

type AuthLoginMethod = 'magic_link';

const setAuthLoginMethod = (method: AuthLoginMethod) => {
  localStorage.setItem(AUTH_LOGIN_METHOD_KEY, method);
};

const clearAuthLoginMethod = () => {
  localStorage.removeItem(AUTH_LOGIN_METHOD_KEY);
};

const takeAuthLoginMethod = (): AuthLoginMethod | null => {
  const method = localStorage.getItem(AUTH_LOGIN_METHOD_KEY);
  clearAuthLoginMethod();
  return method === 'magic_link' ? method : null;
};

/**
 * Which surface a passkey ceremony is currently running for, or null.
 *
 * The SIGNED_IN handler cannot work this out on its own: it reads
 * app_metadata.provider, which is the provider the account was *created* with
 * and never changes. A customer who signed up with Google and later added a
 * passkey still reports 'google' there, so without this the audit log would
 * record every passkey sign-in as a Google one.
 *
 * A module variable rather than localStorage on purpose — a passkey ceremony
 * never leaves the page, so there is no redirect to survive, and nothing can
 * go stale across a reload.
 */
let pendingPasskeyFlow: AuthFlow | null = null;


const getOAuthRedirectUri = (type: AuthFlow): string => {
  if (type === 'admin') {
    return getSecureAuthRedirectUrl('/admin/login', import.meta.env.VITE_ADMIN_OAUTH_REDIRECT_URI);
  }

  if (type === 'booking') {
    return getSecureAuthRedirectUrl('/book', import.meta.env.VITE_BOOKING_OAUTH_REDIRECT_URI);
  }

  return getSecureAuthRedirectUrl('/portal/callback', import.meta.env.VITE_PORTAL_OAUTH_REDIRECT_URI);
};


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<OrganizationRole | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const getHomeRouteForUser = (authUser: User | null): string => {
    if (!authUser) return '/';
    return isAdminUser(authUser) ? '/admin/dashboard' : '/portal/dashboard';
  };

  const loadOrganizations = async (userId: string) => {
    try {
      const storedOrgId = localStorage.getItem('currentOrganizationId');
      let orgs = await organizationService.getUserOrganizations(userId);

      // An allowlisted admin who has no membership yet can self-claim one
      // server-side (the RPC enforces the allowlist), then we re-fetch.
      if (orgs.length === 0) {
        const claimed = await organizationService.claimAdminMembership();
        if (claimed) {
          orgs = await organizationService.getUserOrganizations(userId);
        }
      }

      setUserOrganizations(orgs);

      const selectedOrg = orgs.find(org => org.id === storedOrgId) || orgs[0] || null;

      if (selectedOrg) {
        const [role] = await Promise.all([
          organizationService.getUserRole(userId, selectedOrg.id),
          Promise.resolve(setCurrentOrganizationState(selectedOrg)),
        ]);
        setCurrentRole(role);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const refreshOrganizations = async () => {
    if (user) {
      await loadOrganizations(user.id);
    }
  };

  const setCurrentOrganization = (org: Organization) => {
    setCurrentOrganizationState(org);
    localStorage.setItem('currentOrganizationId', org.id);
    if (user) {
      organizationService.getUserRole(user.id, org.id).then(setCurrentRole);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setIsPlatformAdmin(session.user.app_metadata?.is_platform_admin === true);
        await loadOrganizations(session.user.id);
      }

      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        console.log('Auth state changed:', event, session?.user?.email);

        if (event === 'SIGNED_IN' && session?.user) {
          const authFlow = getAuthFlow();
          // Read and reset before any of the early returns below, so a rejected
          // sign-in cannot leave this set and mislabel the next one.
          const passkeyFlow = pendingPasskeyFlow;
          pendingPasskeyFlow = null;
          const loginMethod = takeAuthLoginMethod();

          if (authFlow === 'admin' && !isAdminUser(session.user)) {
            const authError = getAuthorizationError(session.user);
            console.error('Unauthorized admin access attempt:', authError);
            await logAction({
              actionType: 'LOGIN',
              tableName: 'auth',
              recordIdentifier: session.user.email || 'unknown',
              status: 'error',
              errorMessage: 'Unauthorized admin access attempt',
            });
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            clearAuthFlow();
            return;
          }

          if (authFlow === 'portal' && !isClientAuthorized(session.user) && !isAdminUser(session.user)) {
            await logAction({
              actionType: 'LOGIN',
              tableName: 'auth',
              recordIdentifier: session.user.email || 'unknown',
              status: 'error',
              errorMessage: 'Unauthorized portal access attempt',
            });
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            clearAuthFlow();
            return;
          }

          const accountLinkingError = getAccountLinkingError(session.user);
          if (accountLinkingError) {
            await logAction({
              actionType: 'LOGIN',
              tableName: 'auth',
              recordIdentifier: session.user.email || 'unknown',
              status: 'error',
              errorMessage: accountLinkingError,
            });
            await supabase.auth.signOut({ scope: 'global' });
            setSession(null);
            setUser(null);
            clearAuthFlow();
            return;
          }

          const provider = session.user.app_metadata?.provider;
          console.log('User signed in with provider:', provider);
          if (passkeyFlow) {
            await logAction({
              actionType: 'LOGIN',
              tableName: 'auth',
              recordIdentifier: session.user.email || 'passkey',
              status: 'success',
              metadata: { provider: 'passkey', flow: passkeyFlow },
            });
          } else if (loginMethod === 'magic_link') {
            await logAction({
              actionType: 'LOGIN',
              tableName: 'auth',
              recordIdentifier: session.user.email || 'magic-link',
              status: 'success',
              metadata: { provider: 'magic_link', flow: authFlow || 'portal' },
            });
          } else if (provider === 'google') {
            await logAction({
              actionType: 'LOGIN',
              tableName: 'auth',
              recordIdentifier: session.user.email || 'google-oauth',
              status: 'success',
              metadata: { provider: 'google', flow: authFlow || 'unknown' },
            });
          }

          clearAuthFlow();
        }

        if (session?.user && event === 'SIGNED_IN') {
          setIsPlatformAdmin(session.user.app_metadata?.is_platform_admin === true);
          await loadOrganizations(session.user.id);
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setCurrentOrganizationState(null);
          setCurrentRole(null);
          setUserOrganizations([]);
          setIsPlatformAdmin(false);
          localStorage.removeItem('currentOrganizationId');
          pendingPasskeyFlow = null;
          clearAuthLoginMethod();
          // A passkey sign-in never reloads the page, so the post-login guard
          // would otherwise still consider this user "seen" if they signed
          // straight back in and would skip the linking and funnel work.
          resetPortalPostLogin();
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: email,
          status: 'error',
          errorMessage: error.message,
        });
        return { error };
      }

      if (data.user && !isUserAuthorized(data.user)) {
        const authError = getAuthorizationError(data.user);
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: email,
          status: 'error',
          errorMessage: 'Unauthorized access attempt',
        });
        await supabase.auth.signOut();
        return { error: new Error(authError) };
      }

      await logAction({
        actionType: 'LOGIN',
        tableName: 'auth',
        recordIdentifier: email,
        status: 'success',
      });

      return { error: null };
    } catch (error) {
      await logAction({
        actionType: 'LOGIN',
        tableName: 'auth',
        recordIdentifier: email,
        status: 'error',
        errorMessage: (error as Error).message,
      });
      return { error: error as Error };
    }
  };

  /**
   * Passkey sign-in for the admin portal.
   *
   * Two things make this different from the OAuth helpers. First, the ceremony
   * resolves in place, so unlike a redirect flow the caller is still mounted and
   * has to be told what happened. Second, passkeys are discoverable credentials:
   * the authenticator offers whichever accounts it holds for this domain, which
   * on a shared device includes a customer's portal passkey. Supabase happily
   * issues that session — it knows nothing about our admin allowlist.
   *
   * So the authorization check happens here, the same way signIn() does it for
   * email+password. Without it signInWithPasskey() returns success, the login
   * page never sees an error, and its button stays on "Signing in..." forever
   * while the SIGNED_IN handler quietly tears the session down.
   */
  const signInWithPasskeyForAdmin = async () => {
    setAuthFlow('admin');
    pendingPasskeyFlow = 'admin';

    try {
      const { data, error } = await runPasskeySignIn();

      if (error) {
        pendingPasskeyFlow = null;
        clearAuthFlow();
        if (isPasskeyCeremonyCancelled(error)) {
          return { error: null };
        }
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: 'passkey',
          status: 'error',
          errorMessage: error.message,
          metadata: { provider: 'passkey', flow: 'admin' },
        });
        return { error: new Error(describePasskeyError(error)) };
      }

      if (data?.user && !isUserAuthorized(data.user)) {
        // The SIGNED_IN handler logs and signs this out; all this has to do is
        // give the page something to render so the button comes back.
        return { error: new Error(getAuthorizationError(data.user)) };
      }

      return { error: null };
    } catch (error) {
      pendingPasskeyFlow = null;
      clearAuthFlow();
      return { error: new Error(describePasskeyError(error as { code?: string })) };
    }
  };

  /**
   * Passkey sign-in for the customer portal. Returns the user so the caller can
   * run the post-login pipeline itself — context state lags this promise,
   * because the SIGNED_IN handler only calls setUser after an awaited
   * loadOrganizations round trip.
   */
  const signInWithPasskeyForPortal = async () => {
    setAuthFlow('portal');
    clearAuthLoginMethod();
    pendingPasskeyFlow = 'portal';

    try {
      const { data, error } = await runPasskeySignIn();

      if (error) {
        pendingPasskeyFlow = null;
        clearAuthFlow();
        if (isPasskeyCeremonyCancelled(error)) {
          return { error: null, user: null };
        }
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: 'passkey',
          status: 'error',
          errorMessage: error.message,
          metadata: { provider: 'passkey', flow: 'portal' },
        });
        return { error: new Error(describePasskeyError(error)), user: null };
      }

      // Mirrors the portal rule in the SIGNED_IN handler: admins are allowed
      // through here and get redirected to the admin side by the route guard.
      if (data?.user && !isClientAuthorized(data.user) && !isAdminUser(data.user)) {
        return { error: new Error('This account does not have portal access.'), user: null };
      }

      return { error: null, user: data?.user ?? null };
    } catch (error) {
      pendingPasskeyFlow = null;
      clearAuthFlow();
      return { error: new Error(describePasskeyError(error as { code?: string })), user: null };
    }
  };

  const signInWithGoogle = async () => {
    try {
      setAuthFlow('admin');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUri('admin'),
        },
      });

      if (error) {
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: 'google-oauth',
          status: 'error',
          errorMessage: error.message,
        });
      }

      return { error };
    } catch (error) {
      await logAction({
        actionType: 'LOGIN',
        tableName: 'auth',
        recordIdentifier: 'google-oauth',
        status: 'error',
        errorMessage: (error as Error).message,
      });
      return { error: error as Error };
    }
  };

  const signInWithGoogleForBooking = async () => {
    try {
      setAuthFlow('booking');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUri('booking'),
        },
      });

      if (error) {
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: 'google-oauth-booking',
          status: 'error',
          errorMessage: error.message,
        });
      }

      return { error };
    } catch (error) {
      await logAction({
        actionType: 'LOGIN',
        tableName: 'auth',
        recordIdentifier: 'google-oauth-booking',
        status: 'error',
        errorMessage: (error as Error).message,
      });
      return { error: error as Error };
    }
  };

  const signInWithGoogleForPortal = async () => {
    try {
      setAuthFlow('portal');
      clearAuthLoginMethod();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUri('portal'),
        },
      });

      if (error) {
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: 'google-oauth-portal',
          status: 'error',
          errorMessage: error.message,
        });
      }

      return { error };
    } catch (error) {
      await logAction({
        actionType: 'LOGIN',
        tableName: 'auth',
        recordIdentifier: 'google-oauth-portal',
        status: 'error',
        errorMessage: (error as Error).message,
      });
      return { error: error as Error };
    }
  };

  /**
   * Emails a sign-in link that doubles as a sign-up: shouldCreateUser mints the
   * auth user when the address is new, and runPortalPostLogin provisions the
   * customer record on arrival, exactly as it does after Google.
   *
   * shouldCreateUser is also what keeps this from enumerating accounts. With it
   * false, Supabase answers a known address with success and an unknown one
   * with 'otp_disabled' — a free oracle for testing whether someone is a
   * customer. With it true both answers are identical.
   *
   * `next` rides in the redirect URL rather than sessionStorage because the
   * link opens in a new tab, where per-tab storage is empty. Re-validated here
   * as well as at the callback: this value ends up in an email, so it is worth
   * refusing to mail a bad one in the first place.
   */
  const sendMagicLinkForPortal = async (email: string, nextPath: string) => {
    try {
      setAuthFlow('portal');
      setAuthLoginMethod('magic_link');

      // new URL(...) rather than string concatenation: when
      // VITE_PORTAL_OAUTH_REDIRECT_URI is set, getSecureAuthRedirectUrl returns
      // it verbatim and ignores the path argument, so the shape of what comes
      // back is not fixed.
      const redirectUrl = new URL(getOAuthRedirectUri('portal'));
      redirectUrl.searchParams.set('flow', 'magic_link');
      redirectUrl.searchParams.set('next', getSafeNextPath(nextPath));

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl.toString(),
          shouldCreateUser: true,
        },
      });

      if (error) {
        clearAuthLoginMethod();
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: 'magic-link-portal',
          status: 'error',
          errorMessage: error.message,
        });
      }

      return { error };
    } catch (error) {
      clearAuthLoginMethod();
      await logAction({
        actionType: 'LOGIN',
        tableName: 'auth',
        recordIdentifier: 'magic-link-portal',
        status: 'error',
        errorMessage: (error as Error).message,
      });
      return { error: error as Error };
    }
  };

  /**
   * The six-digit code from the same email, verified in the tab that asked for
   * it. This exists because the client runs flowType: 'pkce' — the emailed link
   * can only be completed in the browser holding the code verifier, so someone
   * who requests on a laptop and reads mail on a phone cannot use the link at
   * all. Typing the code has no such constraint.
   *
   * Returns the user rather than leaving the caller to read context, for the
   * same reason signInWithPasskeyForPortal does: the SIGNED_IN handler sets
   * `user` only after an awaited loadOrganizations, so context still reads null
   * when this resolves.
   */
  const verifyPortalEmailOtp = async (email: string, token: string) => {
    setAuthFlow('portal');
    setAuthLoginMethod('magic_link');

    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });

      if (error) {
        clearAuthLoginMethod();
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: 'magic-link-otp-portal',
          status: 'error',
          errorMessage: error.message,
        });
        return { error: error as Error, user: null };
      }

      // Mirrors the portal rule in the SIGNED_IN handler and in the passkey
      // path: admins are allowed through and the route guard sends them on.
      if (data?.user && !isClientAuthorized(data.user) && !isAdminUser(data.user)) {
        return { error: new Error('This account does not have portal access.'), user: null };
      }

      return { error: null, user: data?.user ?? null };
    } catch (error) {
      clearAuthLoginMethod();
      await logAction({
        actionType: 'LOGIN',
        tableName: 'auth',
        recordIdentifier: 'magic-link-otp-portal',
        status: 'error',
        errorMessage: (error as Error).message,
      });
      return { error: error as Error, user: null };
    }
  };

  const signOut = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        actionType: 'LOGOUT',
        tableName: 'auth',
        recordIdentifier: user?.email || 'unknown',
        status: 'success',
      });
    } catch (error) {
      console.error('Error logging logout:', error);
    }
    await supabase.auth.signOut({ scope: 'local' });
  };

  const signOutAllSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        actionType: 'LOGOUT',
        tableName: 'auth',
        recordIdentifier: user?.email || 'unknown',
        status: 'success',
        metadata: { scope: 'global' },
      });
    } catch (error) {
      console.error('Error logging global logout:', error);
    }

    await supabase.auth.signOut({ scope: 'global' });
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getSecureAuthRedirectUrl('/admin/reset-password'),
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value = {
    user,
    session,
    loading,
    currentOrganization,
    currentRole,
    userOrganizations,
    isPlatformAdmin,
    setCurrentOrganization,
    refreshOrganizations,
    signIn,
    signInWithGoogle,
    signInWithGoogleForPortal,
    signInWithGoogleForBooking,
    sendMagicLinkForPortal,
    verifyPortalEmailOtp,
    signInWithPasskeyForAdmin,
    signInWithPasskeyForPortal,
    getHomeRouteForUser,
    signOut,
    signOutAllSessions,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
