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
  getDeclaredModelTier,
  getEffectiveAgentTier,
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
  getDeclaredModelTier,
  getEffectiveAgentTier,
  // Re-export schemas
  TIER_INFO,
  TIER_RATE_LIMITS,
  UPGRADE_PATHS,
};

export type { ModelTier, TierInfo, TierAssessment, UpgradePath };

export interface TierUpgradeMetric {
  current: number;
  required: number;
}

export interface DocumentedModelTier {
  tier: ModelTier;
  label: 'unclassified' | 'basic' | 'standard' | 'advanced' | 'frontier' | 'experimental';
  description: string;
  min_reputation: number;
  examples: string[];
}

export interface ResolvedDocumentedModelTier extends DocumentedModelTier {
  matched_by: 'exact' | 'heuristic' | 'unreported' | 'fallback';
}

const DOCUMENTED_MODEL_TIERS: DocumentedModelTier[] = [
  { tier: 0, label: 'unclassified', description: 'Unknown or unreported model', min_reputation: 0, examples: ['unknown', 'unreported'] },
  { tier: 1, label: 'basic', description: 'Entry-level single-agent models', min_reputation: 0, examples: ['gemini-2.0-flash', 'gpt-4o-mini', 'claude-haiku'] },
  { tier: 2, label: 'standard', description: 'Standard professional models', min_reputation: 100, examples: ['gemini-2.0-flash-thinking', 'gpt-4o', 'claude-sonnet'] },
  { tier: 3, label: 'advanced', description: 'Advanced multi-step reasoning models', min_reputation: 200, examples: ['gemini-2.5-pro', 'gpt-4.5', 'claude-sonnet-4'] },
  { tier: 4, label: 'frontier', description: 'Frontier planning-capable models', min_reputation: 400, examples: ['gpt-5', 'claude-opus-4', 'gemini-ultra'] },
  { tier: 5, label: 'experimental', description: 'Experimental or high-thinking frontier variants', min_reputation: 700, examples: ['o3', 'o4-mini', 'claude-opus-4-high-thinking'] },
];

const DEFAULT_DOCUMENTED_MODEL_TIER: DocumentedModelTier = DOCUMENTED_MODEL_TIERS[0] as DocumentedModelTier;

export interface TierClaimResult {
  allowed: boolean;
  current_tier: ModelTier;
  required_tier?: number;
  reason?: string;
  error?: 'TIER_INSUFFICIENT';
  upgrade_hint?: string;
  upgrade_progress?: Record<string, TierUpgradeMetric>;
  matched_model?: string;
}

function getRecordedModel(agentId: string): string | undefined {
  const model = getTierAssessment(agentId)?.assessment_basis.model_declared;
  return model && model !== 'unknown' ? model : undefined;
}

export function getDocumentedModelTiers(): DocumentedModelTier[] {
  return DOCUMENTED_MODEL_TIERS.map((entry) => ({
    ...entry,
    examples: [...entry.examples],
  }));
}

export function resolveDocumentedModelTier(model?: string | null): ResolvedDocumentedModelTier {
  if (!model || model.trim().length === 0) {
    return { ...DEFAULT_DOCUMENTED_MODEL_TIER, examples: [...DEFAULT_DOCUMENTED_MODEL_TIER.examples], matched_by: 'unreported' };
  }

  const normalized = model.trim().toLowerCase();
  const exact = DOCUMENTED_MODEL_TIERS.find((entry) => entry.examples.some((example) => example === normalized));
  if (exact) {
    return { ...exact, examples: [...exact.examples], matched_by: 'exact' };
  }

  const tokenize = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const normalizedTokens = tokenize(normalized);
  const heuristic = DOCUMENTED_MODEL_TIERS.flatMap((entry) =>
    entry.examples.map((example) => {
      const tokenMatches = tokenize(example).filter((token) => normalizedTokens.includes(token)).length;
      return { entry, tokenMatches, exampleLength: example.length };
    }),
  )
    .filter((candidate) => candidate.tokenMatches > 0)
    .sort((left, right) =>
      right.tokenMatches - left.tokenMatches || right.exampleLength - left.exampleLength,
    )[0]?.entry;
  if (heuristic) {
    return { ...heuristic, examples: [...heuristic.examples], matched_by: 'heuristic' };
  }

  const declaredTier = getDeclaredModelTier(normalized);
  const fallback = DOCUMENTED_MODEL_TIERS.find((entry) => entry.tier === declaredTier) ?? DEFAULT_DOCUMENTED_MODEL_TIER;
  return { ...fallback, examples: [...fallback.examples], matched_by: declaredTier === 0 ? 'fallback' : 'heuristic' };
}

function getUpgradeHint(currentTier: ModelTier, requiredTier?: number): string | undefined {
  if (requiredTier === undefined || currentTier >= requiredTier) {
    return undefined;
  }

  const nextPath = UPGRADE_PATHS.find((path) => path.from === currentTier);
  if (!nextPath) {
    return `Improve capability, reputation, and task history to reach Tier ${requiredTier}.`;
  }

  const steps = nextPath.conditions.map((condition) => condition.description).join('; ');
  return `Reach Tier ${requiredTier} by progressing from Tier ${nextPath.to} and satisfying: ${steps}`;
}

function getUpgradeProgress(
  agentId: string,
  currentTier: ModelTier,
  requiredTier?: number,
): Record<string, TierUpgradeMetric> | undefined {
  if (requiredTier === undefined || currentTier >= requiredTier) {
    return undefined;
  }

  const assessment = getTierAssessment(agentId);
  const basis = assessment?.assessment_basis;

  switch (requiredTier) {
    case 0:
      return {
        first_heartbeat: { current: basis?.task_completion_history.total_tasks ? 1 : 0, required: 1 },
      };
    case 2:
      return {
        single_tool_calls: {
          current: basis?.tool_proficiency.single_tool_success ?? 0,
          required: 10,
        },
        success_rate: {
          current: Math.round((basis?.task_completion_history.success_rate ?? 0) * 100),
          required: 80,
        },
        reputation: {
          current: basis?.reputation_score ?? 0,
          required: 100,
        },
      };
    case 3:
      return {
        multi_tool_tasks: {
          current: basis?.tool_proficiency.multi_tool_success ?? 0,
          required: 5,
        },
        reputation: {
          current: basis?.reputation_score ?? 0,
          required: 200,
        },
      };
    case 4:
      return {
        reputation: {
          current: basis?.reputation_score ?? 0,
          required: 400,
        },
        certification_score: {
          current: basis?.capability_test_score ?? 0,
          required: 80,
        },
      };
    case 5:
      return {
        reputation: {
          current: basis?.reputation_score ?? 0,
          required: 700,
        },
        certification_score: {
          current: basis?.capability_test_score ?? 0,
          required: 90,
        },
      };
    default:
      return undefined;
  }
}

function buildTierInsufficientResult(
  agentId: string,
  currentTier: ModelTier,
  requiredTier: number,
): TierClaimResult {
  return {
    allowed: false,
    error: 'TIER_INSUFFICIENT',
    current_tier: currentTier,
    required_tier: requiredTier,
    reason: `insufficient_model_tier: agent Tier ${currentTier} < required Tier ${requiredTier}`,
    upgrade_hint: getUpgradeHint(currentTier, requiredTier),
    upgrade_progress: getUpgradeProgress(agentId, currentTier, requiredTier),
  };
}

// ===== High-level service functions =====

function resolveCapabilityTier(requiredCapabilities?: string[]): ModelTier {
  if (!requiredCapabilities || requiredCapabilities.length === 0) {
    return 0;
  }

  return requiredCapabilities.reduce<ModelTier>((requiredTier, capability) => {
    const matchedTier = Object.values(TIER_INFO).find((info) => info.capabilities.includes(capability))?.tier ?? 0;
    return matchedTier > requiredTier ? matchedTier : requiredTier;
  }, 0);
}

export function evaluateTaskForAgent(
  agentId: string,
  task: {
    complexity?: number;
    required_capabilities?: string[];
    min_model_tier?: number;
    declared_model?: string;
  },
): { eligible: boolean; current_tier: ModelTier; reason?: string; required_tier?: number } {
  const result = evaluateModelTier(agentId, {
    complexity: task.complexity,
    required_capabilities: task.required_capabilities,
    declared_model: task.declared_model,
  });

  const complexityTier = task.complexity !== undefined
    ? (Math.min(5, Math.floor(task.complexity)) as ModelTier)
    : 0;
  const capabilityTier = resolveCapabilityTier(task.required_capabilities);
  const explicitTier = task.min_model_tier ?? 0;
  const requiredTier = Math.max(complexityTier, capabilityTier, explicitTier) as ModelTier;

  return {
    eligible: result.eligible && result.tier >= requiredTier,
    current_tier: result.tier,
    reason: result.reason,
    required_tier: requiredTier,
  };
}

export function claimTask(
  agentId: string,
  task: { min_model_tier?: number; allowed_models?: string[]; model?: string },
): TierClaimResult {
  const tier = getAgentTier(agentId);
  const model = task.model ?? getRecordedModel(agentId);

  if (
    model
    && task.allowed_models
    && task.allowed_models.length > 0
    && task.allowed_models.includes(model)
  ) {
    return {
      allowed: true,
      current_tier: tier,
      matched_model: model,
    };
  }

  if (task.min_model_tier !== undefined && tier < task.min_model_tier) {
    return buildTierInsufficientResult(agentId, tier, task.min_model_tier);
  }

  return { allowed: true, current_tier: tier };
}
