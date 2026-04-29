'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/auth-store';

// ── Query hooks ──────────────────────────────────────────────────────────────

export interface MeResult {
  user: {
    userId: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
  };
}

/**
 * Fetch the currently authenticated user's profile.
 * Requires a valid session cookie (server-side session check).
 */
export function useMe(
  options?: Partial<UseQueryOptions<MeResult, Error>>,
) {
  return useQuery<MeResult, Error>({
    queryKey: ['account', 'me'],
    queryFn: () => apiClient.getMe() as Promise<MeResult>,
    retry: false,
    staleTime: 5 * 60_000,
    ...options,
  });
}

// ── Mutation hooks ──────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: { id: string; email: string };
}

/**
 * Authenticate via email + password.
 * On success, stores the token in Zustand + localStorage.
 */
export function useLogin(
  options?: UseMutationOptions<LoginResult, Error, LoginInput>,
) {
  const login = useAuthStore((s) => s.login);

  return useMutation<LoginResult, Error, LoginInput>({
    mutationFn: (input) => apiClient.login(input) as Promise<LoginResult>,
    onSuccess: (data) => {
      login(data.token, data.user.id);
    },
    ...options,
  });
}

export interface RegisterInput {
  email: string;
  password: string;
}

/**
 * Register a new account.
 * Stores token in Zustand + localStorage on success.
 */
export function useRegister(
  options?: UseMutationOptions<{ message: string }, Error, RegisterInput>,
) {
  const login = useAuthStore((s) => s.login);

  return useMutation<{ message: string }, Error, RegisterInput>({
    mutationFn: (input) => apiClient.register(input) as Promise<{ message: string }>,
    onSuccess: (_data, vars) => {
      // Backend returns only a message on register — re-fetch token by
      // performing a silent login. Adjust if backend returns a token directly.
      apiClient
        .login(vars)
        .then((res: LoginResult) => login(res.token, res.user.id))
        .catch(() => {
          // If silent re-login fails, the user must log in manually.
        });
    },
    ...options,
  });
}

/**
 * Log out the current user.
 * Clears the server session and Zustand state.
 */
export function useLogout(
  options?: UseMutationOptions<{ success: boolean }, Error, void>,
) {
  const logout = useAuthStore((s) => s.logout);

  return useMutation<{ success: boolean }, Error, void>({
    mutationFn: () => apiClient.logout(),
    onSuccess: () => {
      logout();
    },
    ...options,
  });
}

// ── Convenience derived hooks ────────────────────────────────────────────────

/**
 * Returns true when an auth operation (login/register) is in-flight.
 * Usage: const { isLoading } = useLogin();
 */
export type { UseQueryOptions as UseAuthQueryOptions };

/**
 * Helper to imperatively log out and clear local state.
 * Use this instead of calling useLogout() in event handlers.
 */
export function useClearAuth() {
  const logout = useAuthStore((s) => s.logout);

  return useCallback(() => {
    // Fire-and-forget server logout, always clear local state.
    apiClient.logout().catch(() => {
      /* ignore server errors */
    });
    logout();
  }, [logout]);
}
