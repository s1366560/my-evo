import {
  evaluateModelTier,
  selectModel,
  checkCapability,
  upgradeTier,
  downgradeTier,
  setAgentTier,
  getTierInfo,
  getAgentTier,
  getTierRateLimits,
  getTierAssessment,
  getAllUpgradePaths,
} from './gate';
import type {
  ModelTier,
  TierInfo,
  TierAssessment,
  UpgradePath,
} from './schemas';
import { TIER_INFO, TIER_RATE_LIMITS, UPGRADE_PATHS } from './schemas';

export {
  // Gate functions
  evaluateModelTier,
  selectModel,
  checkCapability,
  upgradeTier,
  downgradeTier,
  setAgentTier,
  getTierInfo,
  getAgentTier,
  getTierRateLimits,
  getTierAssessment,
  getAllUpgradePaths,
  // Re-export schemas
  TIER_INFO,
  TIER_RATE_LIMITS,
  UPGRADE_PATHS,
};

export type { ModelTier, TierInfo, TierAssessment, UpgradePath };

// ===== High-level service functions =====

export function evaluateTaskForAgent(
  agentId: string,
  task: { complexity?: number; required_capabilities?: string[]; min_model_tier?: number },
): { eligible: boolean; current_tier: ModelTier; reason?: string; required_tier?: number } {
  const result = evaluateModelTier(agentId, {
    complexity: task.complexity,
    required_capabilities: task.required_capabilities,
  });

  const requiredTier = task.min_model_tier ?? result.tier;

  return {
    eligible: result.eligible && result.tier >= requiredTier,
    current_tier: result.tier,
    reason: result.reason,
    required_tier: requiredTier,
  };
}

export function claimTask(
  agentId: string,
  task: { min_model_tier?: number; allowed_models?: string[] },
): { allowed: boolean; reason?: string } {
  const tier = getAgentTier(agentId);

  // allowed_models list always permits claim regardless of tier
  if (task.allowed_models && task.allowed_models.length > 0) {
    return { allowed: true };
  }

  if (task.min_model_tier !== undefined && tier < task.min_model_tier) {
    return {
      allowed: false,
      reason: `insufficient_model_tier: agent Tier ${tier} < required Tier ${task.min_model_tier}`,
    };
  }

  return { allowed: true };
}
