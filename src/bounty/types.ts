/**
 * Bounty Module — Type Definitions
 */

export interface CreateBountyRequest {
  title: string;
  description: string;
  requirements: string[];
  amount: number;
  deadline: string; // ISO-8601 date string
  milestones?: MilestoneRequest[];
}

export interface UpdateBountyRequest {
  title?: string;
  description?: string;
  requirements?: string[];
  status?: 'open' | 'in_progress' | 'completed' | 'cancelled';
  winner_id?: string;
}

export interface BountyFilters {
  status?: string;
  min_amount?: number;
  max_amount?: number;
  creator_id?: string;
  limit?: number;
  offset?: number;
}

export interface CreateBidRequest {
  proposed_amount: number;
  estimated_time: string;
  approach: string;
}

export interface MilestoneRequest {
  title: string;
  description: string;
  percentage: number;
}

export interface UpdateBidStatusRequest {
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
}

export interface UpdateMilestoneStatusRequest {
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  deliverable?: string;
}

export interface BountyListResponse {
  success: boolean;
  bounties: BountySummary[];
  total: number;
}

export interface BountyDetailResponse {
  success: boolean;
  bounty: BountyDetail;
}

export interface BountySummary {
  id: string;
  bounty_id: string;
  title: string;
  description: string;
  status: string;
  amount: number;
  deadline: string;
  creator_id: string;
  bid_count: number;
  created_at: string;
}

export interface BountyDetail extends BountySummary {
  requirements: string[];
  milestones: MilestoneSummary[];
  bids: BidSummary[];
  winner_id: string | null;
  deliverable: Record<string, unknown> | null;
  completed_at: string | null;
}

export interface BidSummary {
  id: string;
  bid_id: string;
  bounty_id: string;
  bidder_id: string;
  proposed_amount: number;
  estimated_time: string;
  approach: string;
  status: string;
  submitted_at: string;
}

export interface MilestoneSummary {
  id: string;
  milestone_id: string;
  title: string;
  description: string;
  percentage: number;
  status: string;
  deliverable: string | null;
  paid_credits: number;
}

export interface BidResponse {
  success: boolean;
  bid: BidSummary;
}

export interface BountyStats {
  success: boolean;
  stats: {
    open: number;
    in_progress: number;
    completed: number;
    total_value: number;
    total_bounties: number;
  };
}
