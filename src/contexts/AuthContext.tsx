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
          if (provider === 'google') {
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
