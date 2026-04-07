import { PrismaClient } from '@prisma/client';
import {
  ARBITRATOR_CRITERIA,
  ARBITRATOR_COUNT,
  type ArbitratorProfile,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

// In-memory tracking of arbitrator workload
const arbitratorWorkload: Map<string, number> = new Map();

function weightedRandomSelect(
  candidates: Array<{ node_id: string; weight: number }>,
): string | null {
  if (candidates.length === 0) return null;
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let rand = Math.random() * total;
  for (const candidate of candidates) {
    rand -= candidate.weight;
    if (rand <= 0) return candidate.node_id;
  }
  return candidates[candidates.length - 1]!.node_id;
}

export async function getAvailableArbitrators(): Promise<ArbitratorProfile[]> {
  const nodes = await prisma.node.findMany({
    where: {
      status: 'registered',
      trust_level: { in: ['trusted', 'verified'] },
      reputation: { gte: ARBITRATOR_CRITERIA.min_reputation },
    },
  });

  return nodes.map((n) => ({
    node_id: n.node_id,
    reputation: n.reputation,
    trust_level: n.trust_level,
    active_disputes: arbitratorWorkload.get(n.node_id) ?? 0,
    is_available:
      (arbitratorWorkload.get(n.node_id) ?? 0) <
      ARBITRATOR_CRITERIA.max_active_disputes,
  }));
}

export async function selectArbitrator(disputeId: string, severity = 'medium'): Promise<string[]> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) return [];

  const { plaintiff_id, defendant_id } = dispute;
  const needed = ARBITRATOR_COUNT[severity] ?? 3;

  const nodes = await prisma.node.findMany({
    where: {
      status: 'registered',
      trust_level: { in: ['trusted', 'verified'] },
      reputation: { gte: ARBITRATOR_CRITERIA.min_reputation },
    },
  });

  // Filter: not a party, no conflict of interest, under max workload
  const candidates = nodes
    .filter((n) => {
      if (n.node_id === plaintiff_id || n.node_id === defendant_id) return false;
      const active = arbitratorWorkload.get(n.node_id) ?? 0;
      if (active >= ARBITRATOR_CRITERIA.max_active_disputes) return false;
      return true;
    })
    .map((n) => ({
      node_id: n.node_id,
      weight: n.reputation, // reputation-weighted random selection
    }));

  const selected: string[] = [];
  for (let i = 0; i < needed && candidates.length > 0; i++) {
    const pick = weightedRandomSelect(candidates);
    if (pick) {
      selected.push(pick);
      // Remove selected from candidates to avoid duplicates
      const idx = candidates.findIndex((c) => c.node_id === pick);
      if (idx >= 0) candidates.splice(idx, 1);
    }
  }

  // Increment workload counters
  for (const arb of selected) {
    arbitratorWorkload.set(arb, (arbitratorWorkload.get(arb) ?? 0) + 1);
  }

  return selected;
}

export async function assignDispute(
  disputeId: string,
  arbitratorId: string,
): Promise<void> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new Error(`Dispute not found: ${disputeId}`);
  }

  const current = (dispute.arbitrators as string[]) ?? [];
  if (!current.includes(arbitratorId)) {
    await prisma.dispute.update({
      where: { dispute_id: disputeId },
      data: {
        arbitrators: [...current, arbitratorId],
      },
    });
  }

  arbitratorWorkload.set(
    arbitratorId,
    (arbitratorWorkload.get(arbitratorId) ?? 0) + 1,
  );
}

export async function releaseArbitrator(arbitratorId: string): Promise<void> {
  const current = arbitratorWorkload.get(arbitratorId) ?? 0;
  if (current > 0) {
    arbitratorWorkload.set(arbitratorId, current - 1);
  }
}

export function getArbitratorWorkload(arbitratorId: string): number {
  return arbitratorWorkload.get(arbitratorId) ?? 0;
}
