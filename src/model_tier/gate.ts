import type {
  ModelTier,
  TierInfo,
  TierAssessment,
  UpgradePath,
  DowngradeInfo,
} from './schemas';
import {
  TIER_INFO,
  TIER_RATE_LIMITS,
  UPGRADE_PATHS,
} from './schemas';
import { ValidationError, ForbiddenError, NotFoundError } from '../shared/errors';

// ===== In-memory store =====
const agentTiers = new Map<string, ModelTier>();
const assessments = new Map<string, TierAssessment>();
const downgradeProtection = new Map<string, DowngradeInfo>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ===== Model-to-Tier mapping =====
const MODEL_TIER_MAP: Record<string, ModelTier> = {
  'sensor': 0, 'monitor-script': 0, 'log-collector': 0,
  'rule-based-bot': 1, 'faq-bot': 1,
  'gpt-3.5-single-tool': 2, 'claude-single-tool': 2,
  'gpt-4-multi-tool-chain': 3, 'claude-multi-tool': 3,
  'gpt-4-tool-reflexion': 4, 'claude-planner': 4,
  'future-arch': 5, 'fusion-system': 5,
};

// ===== Gate: Evaluate Model Tier =====
export function evaluateModelTier(
  agentId: string,
  task?: { complexity?: number; required_capabilities?: string[] },
): { tier: ModelTier; eligible: boolean; reason?: string } {
  let tier = agentTiers.get(agentId);

  if (tier === undefined) {
    // Default: new agents start at Tier 0
    tier = 0;
    agentTiers.set(agentId, tier);
  }

  // Check if task requires higher tier
  if (task?.required_capabilities && task.required_capabilities.length > 0) {
    const requiredTier = findMinTierForCapabilities(task.required_capabilities);
    if (tier < requiredTier) {
      return {
        tier,
        eligible: false,
        reason: `Insufficient tier: required ${requiredTier}, agent is Tier ${tier}`,
      };
    }
  }

  if (task?.complexity !== undefined) {
    const minTier = Math.min(5, Math.floor(task.complexity)) as ModelTier;
    if (tier < minTier) {
      return {
        tier,
        eligible: false,
        reason: `Insufficient tier for complexity ${task.complexity}: required ${minTier}`,
      };
    }
  }

  return { tier, eligible: true };
}

// ===== Gate: Select Model =====
export function selectModel(requiredTier: ModelTier): string[] {
  const models: string[] = [];
  for (const [model, tier] of Object.entries(MODEL_TIER_MAP)) {
    if (tier >= requiredTier) {
      models.push(model);
    }
  }
  return models;
}

// ===== Gate: Check Capability =====
export function checkCapability(
  agentId: string,
  capability: string,
): { allowed: boolean; current_tier: ModelTier; required_tier?: ModelTier } {
  let tier = agentTiers.get(agentId);
  if (tier === undefined) {
    tier = 0;
    agentTiers.set(agentId, tier);
  }

  // Find which tier first has this capability
  for (let t = 0; t <= 5; t++) {
    const info = TIER_INFO[t as ModelTier];
    if (info.capabilities.includes(capability)) {
      if (tier >= t) {
        return { allowed: true, current_tier: tier };
      }
      return { allowed: false, current_tier: tier, required_tier: t as ModelTier };
    }
  }

  // Capability not found in any tier
  return { allowed: false, current_tier: tier };
}

// ===== Gate: Upgrade Tier =====
export function upgradeTier(
  agentId: string,
  evidence?: Partial<TierAssessment['assessment_basis']>,
): { success: boolean; new_tier?: ModelTier; reason?: string } {
  let currentTier = agentTiers.get(agentId);
  if (currentTier === undefined) {
    currentTier = 0;
    agentTiers.set(agentId, currentTier);
  }

  if (currentTier >= 5) {
    return { success: false, new_tier: currentTier, reason: 'Already at maximum Tier 5' };
  }

  // Get upgrade path
  const path = UPGRADE_PATHS.find(p => p.from === currentTier);
  if (!path) {
    return { success: false, new_tier: currentTier, reason: 'No upgrade path found' };
  }

  // Evaluate conditions
  if (evidence) {
    const { reputation_score, capability_test_score, task_completion_history, tool_proficiency } = evidence;

    // Simulate condition evaluation based on evidence
    if (currentTier === 1 && path.to === 2) {
      const singleTool = tool_proficiency?.single_tool_success ?? 0;
      const successRate = task_completion_history?.success_rate ?? 0;
      const rep = reputation_score ?? 0;

      if (singleTool < 10 || successRate < 0.8 || rep < 100) {
        return { success: false, new_tier: currentTier, reason: 'Upgrade conditions not met: need >=10 single tool calls, >=80% success rate, reputation >=100' };
      }
    }

    if (currentTier === 2 && path.to === 3) {
      const multiTool = tool_proficiency?.multi_tool_success ?? 0;
      const rep = reputation_score ?? 0;
      if (multiTool < 5 || rep < 200) {
        return { success: false, new_tier: currentTier, reason: 'Upgrade conditions not met: need >=5 multi-tool tasks, reputation >=200' };
      }
    }

    if (currentTier === 3 && path.to === 4) {
      const rep = reputation_score ?? 0;
      const certScore = capability_test_score ?? 0;
      if (rep < 400 || certScore < 80) {
        return { success: false, new_tier: currentTier, reason: 'Upgrade conditions not met: need reputation >=400, cert score >=80' };
      }
    }
  }

  const newTier = path.to;
  agentTiers.set(agentId, newTier);

  // Record assessment
  const assessment: TierAssessment = {
    node_id: agentId,
    current_tier: newTier,
    assessed_at: new Date().toISOString(),
    assessment_basis: {
      model_declared: 'unknown',
      capability_test_score: evidence?.capability_test_score ?? 0,
      reputation_score: evidence?.reputation_score ?? 0,
      task_completion_history: {
        total_tasks: evidence?.task_completion_history?.total_tasks ?? 0,
        success_rate: evidence?.task_completion_history?.success_rate ?? 0,
        avg_complexity: evidence?.task_completion_history?.avg_complexity ?? 1,
      },
      tool_proficiency: {
        single_tool_success: evidence?.tool_proficiency?.single_tool_success ?? 0,
        multi_tool_success: evidence?.tool_proficiency?.multi_tool_success ?? 0,
        loop_tool_success: evidence?.tool_proficiency?.loop_tool_success ?? 0,
      },
    },
    upgrade_eligible: false,
    downgrade_risk: false,
    next_review_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  assessments.set(agentId, assessment);

  return { success: true, new_tier: newTier };
}

// ===== Downgrade Tier =====
export function downgradeTier(
  agentId: string,
  reason: string,
): { success: boolean; new_tier?: ModelTier; reason?: string } {
  let currentTier = agentTiers.get(agentId);
  if (currentTier === undefined) {
    return { success: false, reason: 'Agent tier not found' };
  }

  if (reason === 'security_event') {
    agentTiers.set(agentId, 0 as ModelTier);
    return { success: true, new_tier: 0, reason };
  }

  if (currentTier <= 1) {
    return { success: false, new_tier: currentTier, reason: 'Already at minimum tier (Tier 0/1 protected)' };
  }

  const newTier = (currentTier - 1) as ModelTier;
  agentTiers.set(agentId, newTier);

  return { success: true, new_tier: newTier, reason };
}

// ===== Set Tier Directly =====
export function setAgentTier(agentId: string, tier: ModelTier): TierInfo {
  if (tier < 0 || tier > 5) {
    throw new ValidationError('Tier must be between 0 and 5');
  }
  agentTiers.set(agentId, tier);
  return TIER_INFO[tier];
}

// ===== Get Tier Info =====
export function getTierInfo(tier: ModelTier): TierInfo {
  return TIER_INFO[tier];
}

export function getAgentTier(agentId: string): ModelTier {
  return agentTiers.get(agentId) ?? 0;
}

export function getTierRateLimits(tier: ModelTier) {
  return TIER_RATE_LIMITS[tier];
}

export function getTierAssessment(agentId: string): TierAssessment | null {
  return assessments.get(agentId) ?? null;
}

export function getAllUpgradePaths(): UpgradePath[] {
  return UPGRADE_PATHS;
}

// ===== Helper =====
function findMinTierForCapabilities(capabilities: string[]): ModelTier {
  let maxRequired = 0;
  for (const cap of capabilities) {
    for (let t = 0; t <= 5; t++) {
      if (TIER_INFO[t as ModelTier].capabilities.includes(cap)) {
        if (t > maxRequired) maxRequired = t;
        break;
      }
    }
  }
  return maxRequired as ModelTier;
}
