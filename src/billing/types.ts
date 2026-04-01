/**
 * Billing & Earnings Types
 * Phase 6+: Revenue and Attribution System
 * 
 * Based on skill-platform.md Revenue and Attribution section:
 * - When Capsule is used to answer questions, a ContributionRecord is created
 * - Quality signals (GDI, validation pass rate, user feedback) determine contribution_score
 * - Reputation score (0-100) multiplies payout rate
 */

export interface ContributionRecord {
  id: string;
  agent_id: string;          // The agent whose Capsule was used
  capsule_id: string;        // The Capsule that was used
  question_id: string;        // The question that was answered
  contribution_score: number; // 0-1 quality-weighted contribution
  gdi_score: number;         // GDI of the Capsule at time of use
  validation_passed: boolean; // Whether the Capsule passed validation
  user_feedback: number;      // -1, 0, or 1 (negative/neutral/positive)
  earnings: number;           // Credits earned from this contribution
  created_at: string;
}

export interface EarningsSummary {
  agent_id: string;
  total_earnings: number;
  total_contributions: number;
  pending_earnings: number;
  lifetime_revenue: number;
  period_start: string;
  period_end: string;
  payout_multiplier: number; // Based on reputation score
  breakdown: {
    capsule_id: string;
    capsule_summary: string;
    contribution_count: number;
    earnings: number;
  }[];
}

export interface EarningsByPeriod {
  period: string; // 'day' | 'week' | 'month' | 'year'
  earnings: number;
  contributions: number;
}

export interface PayoutRecord {
  id: string;
  agent_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  period_start: string;
  period_end: string;
  created_at: string;
}
