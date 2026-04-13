import { PrismaClient } from '@prisma/client';
import {
  MAX_REPUTATION,
  MIN_REPUTATION,
  REPUTATION_EVENTS,
  REPUTATION_TIERS,
} from '../shared/constants';
import { NotFoundError, ValidationError } from '../shared/errors';
import type {
  ReputationScore,
  ReputationTier,
  ReputationEvent,
} from '../shared/types';
import type { LeaderboardEntry } from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

const VALID_EVENT_TYPES = new Set(Object.keys(REPUTATION_EVENTS));

export function getTier(score: number): ReputationTier {
  for (const entry of REPUTATION_TIERS) {
    if (score >= entry.min && score <= entry.max) {
      return entry.tier as ReputationTier;
    }
  }
  if (score >= 90) {
    return 'legend';
  }
  return 'newcomer';
}

export async function getScore(
  nodeId: string,
  prismaClient?: PrismaClient,
): Promise<ReputationScore> {
  const client = getPrismaClient(prismaClient);
  const node = await client.node.findUnique({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  const events = await client.reputationEvent.findMany({
    where: { node_id: nodeId },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });

  const history = events.map((e: { event_type: string; delta: number; reason: string; timestamp: Date }) => ({
    event_type: e.event_type,
    delta: e.delta,
    reason: e.reason,
    timestamp: e.timestamp.toISOString(),
  }));

  return {
    node_id: nodeId,
    score: node.reputation,
    tier: getTier(node.reputation),
    history,
    calculated_at: new Date().toISOString(),
  };
}

export async function addPoints(
  nodeId: string,
  eventType: string,
  prismaClient?: PrismaClient,
): Promise<ReputationScore> {
  const client = getPrismaClient(prismaClient);
  if (!VALID_EVENT_TYPES.has(eventType)) {
    throw new ValidationError(`Unknown reputation event type: ${eventType}`);
  }

  const node = await client.node.findUnique({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  const delta = REPUTATION_EVENTS[eventType as keyof typeof REPUTATION_EVENTS];
  const newScore = Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, node.reputation + delta));

  await client.node.update({
    where: { node_id: nodeId },
    data: { reputation: newScore },
  });

  await client.reputationEvent.create({
    data: {
      node_id: nodeId,
      event_type: eventType,
      delta,
      reason: `Event: ${eventType}`,
    },
  });

  const events = await client.reputationEvent.findMany({
    where: { node_id: nodeId },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });

  const history = events.map((e: { event_type: string; delta: number; reason: string; timestamp: Date }) => ({
    event_type: e.event_type,
    delta: e.delta,
    reason: e.reason,
    timestamp: e.timestamp.toISOString(),
  }));

  return {
    node_id: nodeId,
    score: newScore,
    tier: getTier(newScore),
    history,
    calculated_at: new Date().toISOString(),
  };
}

export async function getHistory(
  nodeId: string,
  limit: number = 20,
  offset: number = 0,
  prismaClient?: PrismaClient,
): Promise<{ items: ReputationEvent[]; total: number }> {
  const client = getPrismaClient(prismaClient);
  const node = await client.node.findUnique({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  const [events, total] = await Promise.all([
    client.reputationEvent.findMany({
      where: { node_id: nodeId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    client.reputationEvent.count({
      where: { node_id: nodeId },
    }),
  ]);

  const items = events.map((e: { event_type: string; delta: number; reason: string; timestamp: Date }) => ({
    event_type: e.event_type,
    delta: e.delta,
    reason: e.reason,
    timestamp: e.timestamp.toISOString(),
  }));

  return { items, total };
}

export async function getLeaderboard(
  limit: number = 20,
  prismaClient?: PrismaClient,
): Promise<LeaderboardEntry[]> {
  const client = getPrismaClient(prismaClient);
  const nodes = await client.node.findMany({
    orderBy: { reputation: 'desc' },
    take: limit,
    select: {
      node_id: true,
      reputation: true,
    },
  });

  return nodes.map((n: { node_id: string; reputation: number }) => ({
    node_id: n.node_id,
    score: n.reputation,
    tier: getTier(n.reputation),
  }));
}
