import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { logAction } from '../services/auditLogService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
          const provider = session.user.app_metadata?.provider;
          console.log('User signed in with provider:', provider);
          if (provider === 'google') {
            await logAction({
              actionType: 'LOGIN',
              tableName: 'auth',
              recordIdentifier: session.user.email || 'google-oauth',
              status: 'success',
              metadata: { provider: 'google' },
            });
          }
        }

        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: email,
          status: 'success',
        });
      } else {
        await logAction({
          actionType: 'LOGIN',
          tableName: 'auth',
          recordIdentifier: email,
          status: 'error',
          errorMessage: error.message,
        });
      }

      return { error };
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin/login`,
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
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
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
    signIn,
    signInWithGoogle,
    signOut,
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
