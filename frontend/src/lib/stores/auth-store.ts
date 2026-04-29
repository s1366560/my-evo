import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================
export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

// ============================================================================
// Store Interface
// ============================================================================
interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  login: (token: string, userId?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      isAuthenticated: false,

      login: (token: string, userId?: string) => {
        set({ token, userId: userId ?? null, isAuthenticated: true });
      },

      logout: () => {
        set({ token: null, userId: null, isAuthenticated: false });
      },
    }),
    {
      name: 'evomap-auth',
      // Only persist the token and userId; isAuthenticated is derived
      partialize: (state) => ({ token: state.token, userId: state.userId }),
    },
  ),
);

// Convenience selectors
export const useToken = () => useAuthStore((s) => s.token);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useUserId = () => useAuthStore((s) => s.userId);
export const useAuthUser = () => useAuthStore((s) => ({
  id: s.userId,
  isAuthenticated: s.isAuthenticated,
}));
