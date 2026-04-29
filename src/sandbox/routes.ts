import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError, ForbiddenError } from '../shared/errors';
import { resolveAuthorizedNodeId } from '../shared/node-access';
import { getSubscriptionStatus } from '../subscription/service';
import * as service from './service';

const SANDBOX_ALLOWED_PLANS = new Set(['premium', 'ultra']);
const SANDBOX_ALLOWED_STATUSES = new Set(['active', 'grace_period']);

function toSpecIsolationMode(isolationLevel?: string): string {
  if (isolationLevel === 'soft') {
    return 'soft-tagged';
  }

  if (isolationLevel === 'hard') {
    return 'hard-isolated';
  }

  return isolationLevel ?? 'soft-tagged';
}

function getSandboxExperiments(metadata: unknown): Array<Record<string, unknown>> {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    return [];
  }

  const experiments = (metadata as Record<string, unknown>).experiments;
  return Array.isArray(experiments)
    ? experiments.filter(
        (experiment): experiment is Record<string, unknown> =>
          typeof experiment === 'object' && experiment !== null && !Array.isArray(experiment),
      )
    : [];
}

function toSpecMemberRole(role?: string): string {
  return role === 'observer' ? 'observer' : 'participant';
}

function toSpecMember(member: Record<string, any>) {
  return {
    ...member,
    role: toSpecMemberRole(member.role),
  };
}

function toSpecSandboxDetail(sandbox: Record<string, any>) {
  return {
    sandbox_id: sandbox.sandbox_id,
    name: sandbox.name,
    description: sandbox.description,
    status: sandbox.state,
    isolation_mode: toSpecIsolationMode(sandbox.isolation_level),
    assets: Array.isArray(sandbox.assets)
      ? sandbox.assets
        .map((asset) => asset?.asset_id)
        .filter((assetId): assetId is string => typeof assetId === 'string' && assetId.length > 0)
      : [],
    experiments: getSandboxExperiments(sandbox.metadata),
    members: Array.isArray(sandbox.members)
      ? sandbox.members.map((member) => toSpecMember(member as Record<string, any>))
      : [],
    created_by: sandbox.created_by,
    created_at: sandbox.created_at,
    updated_at: sandbox.updated_at,
  };
}

function toSpecComparison(result: Record<string, any>): Record<string, any> {
  return {
    ...result,
    isolation_mode: toSpecIsolationMode(result.isolation_mode),
  };
}

async function resolveSandboxNodeId(
  app: FastifyInstance,
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
) {
  return resolveAuthorizedNodeId(app, auth, {
    missingNodeMessage: 'No accessible node found for current credentials',
  });
}

async function requireSandboxEntitlement(nodeId: string): Promise<void> {
  const subscription = await getSubscriptionStatus(nodeId);

  if (
    !subscription
    || !SANDBOX_ALLOWED_PLANS.has(subscription.plan)
    || !SANDBOX_ALLOWED_STATUSES.has(subscription.status)
  ) {
    throw new ForbiddenError(
      'Evolution Sandbox requires an active Premium or Ultra subscription',
    );
  }
}

async function resolveEntitledSandboxNodeId(
  app: FastifyInstance,
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
) {
  const nodeId = await resolveSandboxNodeId(app, auth);
  await requireSandboxEntitlement(nodeId);
  return nodeId;
}

export async function sandboxRoutes(app: FastifyInstance) {
  // List sandboxes
  app.get('/sandboxes', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const query = request.query as {
      state?: string;
      isolation_level?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listSandboxes(
      query.state,
      query.isolation_level,
      query.limit ? parseInt(query.limit, 10) : 20,
      query.offset ? parseInt(query.offset, 10) : 0,
      nodeId,
    );

    return {
      success: true,
      sandboxes: result.items,
      total: result.total,
      data: { items: result.items, total: result.total },
    };
  });

  app.get('/list', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const query = request.query as {
      status?: string;
      state?: string;
      isolation_mode?: string;
      isolation_level?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listSandboxes(
      query.status ?? query.state,
      query.isolation_mode === 'soft-tagged'
        ? 'soft'
        : query.isolation_mode === 'hard-isolated'
          ? 'hard'
          : query.isolation_level,
      query.limit ? parseInt(query.limit, 10) : 20,
      query.offset ? parseInt(query.offset, 10) : 0,
      nodeId,
    );

    return {
      success: true,
      sandboxes: result.items.map((sandbox) => ({
        sandbox_id: sandbox.sandbox_id,
        name: sandbox.name,
        status: sandbox.state,
        isolation_mode: toSpecIsolationMode(sandbox.isolation_level),
      })),
      total: result.total,
      data: {
        sandboxes: result.items.map((sandbox) => ({
          sandbox_id: sandbox.sandbox_id,
          name: sandbox.name,
          status: sandbox.state,
          isolation_mode: toSpecIsolationMode(sandbox.isolation_level),
        })),
        total: result.total,
      },
    };
  });

  app.get('/stats', {
    schema: { tags: ['Sandbox'] },
  }, async (_request) => {
    const stats = await service.getSandboxStats();
    return { success: true, ...stats, data: stats };
  });

  // Get sandbox detail
  app.get('/:sandboxId', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const sandbox = await service.getSandbox(params.sandboxId, nodeId);
    const detail = toSpecSandboxDetail(sandbox as Record<string, any>);
    return { success: true, sandbox: detail, data: { sandbox_id: detail.sandbox_id, name: detail.name, description: detail.description, status: detail.status, isolation_mode: detail.isolation_mode, assets: detail.assets, experiments: detail.experiments, members: detail.members } };
  });

  // Create sandbox
  app.post('/', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = request.body as {
      name: string;
      description: string;
      isolation_level?: string;
      env?: string;
      tags?: string[];
    };

    if (!body.name || !body.description) {
      throw new EvoMapError('name and description are required', 'VALIDATION_ERROR', 400);
    }

    const sandbox = await service.createSandbox(
      nodeId,
      body.name,
      body.description,
      body.isolation_level,
      body.env,
      body.tags,
    );

    void reply.status(201);
    return { success: true, sandbox, data: sandbox };
  });

  app.post('/create', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = request.body as {
      name?: string;
      description?: string;
      isolation_mode?: string;
      base_gene_id?: string;
      experiment_config?: Record<string, unknown>;
      tags?: string[];
    };

    if (!body.name) {
      throw new EvoMapError('name is required', 'VALIDATION_ERROR', 400);
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const sandbox = await service.createSandbox(
      nodeId,
      body.name,
      body.description ?? `Sandbox experiment for ${body.base_gene_id ?? body.name}`,
      body.isolation_mode === 'soft-tagged'
        ? 'soft'
        : body.isolation_mode === 'hard-isolated'
          ? 'hard'
          : body.isolation_mode,
      undefined,
      body.tags,
      {
        base_gene_id: body.base_gene_id ?? null,
        experiment_config: body.experiment_config ?? {},
        expires_at: expiresAt,
      },
    );

    return reply.send({
      success: true,
      sandbox_id: sandbox.sandbox_id,
      isolation_level: sandbox.isolation_level,
      state: sandbox.state,
      data: {
        sandbox_id: sandbox.sandbox_id,
        status: sandbox.state,
        isolation_mode: toSpecIsolationMode(sandbox.isolation_level),
        expires_at: expiresAt,
      },
    });
  });

  // Update sandbox
  app.put('/:sandboxId', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = request.body as {
      name?: string;
      description?: string;
      isolation_level?: string;
      env?: string;
      state?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    };

    const sandbox = await service.updateSandbox(params.sandboxId, nodeId, body);
    return { success: true, sandbox, data: sandbox };
  });

  // Delete sandbox
  app.delete('/:sandboxId', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    await service.deleteSandbox(params.sandboxId, nodeId);
    return { success: true, deleted: true, data: null };
  });

  // Join sandbox
  app.post('/:sandboxId/join', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const member = await service.joinSandbox(params.sandboxId, nodeId);
    const specMember = toSpecMember(member as Record<string, any>);
    return { success: true, member: specMember, data: specMember };
  });

  // Leave sandbox
  app.post('/:sandboxId/leave', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    await service.leaveSandbox(params.sandboxId, nodeId);
    return { success: true, left: true, data: null };
  });

  // List members
  app.get('/:sandboxId/members', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const members = await service.listMembers(params.sandboxId, nodeId);
    const specMembers = members.map((member) => toSpecMember(member as Record<string, any>));
    return { success: true, members: specMembers, total: specMembers.length, data: specMembers };
  });

  // Invite member
  app.post('/:sandboxId/invite', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = request.body as {
      invitee: string;
      role?: string;
    };

    if (!body.invitee) {
      throw new EvoMapError('invitee is required', 'VALIDATION_ERROR', 400);
    }

    const invite = await service.inviteMember(
      params.sandboxId,
      nodeId,
      body.invitee,
      body.role,
    );

    const specInvite = {
      ...invite,
      role: toSpecMemberRole(invite.role),
    };

    void reply.status(201);
    return { success: true, invite: specInvite, data: specInvite };
  });

  // List sandbox assets
  app.get('/:sandboxId/assets', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const assets = await service.listAssets(params.sandboxId, nodeId);
    return { success: true, assets, total: assets.length, data: assets };
  });

  // Add asset to sandbox
  app.post('/:sandboxId/assets', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = request.body as {
      asset_id: string;
      asset_type: string;
      name: string;
      content: string;
      signals_match?: string[];
      strategy?: string[];
      tags?: string[];
    };

    if (!body.asset_id || !body.asset_type || !body.name || !body.content) {
      throw new EvoMapError('asset_id, asset_type, name, and content are required', 'VALIDATION_ERROR', 400);
    }

    const asset = await service.addAsset(params.sandboxId, nodeId, {
      asset_id: body.asset_id,
      asset_type: body.asset_type,
      name: body.name,
      content: body.content,
      signals_match: body.signals_match,
      strategy: body.strategy,
      tags: body.tags,
    });

    void reply.status(201);
    return { success: true, asset, data: asset };
  });

  app.post('/:sandboxId/asset', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = request.body as { asset_id?: string };

    if (!body.asset_id) {
      throw new EvoMapError('asset_id is required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.attachExistingAssetToSandbox(
      params.sandboxId,
      nodeId,
      body.asset_id,
    );

    return { success: true, result, data: result };
  });

  app.post('/:sandboxId/experiment', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = request.body as {
      experiment_type?: string;
      target_gene?: string;
      mutation_strategy?: string;
      parameters?: Record<string, unknown>;
    };

    if (!body.experiment_type) {
      throw new EvoMapError('experiment_type is required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.runExperiment(params.sandboxId, nodeId, {
      experiment_type: body.experiment_type,
      target_gene: body.target_gene,
      mutation_strategy: body.mutation_strategy,
      parameters: body.parameters,
    });

    return { success: true, experiment: result, data: result };
  });

  app.post('/:sandboxId/modify', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = request.body as {
      asset_id?: string;
      modifications?: Record<string, unknown>;
    };

    if (!body.asset_id) {
      throw new EvoMapError('asset_id is required', 'VALIDATION_ERROR', 400);
    }
    if (!body.modifications || typeof body.modifications !== 'object') {
      throw new EvoMapError('modifications are required', 'VALIDATION_ERROR', 400);
    }

    const result = await service.modifySandboxAsset(
      params.sandboxId,
      nodeId,
      body.asset_id,
      body.modifications,
    );
    return { success: true, result, data: result };
  });

  app.post('/:sandboxId/complete', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = (request.body as {
      promote_assets?: string[];
      summary?: string;
    } | undefined) ?? {};

    const result = await service.completeSandbox(params.sandboxId, nodeId, {
      promote_assets: body.promote_assets,
      summary: body.summary,
    });
    return { success: true, result, data: result };
  });

  app.get('/:sandboxId/compare', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const result = await service.compareSandbox(params.sandboxId, nodeId);
    const comparison = toSpecComparison(result as Record<string, any>) as Record<string, any>;
    return { success: true, comparison, data: { sandbox_id: comparison.sandbox_id, total_assets: comparison.total_assets, isolation_mode: comparison.isolation_mode } };
  });

  // Request promotion
  app.post('/:sandboxId/promote', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = request.body as { asset_id: string };

    if (!body.asset_id) {
      throw new EvoMapError('asset_id is required', 'VALIDATION_ERROR', 400);
    }

    const request2 = await service.requestPromotion(
      params.sandboxId,
      nodeId,
      body.asset_id,
    );

    void reply.status(201);
    return { success: true, ...request2, promotion_request: request2, data: request2 };
  });

  // List promotion requests
  app.get('/:sandboxId/promotions', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const promotions = await service.listPromotions(params.sandboxId, nodeId);
    return { success: true, promotions, total: promotions.length, data: promotions };
  });

  // Approve promotion
  app.post('/:sandboxId/promotions/:requestId/approve', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string; requestId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const result = await service.approvePromotion(
      params.sandboxId,
      params.requestId,
      nodeId,
    );
    return { success: true, ...result, promotion: result, data: result };
  });

  // Reject promotion
  app.post('/:sandboxId/promotions/:requestId/reject', {
    schema: { tags: ['Sandbox'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { sandboxId: string; requestId: string };
    const auth = request.auth!;
    const nodeId = await resolveEntitledSandboxNodeId(app, auth);
    const body = request.body as { note?: string };
    const result = await service.rejectPromotion(
      params.sandboxId,
      params.requestId,
      nodeId,
      body.note ?? '',
    );
    return { success: true, ...result, promotion: result, data: result };
  });
}
