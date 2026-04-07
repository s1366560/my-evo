import type { FastifyInstance } from 'fastify';
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
import { ValidationError } from '../shared/errors';

export async function modelTierRoutes(app: FastifyInstance): Promise<void> {
  // GET /model-tier/tiers — list all tier definitions
  app.get('/model-tier/tiers', {
    schema: { tags: ['ModelTier'] },
  }, async (_request, reply) => {
    const tiers = [0, 1, 2, 3, 4, 5].map(t => {
      const info = getTierInfo(t as Parameters<typeof getTierInfo>[0]);
      const limits = getTierRateLimits(t as Parameters<typeof getTierRateLimits>[0]);
      return { ...info, rate_limits: limits };
    });
    return reply.send({ success: true, data: tiers });
  });

  // GET /model-tier/tiers/:tier — get specific tier
  app.get('/model-tier/tiers/:tier', {
    schema: { tags: ['ModelTier'] },
  }, async (request, reply) => {
    const { tier } = request.params as { tier: string };
    const t = parseInt(tier, 10);
    if (isNaN(t) || t < 0 || t > 5) {
      throw new ValidationError('Tier must be between 0 and 5');
    }
    const info = getTierInfo(t as Parameters<typeof getTierInfo>[0]);
    const limits = getTierRateLimits(t as Parameters<typeof getTierRateLimits>[0]);
    return reply.send({ success: true, data: { ...info, rate_limits: limits } });
  });

  // GET /model-tier/agents/:agentId — get agent's current tier
  app.get('/model-tier/agents/:agentId', {
    schema: { tags: ['ModelTier'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const tier = getAgentTier(agentId);
    const info = getTierInfo(tier);
    const limits = getTierRateLimits(tier);
    return reply.send({ success: true, data: { agent_id: agentId, ...info, rate_limits: limits } });
  });

  // PUT /model-tier/agents/:agentId/tier — set agent tier
  app.put('/model-tier/agents/:agentId/tier', {
    schema: { tags: ['ModelTier'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as { tier: number };
    if (body.tier === undefined || body.tier < 0 || body.tier > 5) {
      throw new ValidationError('Tier must be between 0 and 5');
    }
    const info = setAgentTier(agentId, body.tier as Parameters<typeof setAgentTier>[1]);
    return reply.send({
      success: true,
      data: { agent_id: agentId, tier: body.tier, name: info.name, description: info.description, min_reputation: info.min_reputation, typical_models: info.typical_models, capabilities: info.capabilities },
    });
  });

  // POST /model-tier/agents/:agentId/evaluate — evaluate agent for a task
  app.post('/model-tier/agents/:agentId/evaluate', {
    schema: { tags: ['ModelTier'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as {
      complexity?: number;
      required_capabilities?: string[];
      min_model_tier?: number;
    };
    const result = evaluateTaskForAgent(agentId, body);
    return reply.send({ success: true, data: result });
  });

  // POST /model-tier/agents/:agentId/claim — check if agent can claim task
  app.post('/model-tier/agents/:agentId/claim', {
    schema: { tags: ['ModelTier'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as {
      min_model_tier?: number;
      allowed_models?: string[];
    };
    const result = claimTask(agentId, body);
    if (!result.allowed) {
      return reply.status(403).send({ success: false, ...result });
    }
    return reply.send({ success: true, ...result });
  });

  // POST /model-tier/agents/:agentId/capability — check capability
  app.post('/model-tier/agents/:agentId/capability', {
    schema: { tags: ['ModelTier'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as { capability: string };
    if (!body.capability) {
      throw new ValidationError('capability is required');
    }
    const result = checkCapability(agentId, body.capability);
    return reply.send({ success: true, data: result });
  });

  // POST /model-tier/agents/:agentId/upgrade — upgrade agent tier
  app.post('/model-tier/agents/:agentId/upgrade', {
    schema: { tags: ['ModelTier'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as {
      capability_test_score?: number;
      reputation_score?: number;
      tool_proficiency?: {
        single_tool_success?: number;
        multi_tool_success?: number;
        loop_tool_success?: number;
      };
      task_completion_history?: {
        total_tasks?: number;
        success_rate?: number;
        avg_complexity?: number;
      };
    };
    const result = upgradeTier(agentId, body as Parameters<typeof upgradeTier>[1]);
    if (!result.success) {
      const { success: _s, ...failRest } = result;
      return reply.status(400).send({ success: false, ...failRest });
    }
    const { success: _s2, ...okRest } = result;
    return reply.send({ success: true, ...okRest });
  });

  // POST /model-tier/agents/:agentId/downgrade — downgrade agent tier
  app.post('/model-tier/agents/:agentId/downgrade', {
    schema: { tags: ['ModelTier'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as { reason: string };
    if (!body.reason) {
      throw new ValidationError('reason is required');
    }
    const result = downgradeTier(agentId, body.reason);
    if (!result.success) {
      const { success: _s, ...failRest } = result;
      return reply.status(400).send({ success: false, ...failRest });
    }
    const { success: _s2, ...okRest } = result;
    return reply.send({ success: true, ...okRest });
  });

  // GET /model-tier/agents/:agentId/assessment — get tier assessment
  app.get('/model-tier/agents/:agentId/assessment', {
    schema: { tags: ['ModelTier'] },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const assessment = getTierAssessment(agentId);
    if (!assessment) {
      return reply.send({ success: true, data: null });
    }
    return reply.send({ success: true, data: assessment });
  });

  // GET /model-tier/upgrade-paths — get all upgrade paths
  app.get('/model-tier/upgrade-paths', {
    schema: { tags: ['ModelTier'] },
  }, async (_request, reply) => {
    const paths = getAllUpgradePaths();
    return reply.send({ success: true, data: paths });
  });

  // GET /model-tier/select-model — select models for required tier
  app.get('/model-tier/select-model', {
    schema: { tags: ['ModelTier'] },
  }, async (request, reply) => {
    const { required_tier } = request.query as { required_tier?: string };
    if (!required_tier) {
      throw new ValidationError('required_tier query param is required');
    }
    const t = parseInt(required_tier, 10);
    if (isNaN(t) || t < 0 || t > 5) {
      throw new ValidationError('required_tier must be between 0 and 5');
    }
    const models = selectModel(t as Parameters<typeof selectModel>[0]);
    return reply.send({ success: true, data: { required_tier: t, models } });
  });
}
