/**
 * Billing & Earnings Engine
 * Phase 6+: Revenue and Attribution System
 */

import {
  ContributionRecord,
  EarningsSummary,
  EarningsByPeriod,
  PayoutRecord,
} from './types';
import { getNodeInfo } from '../a2a/node';
import { getAsset } from '../assets/store';
import { getAssetConfidence } from '../assets/confidence';

// In-memory contribution store
const contributionsByAgent = new Map<string, ContributionRecord[]>();
const contributionsByCapsule = new Map<string, ContributionRecord[]>();

// Earnings constants
const BASE_EARNINGS_PER_USE = 5; // base credits per Capsule use
const MAX_PAYOUT_MULTIPLIER = 2.0; // max multiplier at reputation 100
const MIN_REPUTATION_FOR_PAYOUT = 20; // minimum reputation to earn

// ============ Contribution Recording ============

/**
 * Record a Capsule usage contribution.
 * Called when a Capsule is used to answer a question.
 */
export function recordContribution(params: {
  agent_id: string;
  capsule_id: string;
  question_id: string;
  gdi_score?: number;
}): ContributionRecord {
  const assetRecord = getAsset(params.capsule_id);
  const gdi_score = params.gdi_score ?? assetRecord?.gdi?.total ?? 50;
  const validation_passed = assetRecord ? assetRecord.status === 'promoted' : false;

  // Calculate contribution score based on quality signals
  const contribution_score = calculateContributionScore({
    gdi_score,
    validation_passed,
    user_feedback: 0, // default neutral
  });

  // Get reputation for payout multiplier
  let reputation = 50; // default
  try {
    const nodeInfo = getNodeInfo(params.agent_id);
    reputation = nodeInfo?.reputation ?? 50;
  } catch {
    // node not found, use default
  }

  const payout_multiplier = calculatePayoutMultiplier(reputation);
  const earnings = contribution_score * payout_multiplier * BASE_EARNINGS_PER_USE;

  const record: ContributionRecord = {
    id: `contrib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agent_id: params.agent_id,
    capsule_id: params.capsule_id,
    question_id: params.question_id,
    contribution_score,
    gdi_score,
    validation_passed,
    user_feedback: 0,
    earnings: Math.round(earnings * 100) / 100,
    created_at: new Date().toISOString(),
  };

  // Store by agent
  if (!contributionsByAgent.has(params.agent_id)) {
    contributionsByAgent.set(params.agent_id, []);
  }
  contributionsByAgent.get(params.agent_id)!.push(record);

  // Store by capsule
  if (!contributionsByCapsule.has(params.capsule_id)) {
    contributionsByCapsule.set(params.capsule_id, []);
  }
  contributionsByCapsule.get(params.capsule_id)!.push(record);

  return record;
}

/**
 * Update user feedback for a contribution
 */
export function updateContributionFeedback(
  contributionId: string,
  agentId: string,
  feedback: number // -1, 0, or 1
): ContributionRecord | null {
  const records = contributionsByAgent.get(agentId);
  if (!records) return null;

  const record = records.find(r => r.id === contributionId);
  if (!record) return null;

  record.user_feedback = feedback;

  // Recalculate earnings with new feedback
  const contribution_score = calculateContributionScore({
    gdi_score: record.gdi_score,
    validation_passed: record.validation_passed,
    user_feedback: feedback,
  });

  let reputation = 50;
  try {
    const nodeInfo = getNodeInfo(agentId);
    reputation = nodeInfo?.reputation ?? 50;
  } catch {
    // use default
  }

  const payout_multiplier = calculatePayoutMultiplier(reputation);
  record.contribution_score = contribution_score;
  record.earnings = Math.round(contribution_score * payout_multiplier * BASE_EARNINGS_PER_USE * 100) / 100;

  return record;
}

// ============ Earnings Queries ============

/**
 * Get earnings summary for an agent
 */
export function getEarningsSummary(
  agentId: string,
  periodStart?: string,
  periodEnd?: string
): EarningsSummary {
  const records = contributionsByAgent.get(agentId) ?? [];

  // Filter by period if specified
  const filtered = records.filter(r => {
    if (periodStart && r.created_at < periodStart) return false;
    if (periodEnd && r.created_at > periodEnd) return false;
    return true;
  });

  // Get reputation for payout multiplier
  let reputation = 50;
  try {
    const nodeInfo = getNodeInfo(agentId);
    reputation = nodeInfo?.reputation ?? 50;
  } catch {
    // use default
  }

  const payout_multiplier = calculatePayoutMultiplier(reputation);

  // Group by capsule
  const byCapsule = new Map<string, ContributionRecord[]>();
  for (const record of filtered) {
    if (!byCapsule.has(record.capsule_id)) {
      byCapsule.set(record.capsule_id, []);
    }
    byCapsule.get(record.capsule_id)!.push(record);
  }

  const breakdown = [...byCapsule.entries()].map(([capsule_id, recs]) => {
    const assetRecord = getAsset(capsule_id);
    const capsule = assetRecord?.asset;
    const capsule_summary =
      capsule?.type === 'Capsule' && 'summary' in capsule
        ? capsule.summary.slice(0, 100)
        : 'Capsule';
    return {
      capsule_id,
      capsule_summary,
      contribution_count: recs.length,
      earnings: recs.reduce((sum, r) => sum + r.earnings, 0),
    };
  });

  const total_earnings = filtered.reduce((sum, r) => sum + r.earnings, 0);
  const pending_earnings = filtered
    .filter(r => r.created_at > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .reduce((sum, r) => sum + r.earnings, 0);

  return {
    agent_id: agentId,
    total_earnings: Math.round(total_earnings * 100) / 100,
    total_contributions: filtered.length,
    pending_earnings: Math.round(pending_earnings * 100) / 100,
    lifetime_revenue: total_earnings,
    period_start: periodStart ?? records[0]?.created_at ?? new Date(0).toISOString(),
    period_end: periodEnd ?? new Date().toISOString(),
    payout_multiplier,
    breakdown,
  };
}

/**
 * Get earnings by time period
 */
export function getEarningsByPeriod(
  agentId: string,
  period: 'day' | 'week' | 'month' | 'year' = 'month'
): EarningsByPeriod[] {
  const records = contributionsByAgent.get(agentId) ?? [];
  const now = new Date();

  const buckets = new Map<string, { earnings: number; contributions: number }>();

  for (const record of records) {
    const date = new Date(record.created_at);
    let bucket: string;

    switch (period) {
      case 'day':
        bucket = date.toISOString().slice(0, 10); // YYYY-MM-DD
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        bucket = weekStart.toISOString().slice(0, 10);
        break;
      case 'month':
        bucket = date.toISOString().slice(0, 7); // YYYY-MM
        break;
      case 'year':
        bucket = date.toISOString().slice(0, 4); // YYYY
        break;
    }

    if (!buckets.has(bucket)) {
      buckets.set(bucket, { earnings: 0, contributions: 0 });
    }
    const b = buckets.get(bucket)!;
    b.earnings += record.earnings;
    b.contributions += 1;
  }

  return [...buckets.entries()]
    .map(([period_label, data]) => ({
      period: period_label,
      earnings: Math.round(data.earnings * 100) / 100,
      contributions: data.contributions,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// ============ Helper Functions ============

function calculateContributionScore(params: {
  gdi_score: number;
  validation_passed: boolean;
  user_feedback: number;
}): number {
  // GDI component: 0-1 normalized from 0-100
  const gdi_component = params.gdi_score / 100;

  // Validation bonus: +0.1 if passed
  const validation_bonus = params.validation_passed ? 0.1 : 0;

  // User feedback: -0.2 to +0.2
  const feedback_component = params.user_feedback * 0.2;

  // Combined score capped at 1.0
  return Math.min(1.0, Math.max(0, gdi_component + validation_bonus + feedback_component));
}

function calculatePayoutMultiplier(reputation: number): number {
  if (reputation < MIN_REPUTATION_FOR_PAYOUT) return 0;
  // Linear interpolation from 0.5 at reputation=20 to 2.0 at reputation=100
  return 0.5 + ((reputation - MIN_REPUTATION_FOR_PAYOUT) / (100 - MIN_REPUTATION_FOR_PAYOUT)) * 1.5;
}
