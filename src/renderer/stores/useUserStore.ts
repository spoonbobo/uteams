import React from 'react';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  firstname?: string;
  lastname?: string;
  fullname: string;
  email: string;
  sitename?: string;
  siteurl?: string;
}

export interface AuthenticationState {
  isAuthenticated: boolean;
  isInitialized: boolean; // Track if auth state has been loaded from persistence
  user: User | null;
  authMethod: 'moodle' | null;
  lastAuthCheck: string | null;
}

interface UserState extends AuthenticationState {
  // Actions
  setAuthenticated: (user: User, method: 'moodle') => void;
  setUnauthenticated: () => void;
  updateUser: (user: Partial<User>) => void;
  setInitialized: () => void;
  reset: () => void;
}

const initialState: AuthenticationState = {
  isAuthenticated: false,
  isInitialized: false,
  user: null,
  authMethod: null,
  lastAuthCheck: null,
};

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Actions
        setAuthenticated: (user: User, method: 'moodle') => {
          console.log('[UserStore] Setting user as authenticated:', user.fullname);
          set(
            {
              isAuthenticated: true,
              isInitialized: true, // Ensure initialized is true when authenticating
              user,
              authMethod: method,
              lastAuthCheck: new Date().toISOString(),
            },
            false,
            'setAuthenticated'
          );
        },

        setUnauthenticated: () => {
          console.log('[UserStore] Setting user as unauthenticated');
          set(
            {
              isAuthenticated: false,
              user: null,
              authMethod: null,
              lastAuthCheck: new Date().toISOString(),
            },
            false,
            'setUnauthenticated'
          );
        },

        updateUser: (userData: Partial<User>) => {
          const currentUser = get().user;
          if (currentUser) {
            set(
              {
                user: { ...currentUser, ...userData },
              },
              false,
              'updateUser'
            );
          }
        },

        setInitialized: () => {
          set(
            { isInitialized: true },
            false,
            'setInitialized'
          );
        },

        reset: () => {
          console.log('[UserStore] Resetting user store');
          set(
            initialState,
            false,
            'reset'
          );
        },
      }),
      {
        name: 'user-store',
        // Persist authentication state (excluding isInitialized as it's handled by the hook)
        partialize: (state) => ({
          isAuthenticated: state.isAuthenticated,
          user: state.user,
          authMethod: state.authMethod,
          lastAuthCheck: state.lastAuthCheck,
        }),
        // Set initialized flag after rehydration
        onRehydrateStorage: () => (state, error) => {
          console.log('[UserStore] Rehydration complete', { hasState: !!state, error });
          // Always set initialized after rehydration completes
          return state;
        },
      }
    ),
    {
      name: 'user-store',
    }
  )
);

// Selector hooks for convenience
export const useIsAuthenticated = () => useUserStore(state => state.isAuthenticated);
export const useUser = () => useUserStore(state => state.user);

// Enhanced authentication state hook with proper initialization
export const useAuthenticationState = () => {
  const isAuthenticated = useUserStore(state => state.isAuthenticated);
  const isInitialized = useUserStore(state => state.isInitialized);
  const user = useUserStore(state => state.user);
  const authMethod = useUserStore(state => state.authMethod);
  const setInitialized = useUserStore(state => state.setInitialized);
  
  // Ensure initialization happens
  React.useEffect(() => {
    if (!isInitialized) {
      console.log('[useAuthenticationState] Store not initialized, setting initialized to true');
      // Small delay to ensure store is ready
      const timer = setTimeout(() => {
        setInitialized();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, setInitialized]);
  
  return {
    isAuthenticated,
    isInitialized,
    user,
    authMethod,
  };
};
