import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Subscription } from '@supabase/supabase-js';
import type { AppUser } from '../features/auth/types';

interface AuthState {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

let authSubscription: Subscription | null = null;
let profileChannel: ReturnType<typeof supabase.channel> | null = null;

const loadProfile = async (
  userId: string
): Promise<AppUser | null> => {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      role,
      full_name,
      phone,
      student_code,
      status,
      avatar_url,
      is_active,
      created_at,
      updated_at
    `)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Profile load error:', error);
    return null;
  }

  return data as AppUser | null;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    try {
      set({ loading: true });

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (session?.user) {
        const profile = await loadProfile(
          session.user.id
        );

        set({
          user: session.user,
          profile,
          loading: false,
          initialized: true,
        });

        // ==============================
        // REALTIME PROFILE LISTENER
        // ==============================

        if (!profileChannel) {
          profileChannel = supabase
            .channel(`user-profile-${session.user.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'users',
                filter: `id=eq.${session.user.id}`,
              },
              async (payload) => {
                console.log(
                  'REALTIME USER UPDATE:',
                  payload
                );

                const updatedProfile =
                  await loadProfile(
                    session.user.id
                  );

                set({
                  profile: updatedProfile,
                });
              }
            )
            .subscribe((status) => {
              console.log(
                'PROFILE REALTIME STATUS:',
                status
              );
            });
        }
      } else {
        set({
          user: null,
          profile: null,
          loading: false,
          initialized: true,
        });
      }

      // ==============================
      // AUTH STATE LISTENER
      // ==============================

      if (!authSubscription) {
        const { data } =
          supabase.auth.onAuthStateChange(
            async (_event, session) => {
              if (!session?.user) {
                set({
                  user: null,
                  profile: null,
                  loading: false,
                });

                return;
              }

              set({
                user: session.user,
                loading: true,
              });

              const profile = await loadProfile(
                session.user.id
              );

              set({
                user: session.user,
                profile,
                loading: false,
              });
            }
          );

        authSubscription =
          data.subscription;
      }
    } catch (error) {
      console.error(
        'Auth initialization error:',
        error
      );

      set({
        user: null,
        profile: null,
        loading: false,
        initialized: true,
      });
    }
  },

  // ==============================
  // REFRESH PROFILE
  // ==============================

  refreshProfile: async () => {
    const currentUser = get().user;

    if (!currentUser) {
      set({ profile: null });
      return;
    }

    set({ loading: true });

    try {
      const profile = await loadProfile(
        currentUser.id
      );

      set({
        profile,
        loading: false,
      });
    } catch (error) {
      console.error(
        'Refresh profile error:',
        error
      );

      set({
        loading: false,
      });
    }
  },

  // ==============================
  // SIGN OUT
  // ==============================

  signOut: async () => {
    set({ loading: true });

    try {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        console.error(
          'Sign out error:',
          error
        );
      }
    } finally {
      if (profileChannel) {
        await supabase.removeChannel(
          profileChannel
        );

        profileChannel = null;
      }

      set({
        user: null,
        profile: null,
        loading: false,
      });
    }
  },
}));