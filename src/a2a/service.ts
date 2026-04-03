import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  INITIAL_CREDITS,
  INITIAL_REPUTATION,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  DEAD_THRESHOLD_MS,
  NODE_SECRET_LENGTH,
} from '../shared/constants';
import { NotFoundError, ValidationError } from '../shared/errors';
import type { HelloPayload, HeartbeatPayload, NodeInfo, NodeStatus } from '../shared/types';
import type { RegisterNodeResult, NetworkStats, NodeStatusCheck } from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

function generateNodeSecret(): string {
  return crypto.randomBytes(NODE_SECRET_LENGTH / 2).toString('hex');
}

function generateClaimCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () => {
    const bytes = crypto.randomBytes(4);
    return Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .slice(0, 4)
      .join('');
  };
  return `${segment()}-${segment()}`;
}

function generateReferralCode(): string {
  return `evo-${crypto.randomBytes(4).toString('hex')}`;
}

function determineNodeStatus(lastSeen: Date, now: Date): NodeStatus {
  const elapsed = now.getTime() - lastSeen.getTime();
  if (elapsed <= HEARTBEAT_TIMEOUT_MS) {
    return 'alive';
  }
  if (elapsed <= DEAD_THRESHOLD_MS) {
    return 'offline';
  }
  return 'dead';
}

export async function registerNode(payload: HelloPayload): Promise<RegisterNodeResult> {
  if (!payload.model || payload.model.trim().length === 0) {
    throw new ValidationError('Model name is required');
  }

  const nodeId = uuidv4();
  const nodeSecret = generateNodeSecret();
  const claimCode = generateClaimCode();
  const referralCode = generateReferralCode();

  const node = await prisma.node.create({
    data: {
      node_id: nodeId,
      node_secret: nodeSecret,
      model: payload.model.trim(),
      status: 'registered',
      trust_level: 'unverified',
      reputation: INITIAL_REPUTATION,
      credit_balance: INITIAL_CREDITS,
      gene_count: payload.gene_count ?? 0,
      capsule_count: payload.capsule_count ?? 0,
      claim_code: claimCode,
      referral_code: referralCode,
    },
  });

  await prisma.creditTransaction.create({
    data: {
      node_id: node.node_id,
      amount: INITIAL_CREDITS,
      type: 'initial_grant',
      description: 'Initial credit grant upon registration',
      balance_after: INITIAL_CREDITS,
    },
  });

  return {
    node_id: node.node_id,
    node_secret: nodeSecret,
    claim_code: node.claim_code!,
    referral_code: node.referral_code!,
    status: 'registered',
    trust_level: node.trust_level,
    credit_balance: node.credit_balance,
  };
}

export async function heartbeat(
  nodeId: string,
  payload?: HeartbeatPayload,
): Promise<{
  your_node_id: string;
  next_heartbeat_in_ms: number;
  network_stats: NetworkStats;
}> {
  const node = await prisma.node.findUnique({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {
    last_seen: now,
    status: 'alive',
  };

  if (payload?.stats) {
    if (payload.stats.gene_count !== undefined) {
      updateData.gene_count = payload.stats.gene_count;
    }
    if (payload.stats.capsule_count !== undefined) {
      updateData.capsule_count = payload.stats.capsule_count;
    }
  }

  await prisma.node.update({
    where: { node_id: nodeId },
    data: updateData,
  });

  const stats = await getNetworkStats();

  return {
    your_node_id: nodeId,
    next_heartbeat_in_ms: HEARTBEAT_INTERVAL_MS,
    network_stats: stats,
  };
}

export async function getNodeInfo(nodeId: string): Promise<NodeInfo> {
  const node = await prisma.node.findUnique({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  const now = new Date();
  const status = determineNodeStatus(node.last_seen, now);

  return {
    node_id: node.node_id,
    status,
    model: node.model,
    gene_count: node.gene_count,
    capsule_count: node.capsule_count,
    reputation: node.reputation,
    credit_balance: node.credit_balance,
    last_seen: node.last_seen.toISOString(),
    registered_at: node.registered_at.toISOString(),
    trust_level: node.trust_level as 'unverified' | 'verified' | 'trusted',
  };
}

export async function getNetworkStats(): Promise<NetworkStats> {
  const now = new Date();
  const allNodes = await prisma.node.findMany({
    select: {
      last_seen: true,
      gene_count: true,
      capsule_count: true,
    },
  });

  const totalNodes = allNodes.length;
  const aliveNodes = allNodes.filter(
    (n: { last_seen: Date }) => (now.getTime() - n.last_seen.getTime()) <= HEARTBEAT_TIMEOUT_MS,
  ).length;
  const totalGenes = allNodes.reduce((sum: number, n: { gene_count: number }) => sum + n.gene_count, 0);
  const totalCapsules = allNodes.reduce((sum: number, n: { capsule_count: number }) => sum + n.capsule_count, 0);

  return {
    total_nodes: totalNodes,
    alive_nodes: aliveNodes,
    total_genes: totalGenes,
    total_capsules: totalCapsules,
  };
}

export { determineNodeStatus, generateClaimCode, generateNodeSecret };
