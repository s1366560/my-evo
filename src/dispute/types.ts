// ===== Dispute Arbitration Constants =====

export const ARBITRATOR_CRITERIA = {
  min_reputation: 70,
  min_tier: 'trusted',
  max_active_disputes: 3,
} as const;

export const ARBITRATOR_COUNT: Record<string, number> = {
  low: 3,
  medium: 3,
  high: 5,
  critical: 5,
};

export const FILING_FEES: Record<string, number> = {
  low: 10,
  medium: 25,
  high: 50,
  critical: 100,
};

export const DEFENDANT_BAIL: Record<string, number> = {
  low: 0,
  medium: 50,
  high: 100,
  critical: 200,
};

export const ARBITRATION_DEADLINE_DAYS: Record<string, number> = {
  low: 3,
  medium: 5,
  high: 7,
  critical: 10,
};

export const APPEAL_CONDITIONS = {
  max_appeals_per_dispute: 1,
  appeal_window_days: 7,
  appeal_fee_multiplier: 2,
  new_evidence_required: true,
  full_council_review: true,
} as const;

export const RULING_TO_QUARANTINE: Record<string, { level: string; council_removal?: boolean }> = {
  asset_quality_defendant_loses: {
    level: 'L1',
  },
  reputation_attack_confirmed: {
    level: 'L2',
  },
  governance_violation: {
    level: 'L3',
    council_removal: true,
  },
};

export type Verdict =
  | 'plaintiff_wins'
  | 'defendant_wins'
  | 'compromise'
  | 'no_fault';

export type DisputeType =
  | 'asset_quality'
  | 'transaction'
  | 'reputation_attack'
  | 'governance';

export type DisputeSeverity = 'low' | 'medium' | 'high' | 'critical';

export type DisputeStatus =
  | 'filed'
  | 'under_review'
  | 'hearing'
  | 'resolved'
  | 'dismissed'
  | 'escalated';

export type EvidenceType =
  | 'screenshot'
  | 'log'
  | 'transaction_record'
  | 'asset_hash'
  | 'testimony'
  | 'api_response';

export interface Evidence {
  evidence_id: string;
  type: EvidenceType;
  submitted_by: string;
  content: string;
  hash: string;
  submitted_at: string;
  verified: boolean;
}

export interface DisputeRuling {
  ruling_id: string;
  dispute_id: string;
  verdict: Verdict;
  reasoning: string;
  penalties: Array<{
    target_node_id: string;
    reputation_deduction: number;
    credit_fine: number;
    quarantine_level?: string;
    asset_revocation?: string[];
  }>;
  compensations: Array<{
    recipient_node_id: string;
    credit_amount: number;
    reputation_restore: number;
  }>;
  votes: Array<{
    arbitrator_id: string;
    vote: 'plaintiff' | 'defendant' | 'compromise' | 'abstain';
    reasoning: string;
  }>;
  ruled_at: string;
  appeal_deadline: string;
}

export interface AppealRecord {
  appeal_id: string;
  original_dispute_id: string;
  appellant_id: string;
  grounds: string;
  new_evidence?: Evidence[];
  appeal_fee: number;
  status: 'filed' | 'accepted' | 'rejected';
  filed_at: string;
}

export interface EvidenceValidationResult {
  valid: boolean;
  tampered: boolean;
  score: number;
  issues: string[];
}

export interface ArbitratorProfile {
  node_id: string;
  reputation: number;
  trust_level: string;
  active_disputes: number;
  is_available: boolean;
}
