import { PrismaClient } from '@prisma/client';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

export interface ClaimResult {
  node_id: string;
  model: string;
  reputation: number;
  credit_balance: number;
  registered_at: string;
  already_claimed: boolean;
}

export async function getClaimInfo(claimCode: string): Promise<ClaimResult> {
  const node = await prisma.node.findFirst({
    where: { claim_code: claimCode },
  });

  if (!node) {
    throw new Error(`Claim code not found: ${claimCode}`);
  }

  return {
    node_id: node.node_id,
    model: node.model,
    reputation: node.reputation,
    credit_balance: node.credit_balance,
    registered_at: node.registered_at.toISOString(),
    already_claimed: false,
  };
}
