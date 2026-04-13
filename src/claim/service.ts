import { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

export interface ClaimResult {
  node_id: string;
  model: string;
  reputation: number;
  credit_balance: number;
  registered_at: string;
  already_claimed: boolean;
}

export async function getClaimInfo(claimCode: string, prismaClient?: PrismaClient): Promise<ClaimResult> {
  const client = getPrismaClient(prismaClient);
  const node = await client.node.findFirst({
    where: { claim_code: claimCode },
  });

  if (!node) {
    throw new NotFoundError('Claim code', claimCode);
  }

  return {
    node_id: node.node_id,
    model: node.model,
    reputation: node.reputation,
    credit_balance: node.credit_balance,
    registered_at: node.registered_at.toISOString(),
    already_claimed: !!node.user_id,
  };
}

export async function claimNode(
  claimCode: string,
  userId: string,
  prismaClient?: PrismaClient,
): Promise<{ node_id: string; model: string; reputation: number }> {
  const client = getPrismaClient(prismaClient);
  const node = await client.node.findFirst({
    where: { claim_code: claimCode },
  });

  if (!node) {
    throw new NotFoundError('Claim code', claimCode);
  }

  if (node.user_id) {
    throw new ConflictError('This node has already been claimed');
  }

  const updated = await client.node.update({
    where: { id: node.id },
    data: { user_id: userId },
    select: { node_id: true, model: true, reputation: true },
  });

  return {
    node_id: updated.node_id,
    model: updated.model,
    reputation: updated.reputation,
  };
}
