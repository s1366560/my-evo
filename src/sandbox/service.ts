import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../shared/errors';

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

export async function listSandboxes(
  state?: string,
  isolationLevel?: string,
  limit = 20,
  offset = 0,
) {
  const where: Record<string, unknown> = {};
  if (state) {
    where.state = state;
  }
  if (isolationLevel) {
    where.isolation_level = isolationLevel;
  }

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

export async function getSandbox(sandboxId: string) {
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
) {
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

  return sandbox;
}

export async function updateSandbox(
  sandboxId: string,
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
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

  const updated = await prisma.evolutionSandbox.update({
    where: { sandbox_id: sandboxId },
    data: {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.isolation_level !== undefined ? { isolation_level: updates.isolation_level } : {}),
      ...(updates.env !== undefined ? { env: updates.env } : {}),
      ...(updates.state !== undefined ? { state: updates.state } : {}),
      ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
      ...(updates.metadata !== undefined ? { metadata: updates.metadata as import('@prisma/client').Prisma.InputJsonValue } : {}),
      updated_at: new Date(),
    },
  });

  return updated;
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

  await prisma.$transaction([
    prisma.promotionRequest.deleteMany({ where: { sandbox_id: sandboxId } }),
    prisma.sandboxAsset.deleteMany({ where: { sandbox_id: sandboxId } }),
    prisma.sandboxMember.deleteMany({ where: { sandbox_id: sandboxId } }),
    prisma.sandboxInvite.deleteMany({ where: { sandbox_id: sandboxId } }),
    prisma.evolutionSandbox.delete({ where: { sandbox_id: sandboxId } }),
  ]);
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

  const member = await prisma.sandboxMember.upsert({
    where: {
      sandbox_id_node_id: {
        sandbox_id: sandboxId,
        node_id: nodeId,
      },
    },
    update: {
      last_activity_at: now,
      updated_at: now,
    },
    create: {
      sandbox_id: sandboxId,
      node_id: nodeId,
      role: 'participant',
      joined_at: now,
      updated_at: now,
    },
  });

  // Increment member_count if new member
  await prisma.evolutionSandbox.update({
    where: { sandbox_id: sandboxId },
    data: { member_count: { increment: 1 } },
  });

  return member;
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

  const member = await prisma.sandboxMember.findUnique({
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

  await prisma.$transaction([
    prisma.sandboxMember.delete({
      where: {
        sandbox_id_node_id: {
          sandbox_id: sandboxId,
          node_id: nodeId,
        },
      },
    }),
    prisma.evolutionSandbox.update({
      where: { sandbox_id: sandboxId },
      data: { member_count: { decrement: 1 } },
    }),
  ]);
}

export async function listMembers(sandboxId: string) {
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

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
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

  const inviteId = crypto.randomUUID();
  const now = new Date();

  const invite = await prisma.sandboxInvite.create({
    data: {
      invite_id: inviteId,
      sandbox_id: sandboxId,
      inviter,
      invitee,
      role: role ?? 'participant',
      status: 'pending',
      created_at: now,
    },
  });

  return invite;
}

export async function listAssets(sandboxId: string) {
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

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
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

  const now = new Date();

  const asset = await prisma.sandboxAsset.create({
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

  await prisma.evolutionSandbox.update({
    where: { sandbox_id: sandboxId },
    data: { total_assets: { increment: 1 } },
  });

  // Update member's assets_created
  await prisma.sandboxMember.updateMany({
    where: { sandbox_id: sandboxId, node_id: createdBy },
    data: { assets_created: { increment: 1 } },
  });

  return asset;
}

export async function requestPromotion(
  sandboxId: string,
  requestedBy: string,
  assetId: string,
) {
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

  const asset = await prisma.sandboxAsset.findFirst({
    where: { sandbox_id: sandboxId, asset_id: assetId },
  });

  if (!asset) {
    throw new NotFoundError('SandboxAsset', assetId);
  }

  const existing = await prisma.promotionRequest.findFirst({
    where: { sandbox_id: sandboxId, asset_id: assetId, status: 'pending' },
  });

  if (existing) {
    throw new ValidationError('A pending promotion request already exists for this asset');
  }

  const requestId = crypto.randomUUID();
  const now = new Date();

  const request = await prisma.promotionRequest.create({
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

  return request;
}

export async function listPromotions(sandboxId: string) {
  const sandbox = await prisma.evolutionSandbox.findUnique({
    where: { sandbox_id: sandboxId },
  });

  if (!sandbox) {
    throw new NotFoundError('Sandbox', sandboxId);
  }

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

  const [updated, updatedAsset] = await prisma.$transaction([
    prisma.promotionRequest.update({
      where: { request_id: requestId },
      data: {
        status: 'approved',
        reviewed_by: reviewer,
        reviewed_at: now,
        updated_at: now,
      },
    }),
    prisma.sandboxAsset.updateMany({
      where: { sandbox_id: sandboxId, asset_id: request.asset_id },
      data: {
        promoted: true,
        promoted_at: now,
        updated_at: now,
      },
    }),
    prisma.evolutionSandbox.update({
      where: { sandbox_id: sandboxId },
      data: {
        total_promoted: { increment: 1 },
        updated_at: now,
      },
    }),
    prisma.sandboxMember.updateMany({
      where: { sandbox_id: sandboxId, node_id: request.requested_by },
      data: { assets_promoted: { increment: 1 } },
    }),
  ]);

  void updatedAsset;

  return updated;
}

export async function rejectPromotion(
  sandboxId: string,
  requestId: string,
  reviewer: string,
  note: string,
) {
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

  const updated = await prisma.promotionRequest.update({
    where: { request_id: requestId },
    data: {
      status: 'rejected',
      reviewed_by: reviewer,
      review_note: note,
      reviewed_at: now,
      updated_at: now,
    },
  });

  return updated;
}
