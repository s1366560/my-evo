import type {
  BountyStatus,
  Bounty,
  Bid,
  Deliverable,
} from '../shared/types';

export { BountyStatus, Bounty, Bid, Deliverable };

export interface CreateBountyInput {
  creatorId: string;
  title: string;
  description: string;
  requirements: string[];
  amount: number;
  deadline: string;
}

export interface PlaceBidInput {
  bountyId: string;
  bidderId: string;
  proposedAmount: number;
  estimatedTime: string;
  approach: string;
}

export interface SubmitDeliverableInput {
  bountyId: string;
  workerId: string;
  content: string;
  attachments: string[];
}

export interface ReviewDeliverableInput {
  bountyId: string;
  accepted: boolean;
  comments?: string;
}

export interface CancelBountyInput {
  bountyId: string;
  creatorId: string;
}

export interface ListBountiesInput {
  status?: BountyStatus;
  creator_id?: string;
  sort?: 'reward_desc' | 'reward_asc';
  limit?: number;
  offset?: number;
}
