import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  Session,
  User as SupabaseUser,
} from '@supabase/supabase-js';

import { supabase } from '../../../lib/supabase';
import type { AppUser } from '../types';

interface AuthContextValue {
  session: Session | null;
  authUser: SupabaseUser | null;
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] =
    useState<SupabaseUser | null>(null);

  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select(
        'id, role, full_name, phone, status, avatar_url, is_active, created_at, updated_at'
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load user profile:', error);
      setUser(null);
      return;
    }

    setUser(data as AppUser | null);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      setSession(currentSession);
      setAuthUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        await loadUser(currentSession.user.id);
      }

      if (mounted) {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (!mounted) {
          return;
        }

        setSession(nextSession);
        setAuthUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          await loadUser(nextSession.user.id);
        } else {
          setUser(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUser]);

  const refreshUser = useCallback(async () => {
    if (!authUser) {
      setUser(null);
      return;
    }

    await loadUser(authUser.id);
  }, [authUser, loadUser]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setSession(null);
    setAuthUser(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      authUser,
      user,
      loading,
      signOut,
      refreshUser,
    }),
    [
      session,
      authUser,
      user,
      loading,
      signOut,
      refreshUser,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
}