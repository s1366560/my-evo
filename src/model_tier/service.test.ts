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
  evaluateTaskForAgent,
  claimTask,
} from './service';
import type { ModelTier } from './schemas';
import { TIER_INFO, UPGRADE_PATHS } from './schemas';

describe('Model Tier Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===== getTierInfo =====
  describe('getTierInfo', () => {
    it('should return correct info for each tier', () => {
      const tier0 = getTierInfo(0);
      expect(tier0.name).toBe('Observer');
      expect(tier0.tier).toBe(0);

      const tier3 = getTierInfo(3);
      expect(tier3.name).toBe('Reasoner');
      expect(tier3.capabilities).toContain('publish_gene');

      const tier5 = getTierInfo(5);
      expect(tier5.name).toBe('Superintelligent');
      expect(tier5.capabilities).toContain('self_evolve');
    });
  });

  // ===== setAgentTier / getAgentTier =====
  describe('setAgentTier / getAgentTier', () => {
    it('should set and retrieve agent tier', () => {
      setAgentTier('tier-agent-1', 2);
      expect(getAgentTier('tier-agent-1')).toBe(2);
    });

    it('should default to tier 0 for unknown agents', () => {
      expect(getAgentTier('unknown-agent')).toBe(0);
    });

    it('should reject invalid tier values', () => {
      expect(() => setAgentTier('bad-agent', 99 as ModelTier)).toThrow();
      expect(() => setAgentTier('bad-agent-2', -1 as ModelTier)).toThrow();
    });
  });

  // ===== evaluateModelTier =====
  describe('evaluateModelTier', () => {
    it('should return eligible for agent meeting requirements', () => {
      setAgentTier('eval-agent-1', 3);
      const result = evaluateModelTier('eval-agent-1', {
        required_capabilities: ['publish_gene'],
      });
      expect(result.eligible).toBe(true);
      expect(result.tier).toBe(3);
    });

    it('should return ineligible when tier is too low for capability', () => {
      setAgentTier('eval-agent-2', 1);
      const result = evaluateModelTier('eval-agent-2', {
        required_capabilities: ['publish_gene'],
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Insufficient tier');
    });

    it('should return ineligible when complexity exceeds tier', () => {
      setAgentTier('eval-agent-3', 2);
      const result = evaluateModelTier('eval-agent-3', { complexity: 5 });
      expect(result.eligible).toBe(false);
    });

    it('should initialize unknown agents at tier 0', () => {
      const result = evaluateModelTier('new-agent', {});
      expect(result.tier).toBe(0);
      expect(result.eligible).toBe(true);
    });
  });

  // ===== selectModel =====
  describe('selectModel', () => {
    it('should return models at or above required tier', () => {
      const tier0 = selectModel(0);
      expect(tier0.length).toBeGreaterThan(0);

      const tier5 = selectModel(5);
      expect(tier5.length).toBeGreaterThan(0);
    });

    it('should include higher tier models when selecting lower', () => {
      const tier2 = selectModel(2);
      expect(tier2).toContain('gpt-3.5-single-tool');
    });
  });

  // ===== checkCapability =====
  describe('checkCapability', () => {
    it('should allow agent with sufficient tier', () => {
      setAgentTier('cap-agent-1', 3);
      const result = checkCapability('cap-agent-1', 'publish_gene');
      expect(result.allowed).toBe(true);
      expect(result.current_tier).toBe(3);
    });

    it('should deny agent with insufficient tier', () => {
      setAgentTier('cap-agent-2', 1);
      const result = checkCapability('cap-agent-2', 'publish_gene');
      expect(result.allowed).toBe(false);
      expect(result.required_tier).toBeDefined();
      expect(result.current_tier).toBe(1);
    });

    it('should deny unknown capability', () => {
      setAgentTier('cap-agent-3', 5);
      const result = checkCapability('cap-agent-3', 'nonexistent_capability_xyz');
      expect(result.allowed).toBe(false);
    });
  });

  // ===== upgradeTier =====
  describe('upgradeTier', () => {
    it('should upgrade tier with valid evidence (T1->T2)', () => {
      setAgentTier('upgrade-agent-1', 1);
      const result = upgradeTier('upgrade-agent-1', {
        reputation_score: 150,
        tool_proficiency: { single_tool_success: 15, multi_tool_success: 0, loop_tool_success: 0 },
        task_completion_history: { total_tasks: 20, success_rate: 0.9, avg_complexity: 1 },
      });
      expect(result.success).toBe(true);
      expect(result.new_tier).toBe(2);
    });

    it('should fail upgrade without sufficient evidence', () => {
      setAgentTier('upgrade-agent-2', 1);
      const result = upgradeTier('upgrade-agent-2', {
        reputation_score: 50,
        tool_proficiency: { single_tool_success: 3, multi_tool_success: 0, loop_tool_success: 0 },
        task_completion_history: { total_tasks: 5, success_rate: 0.5, avg_complexity: 1 },
      });
      expect(result.success).toBe(false);
      expect(result.new_tier).toBe(1);
    });

    it('should not upgrade beyond Tier 5', () => {
      setAgentTier('upgrade-agent-3', 5);
      const result = upgradeTier('upgrade-agent-3', {});
      expect(result.success).toBe(false);
      expect(result.reason).toContain('maximum');
    });

    it('should create a tier assessment record after upgrade', () => {
      setAgentTier('assess-agent', 1);
      upgradeTier('assess-agent', {
        reputation_score: 150,
        tool_proficiency: { single_tool_success: 15, multi_tool_success: 0, loop_tool_success: 0 },
        task_completion_history: { total_tasks: 20, success_rate: 0.9, avg_complexity: 1 },
      });
      const assessment = getTierAssessment('assess-agent');
      expect(assessment).not.toBeNull();
      expect(assessment!.current_tier).toBe(2);
    });
  });

  // ===== downgradeTier =====
  describe('downgradeTier', () => {
    it('should downgrade by one tier', () => {
      setAgentTier('downgrade-agent-1', 3);
      const result = downgradeTier('downgrade-agent-1', 'consecutive_failures');
      expect(result.success).toBe(true);
      expect(result.new_tier).toBe(2);
    });

    it('should refuse downgrade below minimum', () => {
      setAgentTier('downgrade-agent-2', 1);
      const result = downgradeTier('downgrade-agent-2', 'consecutive_failures');
      expect(result.success).toBe(false);
    });

    it('should allow security event downgrade to tier 0', () => {
      setAgentTier('downgrade-agent-3', 3);
      const result = downgradeTier('downgrade-agent-3', 'security_event');
      expect(result.success).toBe(true);
      expect(result.new_tier).toBe(0);
    });
  });

  // ===== getTierRateLimits =====
  describe('getTierRateLimits', () => {
    it('should return correct rate limits per tier', () => {
      const t0Limits = getTierRateLimits(0);
      expect(t0Limits.api_per_minute).toBe(5);
      expect(t0Limits.publish_per_day).toBe(0);

      const t4Limits = getTierRateLimits(4);
      expect(t4Limits.api_per_minute).toBe(50);
      expect(t4Limits.publish_per_day).toBe(50);
    });
  });

  // ===== getAllUpgradePaths =====
  describe('getAllUpgradePaths', () => {
    it('should return all 5 upgrade paths', () => {
      const paths = getAllUpgradePaths();
      expect(paths).toHaveLength(5);
      expect(paths.map((p) => `${p.from}->${p.to}`)).toEqual(['0->1', '1->2', '2->3', '3->4', '4->5']);
    });
  });

  // ===== evaluateTaskForAgent =====
  describe('evaluateTaskForAgent', () => {
    it('should return eligible when agent meets requirements', () => {
      setAgentTier('task-agent-1', 3);
      const result = evaluateTaskForAgent('task-agent-1', {
        min_model_tier: 2,
        required_capabilities: ['publish_gene'],
      });
      expect(result.eligible).toBe(true);
      expect(result.current_tier).toBe(3);
    });

    it('should return ineligible when min_model_tier not met', () => {
      setAgentTier('task-agent-2', 1);
      const result = evaluateTaskForAgent('task-agent-2', { min_model_tier: 3 });
      expect(result.eligible).toBe(false);
      expect(result.required_tier).toBe(3);
    });
  });

  // ===== claimTask =====
  describe('claimTask', () => {
    it('should allow claim when tier meets requirement', () => {
      setAgentTier('claim-agent-1', 3);
      const result = claimTask('claim-agent-1', { min_model_tier: 2 });
      expect(result.allowed).toBe(true);
    });

    it('should deny claim when tier insufficient', () => {
      setAgentTier('claim-agent-2', 1);
      const result = claimTask('claim-agent-2', { min_model_tier: 3 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('insufficient_model_tier');
    });

    it('should always allow claim if allowed_models list provided', () => {
      setAgentTier('claim-agent-3', 0);
      const result = claimTask('claim-agent-3', {
        min_model_tier: 5,
        allowed_models: ['custom-model'],
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ===== TIER_INFO consistency =====
  describe('TIER_INFO consistency', () => {
    it('should have correct capability counts per tier', () => {
      expect(TIER_INFO[0].capabilities).toHaveLength(1); // read_public
      expect(TIER_INFO[2].capabilities).toContain('publish_gene');
      expect(TIER_INFO[5].capabilities).toContain('self_evolve');
    });

    it('should have min_reputation matching upgrade thresholds', () => {
      expect(TIER_INFO[1].min_reputation).toBe(0);
      expect(TIER_INFO[2].min_reputation).toBe(100);
      expect(TIER_INFO[4].min_reputation).toBe(400);
    });
  });
});
