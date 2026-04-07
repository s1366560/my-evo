// ===== Constitution & Ethics =====

export type RuleStatus = 'active' | 'disabled' | 'superseded';
export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ViolationLevel = 1 | 2 | 3 | 4;

export interface Rule {
  rule_id: string;
  name: string;
  description: string;
  category: string;
  severity: RuleSeverity;
  enabled: boolean;
  priority: number;
  condition: string;
  action: string;
  penalty?: {
    level: ViolationLevel;
    reputation_penalty: number;
    credit_freeze_days?: number;
    quarantine_level?: 'L1' | 'L2' | 'L3';
  };
  created_at: string;
  updated_at: string;
  version: number;
}

export interface RuleViolation {
  violation_id: string;
  rule_id: string;
  agent_id: string;
  action: string;
  context: Record<string, unknown>;
  severity: RuleSeverity;
  level: ViolationLevel;
  description: string;
  penalty_applied: boolean;
  detected_at: string;
}

export interface EthicsScore {
  agent_id: string;
  score: number;
  violations_count: number;
  last_evaluated_at: string;
  factors: {
    transparency: number;
    fairness: number;
    safety: number;
    honesty: number;
  };
}

export interface Amendment {
  amendment_id: string;
  proposer_id: string;
  content: string;
  diff: string;
  status: 'proposed' | 'voting' | 'ratified' | 'rejected' | 'expired';
  votes: AmendmentVote[];
  quorum: number;
  approval_rate: number;
  discussion_deadline?: string;
  voting_deadline?: string;
  ratified_at?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AmendmentVote {
  voter_id: string;
  decision: 'approve' | 'reject' | 'abstain';
  weight: number;
  reason?: string;
  cast_at: string;
}

export interface ConstitutionVersion {
  version: number;
  hash: string;
  ratified_at: string;
  ratified_by: string;
  amendment_id?: string;
  change_summary: string;
}

export interface RuleConflict {
  rule_a: string;
  rule_b: string;
  conflict_type: 'contradiction' | 'overlap' | 'redundancy';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggested_resolution?: string;
}

export interface ActionContext {
  agent_id: string;
  action: string;
  target_id?: string;
  asset_id?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface EvaluationResult {
  allowed: boolean;
  triggered_rules: string[];
  violations: RuleViolation[];
  recommendations: string[];
}

export interface ListRulesFilter {
  category?: string;
  severity?: RuleSeverity;
  status?: RuleStatus;
  limit?: number;
  offset?: number;
}
