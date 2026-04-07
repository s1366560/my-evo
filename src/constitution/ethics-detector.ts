import type { RuleViolation } from './types';
import { violations } from './engine';

// ===== Ethics scoring factors =====
const ETHICS_FACTORS = {
  transparency: { weight: 0.25, base_score: 100 },
  fairness: { weight: 0.30, base_score: 100 },
  safety: { weight: 0.25, base_score: 100 },
  honesty: { weight: 0.20, base_score: 100 },
};

const VIOLATION_IMPACT: Record<string, number> = {
  critical: 30,
  high: 20,
  medium: 10,
  low: 5,
};

export async function detectViolation(
  _action: string,
  agentId: string,
  _context?: Record<string, unknown>,
): Promise<{
  has_violation: boolean;
  violations: RuleViolation[];
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
}> {
  const agentViolations = Array.from(violations.values()).filter(
    v => v.agent_id === agentId,
  );

  if (agentViolations.length === 0) {
    return { has_violation: false, violations: [], severity: 'none' };
  }

  const criticalCount = agentViolations.filter(v => v.severity === 'critical').length;
  const highCount = agentViolations.filter(v => v.severity === 'high').length;
  const mediumCount = agentViolations.filter(v => v.severity === 'medium').length;

  let severity: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
  if (criticalCount > 0) severity = 'critical';
  else if (highCount > 0) severity = 'high';
  else if (mediumCount > 0) severity = 'medium';
  else severity = 'low';

  return {
    has_violation: true,
    violations: agentViolations,
    severity,
  };
}

export async function checkConflictsOfInterest(
  agentId: string,
  transaction: { type: string; target_id?: string; amount?: number },
): Promise<{
  has_conflict: boolean;
  conflict_type?: string;
  description?: string;
  risk_level: 'none' | 'low' | 'medium' | 'high';
}> {
  // Self-voting in bounty claims (check before generic self_dealing)
  if (transaction.type === 'bounty_claim' && transaction.target_id === agentId) {
    return {
      has_conflict: true,
      conflict_type: 'self_approval',
      description: 'Agent claiming their own bounty',
      risk_level: 'medium',
    };
  }

  // High-value self-transfer
  if (
    transaction.type === 'transfer' &&
    transaction.target_id === agentId &&
    (transaction.amount ?? 0) > 1000
  ) {
    return {
      has_conflict: true,
      conflict_type: 'large_self_transfer',
      description: 'Large value transfer to self',
      risk_level: 'medium',
    };
  }

  // Generic self-dealing
  if (transaction.target_id && agentId === transaction.target_id) {
    return {
      has_conflict: true,
      conflict_type: 'self_dealing',
      description: 'Agent is transacting with themselves',
      risk_level: 'high',
    };
  }

  return { has_conflict: false, risk_level: 'none' };
}

export async function checkTransparencyRequirement(
  agentId: string,
  action: { type: string; metadata?: Record<string, unknown> },
): Promise<{
  meets_requirement: boolean;
  missing_elements: string[];
  transparency_score: number;
}> {
  const missing: string[] = [];
  let transparencyScore = 100;

  const meta = action.metadata ?? {};

  if (action.type === 'publish_asset') {
    if (!meta.capabilities_disclosed) {
      missing.push('capabilities_disclosure');
      transparencyScore -= 20;
    }
    if (!meta.data_sources_disclosed) {
      missing.push('data_sources_disclosure');
      transparencyScore -= 15;
    }
    if (!meta.limitations_disclosed) {
      missing.push('limitations_disclosure');
      transparencyScore -= 15;
    }
  }

  if (action.type === 'bounty_bid') {
    if (!meta.experience_disclosed) {
      missing.push('experience_disclosure');
      transparencyScore -= 25;
    }
    if (!meta.timeline_disclosed) {
      missing.push('timeline_disclosure');
      transparencyScore -= 15;
    }
  }

  if (action.type === 'swarm_join') {
    if (!meta.role_disclosed) {
      missing.push('role_disclosure');
      transparencyScore -= 20;
    }
  }

  // Check recent violations
  const recentViolations = Array.from(violations.values()).filter(v => {
    if (v.agent_id !== agentId) return false;
    const detected = new Date(v.detected_at).getTime();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return detected > thirtyDaysAgo;
  });

  if (recentViolations.length > 0) {
    transparencyScore -= recentViolations.length * 5;
  }

  transparencyScore = Math.max(0, transparencyScore);

  return {
    meets_requirement: missing.length === 0 && transparencyScore >= 70,
    missing_elements: missing,
    transparency_score: transparencyScore,
  };
}

export async function calculateEthicsScore(
  agentId: string,
): Promise<{
  score: number;
  factors: {
    transparency: number;
    fairness: number;
    safety: number;
    honesty: number;
  };
  violations_count: number;
  tier: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}> {
  const agentViolations = Array.from(violations.values()).filter(
    v => v.agent_id === agentId,
  );

  // All violations affect all factor scores
  const transparency = calculateFactorScore(agentViolations, 'transparency');
  const fairness = calculateFactorScore(agentViolations, 'fairness');
  const safety = calculateFactorScore(agentViolations, 'safety');
  const honesty = calculateFactorScore(agentViolations, 'honesty');

  const score =
    transparency * ETHICS_FACTORS.transparency.weight +
    fairness * ETHICS_FACTORS.fairness.weight +
    safety * ETHICS_FACTORS.safety.weight +
    honesty * ETHICS_FACTORS.honesty.weight;

  let tier: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  if (score >= 90) tier = 'excellent';
  else if (score >= 75) tier = 'good';
  else if (score >= 60) tier = 'fair';
  else if (score >= 40) tier = 'poor';
  else tier = 'critical';

  return {
    score: Math.round(score * 10) / 10,
    factors: {
      transparency: Math.round(transparency * 10) / 10,
      fairness: Math.round(fairness * 10) / 10,
      safety: Math.round(safety * 10) / 10,
      honesty: Math.round(honesty * 10) / 10,
    },
    violations_count: agentViolations.length,
    tier,
  };
}

function calculateFactorScore(
  violationsList: RuleViolation[],
  _factor: 'transparency' | 'fairness' | 'safety' | 'honesty',
): number {
  let score = 100;
  for (const v of violationsList) {
    score -= VIOLATION_IMPACT[v.severity] ?? 5;
  }
  return Math.max(0, score);
}

export function recordViolation(violation: RuleViolation): void {
  violations.set(violation.violation_id, violation);
}

export function clearViolations(agentId?: string): void {
  if (agentId) {
    const toDelete: string[] = [];
    for (const [id, v] of Array.from(violations.entries())) {
      if (v.agent_id === agentId) toDelete.push(id);
    }
    for (const id of toDelete) violations.delete(id);
  } else {
    violations.clear();
  }
}

export function getViolations(agentId?: string): RuleViolation[] {
  if (agentId) {
    return Array.from(violations.values()).filter(v => v.agent_id === agentId);
  }
  return Array.from(violations.values());
}
