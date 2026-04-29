'use client';

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DashboardUser {
  id: string;
  username: string;
  email: string;
  node_id: string;
  reputation: number;
  trust_level: string;
  member_since: string;
}

export interface DashboardCredits {
  balance: number;
  pending: number;
  trend: 'up' | 'down' | 'flat';
  trend_percent: number;
}

export interface DashboardAsset {
  id: string;
  name: string;
  type: 'gene' | 'capsule' | 'recipe';
  gdi_score: number;
  calls: number;
  views: number;
  signals: string[];
  updated_at: string;
}

export interface DashboardActivity {
  id: string;
  type:
    | 'asset_published'
    | 'bounty_earned'
    | 'asset_calls'
    | 'swarm_completed'
    | 'gdi_improved'
    | 'trust_upgraded'
    | 'node_registered';
  message: string;
  timestamp: string;
}

export interface DashboardStats {
  total_assets: number;
  total_calls: number;
  total_views: number;
  today_calls: number;
  total_bounties_earned: number;
  active_bounties: number;
  swarm_sessions: number;
  completed_swarm_sessions: number;
}

export interface TrendingSignal {
  signal: string;
  count: number;
}

export interface DashboardData {
  user: DashboardUser;
  credits: DashboardCredits;
  stats: DashboardStats;
  recent_assets: DashboardAsset[];
  recent_activity: DashboardActivity[];
  trending_signals: TrendingSignal[];
}

// ── Individual query hooks ────────────────────────────────────────────────────

/**
 * Fetch the full dashboard data in one request.
 */
export function useDashboard(
  options?: Partial<UseQueryOptions<DashboardData, Error>>,
) {
  return useQuery<DashboardData, Error>({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.getDashboard() as Promise<DashboardData>,
    staleTime: 60_000, // 1 minute
    ...options,
  });
}

/**
 * Fetch only the user profile portion of the dashboard.
 */
export function useDashboardUser(
  options?: Partial<UseQueryOptions<DashboardUser, Error>>,
) {
  return useQuery<DashboardUser, Error>({
    queryKey: ['dashboard', 'user'],
    queryFn: () => apiClient.getDashboardUser() as Promise<DashboardUser>,
    staleTime: 5 * 60_000,
    ...options,
  });
}

/**
 * Fetch only the credits portion of the dashboard.
 */
export function useDashboardCredits(
  options?: Partial<UseQueryOptions<DashboardCredits, Error>>,
) {
  return useQuery<DashboardCredits, Error>({
    queryKey: ['dashboard', 'credits'],
    queryFn: () => apiClient.getDashboardCredits() as Promise<DashboardCredits>,
    staleTime: 60_000,
    ...options,
  });
}

/**
 * Fetch only the stats portion of the dashboard.
 */
export function useDashboardStats(
  options?: Partial<UseQueryOptions<DashboardStats, Error>>,
) {
  return useQuery<DashboardStats, Error>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiClient.getDashboardStats() as Promise<DashboardStats>,
    staleTime: 60_000,
    ...options,
  });
}

/**
 * Fetch recent assets for the dashboard.
 */
export function useDashboardAssets(
  options?: Partial<UseQueryOptions<DashboardAsset[], Error>>,
) {
  return useQuery<DashboardAsset[], Error>({
    queryKey: ['dashboard', 'assets'],
    queryFn: () => apiClient.getDashboardAssets() as Promise<DashboardAsset[]>,
    staleTime: 60_000,
    ...options,
  });
}

/**
 * Fetch the activity feed for the dashboard.
 */
export function useDashboardActivity(
  options?: Partial<UseQueryOptions<DashboardActivity[], Error>>,
) {
  return useQuery<DashboardActivity[], Error>({
    queryKey: ['dashboard', 'activity'],
    queryFn: () =>
      apiClient.getDashboardActivity() as Promise<DashboardActivity[]>,
    staleTime: 30_000,
    ...options,
  });
}

/**
 * Fetch trending signals for the dashboard.
 */
export function useDashboardTrending(
  options?: Partial<UseQueryOptions<TrendingSignal[], Error>>,
) {
  return useQuery<TrendingSignal[], Error>({
    queryKey: ['dashboard', 'trending'],
    queryFn: () =>
      apiClient.getDashboardTrending() as Promise<TrendingSignal[]>,
    staleTime: 5 * 60_000,
    ...options,
  });
}
