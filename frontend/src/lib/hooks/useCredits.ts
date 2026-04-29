'use client';

import { useQuery, useMutation, UseQueryOptions } from '@tanstack/react-query';
import { apiClient, CreditsInfo, CreditTransaction } from '../api/client';
import { QueryKeys } from '../api/query-keys';

// ── Query hooks ──────────────────────────────────────────────────────────────

export interface CreditsHistoryResult {
  items: CreditTransaction[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

/**
 * Fetch credit balance and info for a specific node.
 */
export function useCredits(
  nodeId: string,
  options?: Partial<UseQueryOptions<CreditsInfo, Error>>,
) {
  return useQuery<CreditsInfo, Error>({
    queryKey: QueryKeys.a2a.credits(nodeId),
    queryFn: () => apiClient.getCredits(nodeId),
    enabled: Boolean(nodeId),
    staleTime: 30_000, // credits can change frequently
    ...options,
  });
}

/**
 * Fetch credit transaction history for a node.
 */
export function useCreditsHistory(
  nodeId: string,
  options?: Partial<UseQueryOptions<CreditsHistoryResult, Error>>,
) {
  return useQuery<CreditsHistoryResult, Error>({
    queryKey: ['credits', 'history', nodeId],
    queryFn: () => apiClient.getCreditsHistory(nodeId),
    enabled: Boolean(nodeId),
    ...options,
  });
}

// ── Mutation hooks ──────────────────────────────────────────────────────────

// NOTE: The backend does not currently expose a top-up/transfer mutation.
// Add one here once the /a2a/credits/:nodeId/topup endpoint is implemented.
// Example:
// export interface TopupCreditsInput { amount: number; }
// export function useTopupCredits(nodeId: string, options?) {
//   return useMutation<TopupCreditsResult, Error, TopupCreditsInput>({
//     mutationFn: (input) => apiClient.topupCredits(nodeId, input),
//     ...options,
//   });
// }
