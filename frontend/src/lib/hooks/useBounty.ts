import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type Bounty, type BountyStatus, type BountyMilestone } from '@/lib/api/client';

// ── Bounty Hooks ─────────────────────────────────────────────────────────────

export function useBounties(params?: { status?: BountyStatus; creator_id?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['bounties', params],
    queryFn: () => apiClient.getBounties(params),
  });
}

export function useOpenBounties() {
  return useQuery({
    queryKey: ['bounties', 'open'],
    queryFn: () => apiClient.getOpenBounties(),
  });
}

export function useBountyStats() {
  return useQuery({
    queryKey: ['bounties', 'stats'],
    queryFn: () => apiClient.getBountyStats(),
  });
}

export function useMyBounties() {
  return useQuery({
    queryKey: ['bounties', 'my'],
    queryFn: () => apiClient.getMyBounties(),
  });
}

export function useBountyById(bountyId: string) {
  return useQuery({
    queryKey: ['bounty', bountyId],
    queryFn: () => apiClient.getBountyById(bountyId),
    enabled: !!bountyId,
  });
}

export interface CreateBountyInput {
  title: string;
  description: string;
  requirements?: string[];
  amount: number;
  deadline: string;
  milestones?: BountyMilestone[];
}

export function useCreateBounty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBountyInput) => apiClient.createBounty(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bounties'] });
    },
  });
}

export interface PlaceBidInput {
  proposedAmount: number;
  estimatedTime: string;
  approach: string;
}

export function usePlaceBid(bountyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceBidInput) => apiClient.placeBid(bountyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bounty', bountyId] });
    },
  });
}

export interface SubmitBountyInput {
  content: string;
  attachments?: string[];
  milestone_id?: string;
}

export function useSubmitBounty(bountyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitBountyInput) => apiClient.submitBounty(bountyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bounty', bountyId] });
      queryClient.invalidateQueries({ queryKey: ['bounties'] });
    },
  });
}

export function useReviewBounty(bountyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accepted: boolean; comments?: string; milestone_id?: string }) =>
      apiClient.reviewBounty(bountyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bounty', bountyId] });
      queryClient.invalidateQueries({ queryKey: ['bounties'] });
    },
  });
}

export function useAcceptBounty(bountyId: string, bidId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.acceptBounty(bountyId, bidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bounty', bountyId] });
      queryClient.invalidateQueries({ queryKey: ['bounties'] });
    },
  });
}

export function useCancelBounty(bountyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.cancelBounty(bountyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bounty', bountyId] });
      queryClient.invalidateQueries({ queryKey: ['bounties'] });
    },
  });
}
