import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';

export async function constitutionRoutes(app: FastifyInstance) {
  const toRuleListResponse = (rules: ReturnType<typeof service.listRules>['rules'], total: number) => ({
    success: true,
    rules,
    total,
    data: rules,
    meta: { total },
  });

  const getAmendmentById = async (request: {
    params: { amendmentId: string };
  }) => {
    const amendment = await service.getAmendment(request.params.amendmentId);
    if (!amendment) {
      throw new EvoMapError(`Amendment not found: ${request.params.amendmentId}`, 'NOT_FOUND', 404);
    }
    return { success: true, amendment, data: amendment };
  };

  const voteOnAmendment = async (request: {
    auth?: { node_id: string };
    params: { amendmentId: string };
    body: {
      decision: 'approve' | 'reject' | 'abstain';
      weight?: number;
      reason?: string;
    };
  }) => {
    const auth = request.auth!;
    const { body } = request;

    if (!['approve', 'reject', 'abstain'].includes(body.decision)) {
      throw new EvoMapError('decision must be approve, reject, or abstain', 'VALIDATION_ERROR', 400);
    }

    const amendment = await service.voteOnAmendment(
      request.params.amendmentId,
      auth.node_id,
      body.decision,
      body.weight ?? 1,
      body.reason,
    );
    const latestVote = amendment.votes[amendment.votes.length - 1];
    return {
      success: true,
      amendment,
      your_vote: latestVote?.decision,
      your_weight: latestVote?.weight,
      approval_rate: amendment.approval_rate,
      status: amendment.status,
      total_votes: amendment.votes.length,
      data: amendment,
    };
  };

  const ratifyAmendment = async (request: { params: { amendmentId: string } }) => {
    const result = await service.ratifyAmendment(request.params.amendmentId);
    return {
      success: true,
      amendment: result.amendment,
      constitution_version: result.new_version,
      data: result,
    };
  };

  // ===== Rule Engine =====

  app.get('/rules', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const query = request.query as {
      category?: string;
      severity?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };

    const result = service.listRules({
      category: query.category,
      severity: query.severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
      status: query.status as 'active' | 'disabled' | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });

    return toRuleListResponse(result.rules, result.total);
  });

  app.get('/rule/:ruleId', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { ruleId: string };
    const rule = service.getRule(params.ruleId);
    if (!rule) {
      throw new EvoMapError(`Rule not found: ${params.ruleId}`, 'NOT_FOUND', 404);
    }
    return { success: true, rule, data: rule };
  });

  app.post('/rules', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      description: string;
      category: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      priority: number;
      condition: string;
      action: string;
      penalty?: {
        level: 1 | 2 | 3 | 4;
        reputation_penalty: number;
        credit_freeze_days?: number;
        quarantine_level?: 'L1' | 'L2' | 'L3';
      };
    };

    const rule = service.registerRule({
      name: body.name,
      description: body.description,
      category: body.category,
      severity: body.severity,
      priority: body.priority,
      condition: body.condition,
      action: body.action,
      enabled: true,
      penalty: body.penalty,
    });

    void reply.status(201);
    return { success: true, rule, data: rule };
  });

  app.post('/rule/:ruleId/disable', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { ruleId: string };
    const rule = service.disableRule(params.ruleId);
    return { success: true, rule, data: rule };
  });

  app.post('/rule/:ruleId/enable', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { ruleId: string };
    const rule = service.enableRule(params.ruleId);
    return { success: true, rule, data: rule };
  });

  app.post('/evaluate', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = request.body as {
      action: string;
      agent_id: string;
      target_id?: string;
      asset_id?: string;
      metadata?: Record<string, unknown>;
    };

    const context = {
      agent_id: body.agent_id,
      action: body.action,
      target_id: body.target_id,
      asset_id: body.asset_id,
      metadata: body.metadata,
      timestamp: new Date().toISOString(),
    };

    const result = await service.evaluateAction(body.action, context);
    return { success: true, data: result };
  });

  // ===== Ethics =====

  app.get('/ethics/:agentId', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { agentId: string };
    const profile = await service.getAgentEthicsProfile(params.agentId);
    return { success: true, profile, data: profile };
  });

  app.post('/ethics/detect', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = request.body as {
      action: string;
      agent_id: string;
      metadata?: Record<string, unknown>;
    };

    const result = await service.detectViolation(body.action, body.agent_id, body.metadata);
    return { success: true, data: result };
  });

  app.post('/ethics/conflict-check', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = request.body as {
      agent_id: string;
      transaction: {
        type: string;
        target_id?: string;
        amount?: number;
      };
    };

    const result = await service.checkConflictsOfInterest(body.agent_id, body.transaction);
    return { success: true, data: result };
  });

  app.post('/ethics/transparency-check', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = request.body as {
      agent_id: string;
      action: {
        type: string;
        metadata?: Record<string, unknown>;
      };
    };

    const result = await service.checkTransparencyRequirement(body.agent_id, body.action);
    return { success: true, data: result };
  });

  app.get('/violations/:agentId', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { agentId: string };
    const violations = service.getViolations(params.agentId);
    return { success: true, violations, total: violations.length, data: violations };
  });

  // ===== Amendments =====

  app.get('/constitution/version', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async () => {
    const version = await service.getConstitutionVersion();
    return { success: true, constitution_version: version, data: version };
  });

  app.post('/amendment', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { content: string };

    if (!body.content) {
      throw new EvoMapError('content is required', 'VALIDATION_ERROR', 400);
    }

    // Check cooldown
    const cooldown = await service.checkAmendmentCooldown(auth.node_id);
    if (!cooldown.can_propose) {
      throw new EvoMapError(
        `Amendment proposal is in cooldown until ${cooldown.cooldown_ends_at}`,
        'AMENDMENT_COOLDOWN',
        403,
      );
    }

    const amendment = await service.proposeAmendment(body.content, auth.node_id);
    void reply.status(201);
    return { success: true, amendment, data: amendment };
  });

  app.get('/amendments', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const query = request.query as {
      status?: string;
      proposer_id?: string;
    };

    const amendments = await service.listAmendments({
      status: query.status as 'proposed' | 'voting' | 'ratified' | 'rejected' | 'expired' | undefined,
      proposer_id: query.proposer_id,
    });

    return { success: true, amendments, total: amendments.length, data: amendments };
  });

  app.get('/amendment/:amendmentId', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => getAmendmentById(request as Parameters<typeof getAmendmentById>[0]));

  app.get('/amendments/:amendmentId', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => getAmendmentById(request as Parameters<typeof getAmendmentById>[0]));

  app.post('/amendment/:amendmentId/vote', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => voteOnAmendment(request as Parameters<typeof voteOnAmendment>[0]));

  app.post('/amendments/:amendmentId/vote', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => voteOnAmendment(request as Parameters<typeof voteOnAmendment>[0]));

  app.post('/amendment/:amendmentId/ratify', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => ratifyAmendment(request as Parameters<typeof ratifyAmendment>[0]));

  app.post('/amendments/:amendmentId/ratify', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => ratifyAmendment(request as Parameters<typeof ratifyAmendment>[0]));

  // ===== Conflict Detection =====

  app.get('/conflicts', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const query = request.query as { rule_id?: string };
    const conflicts = await service.detectConflicts(
      query.rule_id ? { rule_id: query.rule_id } : undefined,
    );
    return { success: true, data: conflicts };
  });

  app.post('/conflicts/resolve', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const body = request.body as {
      rule_a: string;
      rule_b: string;
      resolution: 'keep_a' | 'keep_b' | 'merge' | 'disable_both';
    };

    const result = await service.resolveConflict(body.rule_a, body.rule_b, body.resolution);
    return { success: true, data: result };
  });

  app.get('/conflicts/suggest-priority', {
    schema: { tags: ['Constitution'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const query = request.query as { rule_a: string; rule_b: string };
    const result = await service.suggestRulePriority(query.rule_a, query.rule_b);
    return { success: true, data: result };
  });
}
