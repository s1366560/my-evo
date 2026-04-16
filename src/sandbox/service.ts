import { PrismaClient, Prisma } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../shared/errors';
import { getSandboxEntitlement } from '../subscription/service';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

export interface ListSandboxesInput {
  state?: string;
  isolationLevel?: string;
  limit?: number;
  offset?: number;
}

function normalizeSandboxMemberRole(role?: string | null): 'participant' | 'observer' {
  return role === 'observer' ? 'observer' : 'participant';
}

function isSandboxMutableState(state?: string | null): boolean {
  return state === undefined || state === null || state === 'active';
}

function getSandboxMetadata(metadata: unknown): Record<string, unknown> {
  if (typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }

  return {};
}

function getSandboxExperiments(metadata: unknown): Array<Record<string, unknown>> {
  const sandboxMetadata = getSandboxMetadata(metadata);
  return Array.isArray(sandboxMetadata.experiments)
    ? [...(sandboxMetadata.experiments as Array<Record<string, unknown>>)]
    : [];
}

function isSandboxTerminal(state?: string | null): boolean {
  return state === 'completed' || state === 'archived';
}

function assertSandboxMutable(
  sandbox: { state?: string | null },
  action = 'modify this sandbox',
): void {
  if (isSandboxTerminal(sandbox.state)) {
    throw new ValidationError(`Cannot ${action} after sandbox completion`);
  }

  if (!isSandboxMutableState(sandbox.state)) {
    throw new ValidationError(`Cannot ${action} while sandbox state is ${sandbox.state ?? 'unknown'}`);
  }
}

type SandboxMutationClient = PrismaClient | Prisma.TransactionClient;

async function assertSandboxMutableInTransaction(
  client: SandboxMutationClient,
  sandboxId: string,
  action: string,
  now: Date,
): Promise<void> {
  const result = await client.evolutionSandbox.updateMany({
    where: {
      sandbox_id: sandboxId,
      NOT: { state: { in: ['completed', 'archived'] } },
    },
    data: { updated_at: now },
  });

  if (result.count === 0) {
    const sandbox = await client.evolutionSandbox.findUnique({
      where: { sandbox_id: sandboxId },
      select: { state: true },
    });
    if (!sandbox) {
      throw new NotFoundError('Sandbox', sandboxId);
    }
    throw new ValidationError(`Cannot ${action} after sandbox completion`);
  }
}

async function requireSandboxRecord(sandboxId: string) {
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

  return sandbox;
}

async function requireSandboxAccess(
  sandboxId: string,
  nodeId: string,
  access: 'member' | 'participant' | 'owner',
) {
  const sandbox = await requireSandboxRecord(sandboxId);

  if (sandbox.created_by === nodeId) {
    return sandbox;
  }

  const member = await prisma.sandboxMember.findUnique({
    where: {
      sandbox_id_node_id: {
        sandbox_id: sandboxId,
        node_id: nodeId,
      },
    },
  });

  if (member) {
    if (access === 'member') {
      return sandbox;
    }

    if (access === 'participant' && member.role !== 'observer') {
      return sandbox;
    }

    if (member.role === 'owner') {
      return sandbox;
    }
  }

  throw new ForbiddenError(
    access === 'owner'
      ? 'Only the sandbox owner can perform this action'
      : access === 'participant'
        ? 'Sandbox participant access required'
        : 'Sandbox access denied',
  );
}

async function assertSandboxCreationAllowed(
  nodeId: string,
  isolationLevel?: string,
): Promise<void> {
  const entitlement = await getSandboxEntitlement(nodeId);
  if (!entitlement.enabled) {
    throw new ForbiddenError('Evolution Sandbox requires an active Premium or Ultra subscription');
  }

  if (isolationLevel === 'hard' && !entitlement.hard_isolated_mode) {
    throw new ForbiddenError('Hard-isolated sandboxes require a plan with hard isolation enabled');
  }

  const activeSandboxes = await prisma.evolutionSandbox.count({
    where: {
      created_by: nodeId,
      state: { in: ['active', 'frozen'] },
    },
  });

  if (activeSandboxes >= entitlement.concurrent_sandboxes) {
    throw new ValidationError(`Sandbox limit reached for ${entitlement.plan} plan`);
  }
}

export async function listSandboxes(
  state?: string,
  isolationLevel?: string,
  limit = 20,
  offset = 0,
  nodeId?: string,
) {
  const filters: Record<string, unknown>[] = [];
  if (state) {
    filters.push({ state });
  }
  if (isolationLevel) {
    filters.push({ isolation_level: isolationLevel });
  }
  if (nodeId) {
    filters.push({
      OR: [
        { created_by: nodeId },
        { members: { some: { node_id: nodeId } } },
      ],
    });
  }
  const where = filters.length > 0 ? { AND: filters } : {};

  const [items, total] = await Promise.all([
    prisma.evolutionSandbox.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.evolutionSandbox.count({ where }),
  ]);

  return { items, total };
}

export async function getSandbox(sandboxId: string, nodeId: string) {
  await requireSandboxAccess(sandboxId, nodeId, 'member');

  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
    include: {
      members: true,
      assets: true,
    },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

  return sandbox;
}

export async function createSandbox(
  createdBy: string,
  name: string,
  description: string,
  isolationLevel?: string,
  env?: string,
  tags?: string[],
  metadata?: Record<string, unknown>,
) {
  await assertSandboxCreationAllowed(createdBy, isolationLevel);
  const sandboxId = crypto.randomUUID();
  const now = new Date();

  const sandbox = await prisma.evolutionSandbox.create({
    data: {
      sandbox_id: sandboxId,
      name,
      description,
      isolation_level: isolationLevel ?? 'soft',
      env: env ?? 'staging',
      state: 'active',
      created_by: createdBy,
      tags: tags ?? [],
      metadata: metadata as Prisma.InputJsonValue | undefined,
      created_at: now,
      updated_at: now,
    },
  });

  // Auto-add creator as owner member
  await prisma.sandboxMember.create({
    data: {
      sandbox_id: sandboxId,
      node_id: createdBy,
      role: 'owner',
      joined_at: now,
      updated_at: now,
    },
  });

  // Increment member_count
  await prisma.evolutionSandbox.update({
    where: { sandbox_id: sandboxId },
    data: { member_count: 1 },
  });

  return {
    ...sandbox,
    member_count: 1,
  };
}

export async function updateSandbox(
  sandboxId: string,
  nodeId: string,
  updates: {
    name?: string;
    description?: string;
    isolation_level?: string;
    env?: string;
    state?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  },
) {
  const sandbox = await requireSandboxAccess(sandboxId, nodeId, 'owner');
  assertSandboxMutable(sandbox, 'update this sandbox');
  if (updates.state && isSandboxTerminal(updates.state)) {
    throw new ValidationError('Use completeSandbox to move a sandbox into a terminal state');
  }
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'update this sandbox', now);

    return tx.evolutionSandbox.update({
      where: { sandbox_id: sandboxId },
      data: {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.isolation_level !== undefined ? { isolation_level: updates.isolation_level } : {}),
        ...(updates.env !== undefined ? { env: updates.env } : {}),
        ...(updates.state !== undefined ? { state: updates.state } : {}),
        ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
        ...(updates.metadata !== undefined ? { metadata: updates.metadata as import('@prisma/client').Prisma.InputJsonValue } : {}),
        updated_at: now,
      },
    });
  });
}

export async function deleteSandbox(sandboxId: string, nodeId: string) {
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

  if (sandbox.created_by !== nodeId) {
    throw new ForbiddenError('Only the creator can delete a sandbox');
  }
  assertSandboxMutable(sandbox, 'delete this sandbox');

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'delete this sandbox', now);

    await tx.promotionRequest.deleteMany({ where: { sandbox_id: sandboxId } });
    await tx.sandboxAsset.deleteMany({ where: { sandbox_id: sandboxId } });
    await tx.sandboxMember.deleteMany({ where: { sandbox_id: sandboxId } });
    await tx.sandboxInvite.deleteMany({ where: { sandbox_id: sandboxId } });
    await tx.evolutionSandbox.delete({ where: { sandbox_id: sandboxId } });
  });
}

export async function joinSandbox(sandboxId: string, nodeId: string) {
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

  if (sandbox.state !== 'active') {
    throw new ValidationError('Sandbox is not accepting new members');
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'join this sandbox', now);

    const existingMember = await tx.sandboxMember.findUnique({
      where: {
        sandbox_id_node_id: {
          sandbox_id: sandboxId,
          node_id: nodeId,
        },
      },
    });

    if (existingMember) {
      return tx.sandboxMember.update({
        where: {
          sandbox_id_node_id: {
            sandbox_id: sandboxId,
            node_id: nodeId,
          },
        },
        data: {
          last_activity_at: now,
          updated_at: now,
        },
      });
    }

    const invite = await tx.sandboxInvite.findFirst({
      where: {
        sandbox_id: sandboxId,
        invitee: nodeId,
        status: 'pending',
      },
    });

    if (!invite) {
      throw new ForbiddenError('Sandbox invite required');
    }

    const member = await tx.sandboxMember.create({
      data: {
        sandbox_id: sandboxId,
        node_id: nodeId,
        role: normalizeSandboxMemberRole(invite.role),
        joined_at: now,
        updated_at: now,
      },
    });

    await tx.evolutionSandbox.update({
      where: { sandbox_id: sandboxId },
      data: { member_count: { increment: 1 } },
    });

    await tx.sandboxInvite.updateMany({
      where: {
        sandbox_id: sandboxId,
        invitee: nodeId,
        status: 'pending',
      },
      data: {
        status: 'accepted',
      },
    });

    return member;
  });
}

export async function leaveSandbox(sandboxId: string, nodeId: string) {
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

  if (sandbox.created_by === nodeId) {
    throw new ValidationError('Creator cannot leave the sandbox');
  }
  assertSandboxMutable(sandbox, 'leave this sandbox');

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'leave this sandbox', now);

    const member = await tx.sandboxMember.findUnique({
      where: {
        sandbox_id_node_id: {
          sandbox_id: sandboxId,
          node_id: nodeId,
        },
      },
    });

    if (!member) {
      throw new NotFoundError('SandboxMember', nodeId);
    }

    await tx.sandboxMember.delete({
      where: {
        sandbox_id_node_id: {
          sandbox_id: sandboxId,
          node_id: nodeId,
        },
      },
    });
    await tx.evolutionSandbox.update({
      where: { sandbox_id: sandboxId },
      data: {
        member_count: { decrement: 1 },
        updated_at: now,
      },
    });
  });
}

export async function listMembers(sandboxId: string, nodeId: string) {
  await requireSandboxAccess(sandboxId, nodeId, 'member');

  return prisma.sandboxMember.findMany({
    where: { sandbox_id: sandboxId },
    orderBy: { joined_at: 'asc' },
  });
}

export async function inviteMember(
  sandboxId: string,
  inviter: string,
  invitee: string,
  role?: string,
) {
  const sandbox = await requireSandboxAccess(sandboxId, inviter, 'owner');
  assertSandboxMutable(sandbox, 'invite members to this sandbox');

  const inviteId = crypto.randomUUID();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'invite members to this sandbox', now);

    return tx.sandboxInvite.create({
      data: {
        invite_id: inviteId,
        sandbox_id: sandboxId,
        inviter,
        invitee,
        role: normalizeSandboxMemberRole(role),
        status: 'pending',
        created_at: now,
      },
    });
  });
}

export async function listAssets(sandboxId: string, nodeId: string) {
  await requireSandboxAccess(sandboxId, nodeId, 'member');

  return prisma.sandboxAsset.findMany({
    where: { sandbox_id: sandboxId },
    orderBy: { created_at: 'desc' },
  });
}

export async function addAsset(
  sandboxId: string,
  createdBy: string,
  data: {
    asset_id: string;
    asset_type: string;
    name: string;
    content: string;
    signals_match?: string[];
    strategy?: string[];
    tags?: string[];
  },
) {
  const sandbox = await requireSandboxAccess(sandboxId, createdBy, 'participant');
  assertSandboxMutable(sandbox, 'add assets to this sandbox');

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'add assets to this sandbox', now);

    const asset = await tx.sandboxAsset.create({
      data: {
        sandbox_id: sandboxId,
        asset_id: data.asset_id,
        asset_type: data.asset_type,
        name: data.name,
        content: data.content,
        signals_match: data.signals_match ?? [],
        strategy: data.strategy ?? [],
        tags: data.tags ?? [],
        created_by: createdBy,
        created_at: now,
        updated_at: now,
      },
    });

    await tx.evolutionSandbox.update({
      where: { sandbox_id: sandboxId },
      data: {
        total_assets: { increment: 1 },
        updated_at: now,
      },
    });

    await tx.sandboxMember.updateMany({
      where: { sandbox_id: sandboxId, node_id: createdBy },
      data: { assets_created: { increment: 1 } },
    });

    return asset;
  });
}

export async function attachExistingAssetToSandbox(
  sandboxId: string,
  createdBy: string,
  assetId: string,
) {
  const sandbox = await requireSandboxAccess(sandboxId, createdBy, 'participant');
  assertSandboxMutable(sandbox, 'add assets to this sandbox');
  const now = new Date();

  const asset = await prisma.asset.findUnique({
    where: { asset_id: assetId },
  });

  const canReadAsset = asset
    && (asset.author_id === createdBy || asset.status === 'published' || asset.status === 'promoted');

  if (!canReadAsset) {
    throw new NotFoundError('Asset', assetId);
  }

  const sandboxAssetCount = await prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'add assets to this sandbox', now);

    const existingSandboxAsset = await tx.sandboxAsset.findFirst({
      where: { sandbox_id: sandboxId, asset_id: assetId },
    });

    if (!existingSandboxAsset) {
      await tx.sandboxAsset.create({
        data: {
          sandbox_id: sandboxId,
          asset_id: asset.asset_id,
          asset_type: asset.asset_type,
          name: asset.name,
          content: asset.content ?? asset.description,
          signals_match: asset.signals,
          strategy: [],
          tags: asset.tags,
          created_by: createdBy,
          created_at: now,
          updated_at: now,
        },
      });
      await tx.evolutionSandbox.update({
        where: { sandbox_id: sandboxId },
        data: {
          total_assets: { increment: 1 },
          updated_at: now,
        },
      });
      await tx.sandboxMember.updateMany({
        where: { sandbox_id: sandboxId, node_id: createdBy },
        data: { assets_created: { increment: 1 } },
      });
    }

    const sandboxAssets = await tx.sandboxAsset.findMany({
      where: { sandbox_id: sandboxId },
    });

    return sandboxAssets.length;
  });

  return {
    status: 'ok',
    sandbox_asset_count: sandboxAssetCount,
  };
}

export async function modifySandboxAsset(
  sandboxId: string,
  modifiedBy: string,
  assetId: string,
  modifications: Record<string, unknown>,
) {
  const sandbox = await requireSandboxAccess(sandboxId, modifiedBy, 'participant');
  assertSandboxMutable(sandbox, 'modify assets in this sandbox');
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'modify assets in this sandbox', now);

    const existingAsset = await tx.sandboxAsset.findFirst({
      where: { sandbox_id: sandboxId, asset_id: assetId },
    });

    if (!existingAsset) {
      throw new NotFoundError('SandboxAsset', assetId);
    }

    await tx.sandboxAsset.updateMany({
      where: { sandbox_id: sandboxId, asset_id: assetId },
      data: {
        content: typeof modifications.code === 'string' ? modifications.code : existingAsset.content,
        diff: JSON.stringify(modifications),
        updated_at: now,
      },
    });

    return {
      status: 'ok',
      modified: assetId,
    };
  });
}

export async function runExperiment(
  sandboxId: string,
  requestedBy: string,
  experiment: {
    experiment_type: string;
    target_gene?: string;
    mutation_strategy?: string;
    parameters?: Record<string, unknown>;
  },
) {
  const sandbox = await requireSandboxAccess(sandboxId, requestedBy, 'participant');
  assertSandboxMutable(sandbox, 'run experiments in this sandbox');

  const now = new Date();
  const experimentRecord = {
    id: crypto.randomUUID(),
    status: 'running',
    requested_by: requestedBy,
    experiment_type: experiment.experiment_type,
    target_gene: experiment.target_gene ?? null,
    mutation_strategy: experiment.mutation_strategy ?? null,
    parameters: experiment.parameters ?? {},
    started_at: now.toISOString(),
  };

  await prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'run experiments in this sandbox', now);

    const currentSandbox = await tx.evolutionSandbox.findUnique({
      where: { sandbox_id: sandboxId },
      select: { metadata: true },
    });
    if (!currentSandbox) {
      throw new NotFoundError('Sandbox', sandboxId);
    }

    const metadata = getSandboxMetadata(currentSandbox.metadata);
    const experiments = getSandboxExperiments(currentSandbox.metadata);
    experiments.push(experimentRecord);

    await tx.evolutionSandbox.update({
      where: { sandbox_id: sandboxId },
      data: {
        metadata: {
          ...metadata,
          experiments,
        } as Prisma.InputJsonValue,
        updated_at: now,
      },
    });
  });

  return {
    experiment_id: experimentRecord.id,
    status: experimentRecord.status,
    estimated_time_minutes: 5,
  };
}

export async function completeSandbox(
  sandboxId: string,
  completedBy: string,
  options: {
    promote_assets?: string[];
    summary?: string;
  } = {},
) {
  const sandbox = await requireSandboxAccess(sandboxId, completedBy, 'owner');
  assertSandboxMutable(sandbox, 'complete this sandbox again');

  const now = new Date();
  const requestedAssetIds = Array.from(new Set((options.promote_assets ?? []).filter(Boolean)));
  let promotedAssetIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'complete this sandbox again', now);
    const currentSandbox = await tx.evolutionSandbox.findUnique({
      where: { sandbox_id: sandboxId },
      select: { metadata: true },
    });
    if (!currentSandbox) {
      throw new NotFoundError('Sandbox', sandboxId);
    }

    const metadata = getSandboxMetadata(currentSandbox.metadata);
    let newlyPromotedCount = 0;

    if (requestedAssetIds.length > 0) {
      const sandboxAssets = await tx.sandboxAsset.findMany({
        where: {
          sandbox_id: sandboxId,
          asset_id: { in: requestedAssetIds },
        },
      });
      promotedAssetIds = sandboxAssets.map((asset) => asset.asset_id);

      const promotionResult = await tx.sandboxAsset.updateMany({
        where: {
          sandbox_id: sandboxId,
          asset_id: { in: promotedAssetIds },
          promoted: false,
        },
        data: {
          promoted: true,
          promoted_at: now,
          updated_at: now,
        },
      });
      newlyPromotedCount = promotionResult.count;
    }

    await tx.evolutionSandbox.update({
      where: { sandbox_id: sandboxId },
      data: {
        state: 'archived',
        total_promoted: { increment: newlyPromotedCount },
        metadata: {
          ...metadata,
          completion_summary: options.summary ?? null,
          completed_at: now.toISOString(),
        } as Prisma.InputJsonValue,
        updated_at: now,
      },
    });
  });

  return {
    status: 'archived',
    promoted_to_mainnet: promotedAssetIds,
    sandbox_archived: true,
  };
}

export async function compareSandbox(sandboxId: string, nodeId: string) {
  const sandbox = await getSandbox(sandboxId, nodeId);
  const experiments = getSandboxExperiments(sandbox.metadata);
  const totalAssets = sandbox.assets.length;
  const promotedAssets = sandbox.assets
    .filter((asset) => asset.promoted)
    .map((asset) => asset.asset_id);
  const avgGdi = totalAssets > 0
    ? sandbox.assets.reduce((sum, asset) => sum + (asset.gdi_score ?? 0), 0) / totalAssets
    : 0;

  return {
    sandbox_id: sandbox.sandbox_id,
    status: sandbox.state,
    isolation_mode: sandbox.isolation_level,
    total_assets: totalAssets,
    total_members: sandbox.members.length,
    avg_gdi: avgGdi,
    promotion_success_rate: totalAssets > 0 ? promotedAssets.length / totalAssets : 0,
    member_activity: sandbox.members.map((member) => ({
      node_id: member.node_id,
      role: member.role,
      assets_created: member.assets_created,
      assets_promoted: member.assets_promoted,
      last_activity_at: member.last_activity_at,
    })),
    promoted_assets: promotedAssets,
    assets: sandbox.assets.map((asset) => ({
      asset_id: asset.asset_id,
      asset_type: asset.asset_type,
      promoted: asset.promoted,
      gdi_score: asset.gdi_score,
    })),
    experiments,
  };
}

export async function getSandboxStats() {
  const sandboxes = await prisma.evolutionSandbox.findMany({
    select: {
      state: true,
      total_assets: true,
      total_promoted: true,
      metadata: true,
    },
  });

  const totalSandboxes = sandboxes.length;
  const active = sandboxes.filter((sandbox) => sandbox.state === 'active').length;
  const completed = sandboxes.filter(
    (sandbox) => sandbox.state === 'completed' || sandbox.state === 'archived',
  ).length;
  const totalExperiments = sandboxes.reduce(
    (sum, sandbox) => sum + getSandboxExperiments(sandbox.metadata).length,
    0,
  );
  const totalAssets = sandboxes.reduce((sum, sandbox) => sum + sandbox.total_assets, 0);
  const totalPromoted = sandboxes.reduce((sum, sandbox) => sum + sandbox.total_promoted, 0);

  return {
    total_sandboxes: totalSandboxes,
    active,
    completed,
    total_experiments: totalExperiments,
    promotion_rate: totalAssets > 0 ? totalPromoted / totalAssets : 0,
  };
}

export async function requestPromotion(
  sandboxId: string,
  requestedBy: string,
  assetId: string,
) {
  const sandbox = await requireSandboxAccess(sandboxId, requestedBy, 'participant');
  assertSandboxMutable(sandbox, 'request promotions in this sandbox');
  const requestId = crypto.randomUUID();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'request promotions in this sandbox', now);

    const asset = await tx.sandboxAsset.findFirst({
      where: { sandbox_id: sandboxId, asset_id: assetId },
    });

    if (!asset) {
      throw new NotFoundError('SandboxAsset', assetId);
    }

    const existing = await tx.promotionRequest.findFirst({
      where: { sandbox_id: sandboxId, asset_id: assetId, status: 'pending' },
    });

    if (existing) {
      throw new ValidationError('A pending promotion request already exists for this asset');
    }

    return tx.promotionRequest.create({
      data: {
        request_id: requestId,
        sandbox_id: sandboxId,
        asset_id: assetId,
        requested_by: requestedBy,
        status: 'pending',
        requested_at: now,
        created_at: now,
        updated_at: now,
      },
    });
  });
}

export async function listPromotions(sandboxId: string, nodeId: string) {
  await requireSandboxAccess(sandboxId, nodeId, 'member');

  return prisma.promotionRequest.findMany({
    where: { sandbox_id: sandboxId },
    orderBy: { requested_at: 'desc' },
  });
}

export async function approvePromotion(
  sandboxId: string,
  requestId: string,
  reviewer: string,
) {
  const sandbox = await requireSandboxAccess(sandboxId, reviewer, 'owner');
  assertSandboxMutable(sandbox, 'approve promotions in this sandbox');

  const request = await prisma.promotionRequest.findUnique({
    where: { request_id: requestId, sandbox_id: sandboxId },
  });

  if (!request) {
    throw new NotFoundError('PromotionRequest', requestId);
  }

  if (request.status !== 'pending') {
    throw new ValidationError('Promotion request is not pending');
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'approve promotions in this sandbox', now);

    const requestUpdate = await tx.promotionRequest.updateMany({
      where: {
        request_id: requestId,
        sandbox_id: sandboxId,
        status: 'pending',
      },
      data: {
        status: 'approved',
        reviewed_by: reviewer,
        reviewed_at: now,
        updated_at: now,
      },
    });

    if (requestUpdate.count === 0) {
      throw new ValidationError('Promotion request is not pending');
    }

    const assetUpdate = await tx.sandboxAsset.updateMany({
      where: {
        sandbox_id: sandboxId,
        asset_id: request.asset_id,
        promoted: false,
      },
      data: {
        promoted: true,
        promoted_at: now,
        updated_at: now,
      },
    });

    if (assetUpdate.count > 0) {
      await tx.evolutionSandbox.update({
        where: { sandbox_id: sandboxId },
        data: {
          total_promoted: { increment: assetUpdate.count },
          updated_at: now,
        },
      });
      await tx.sandboxMember.updateMany({
        where: { sandbox_id: sandboxId, node_id: request.requested_by },
        data: { assets_promoted: { increment: assetUpdate.count } },
      });
    }

    return tx.promotionRequest.findUnique({
      where: { request_id: requestId, sandbox_id: sandboxId },
    });
  });

  if (!updated) {
    throw new NotFoundError('PromotionRequest', requestId);
  }

  return updated;
}

export async function rejectPromotion(
  sandboxId: string,
  requestId: string,
  reviewer: string,
  note: string,
) {
  const sandbox = await requireSandboxAccess(sandboxId, reviewer, 'owner');
  assertSandboxMutable(sandbox, 'reject promotions in this sandbox');

  const request = await prisma.promotionRequest.findUnique({
    where: { request_id: requestId, sandbox_id: sandboxId },
  });

  if (!request) {
    throw new NotFoundError('PromotionRequest', requestId);
  }

  if (request.status !== 'pending') {
    throw new ValidationError('Promotion request is not pending');
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await assertSandboxMutableInTransaction(tx, sandboxId, 'reject promotions in this sandbox', now);

    return tx.promotionRequest.update({
      where: { request_id: requestId },
      data: {
        status: 'rejected',
        reviewed_by: reviewer,
        review_note: note,
        reviewed_at: now,
        updated_at: now,
      },
    });
  });
}
