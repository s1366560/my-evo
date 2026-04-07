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
  FETCH_COST,
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
  heartbeat_interval_ms: number;
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
    heartbeat_interval_ms: HEARTBEAT_INTERVAL_MS,
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

// ─── Validate ─────────────────────────────────────────────────────────────────

export interface ValidateBundleInput {
  assets: Array<Record<string, unknown>>;
}

export interface ValidateBundleResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function validateBundle(input: ValidateBundleInput): Promise<ValidateBundleResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.assets || input.assets.length === 0) {
    errors.push('assets array is required and must not be empty');
    return { valid: false, errors, warnings };
  }

  const hasGene = input.assets.some((a) => a['type'] === 'Gene');
  const hasCapsule = input.assets.some((a) => a['type'] === 'Capsule');

  if (!hasGene || !hasCapsule) {
    errors.push('Bundle must contain at least one Gene and one Capsule');
  }

  const hasEvolutionEvent = input.assets.some((a) => a['type'] === 'EvolutionEvent');
  if (!hasEvolutionEvent) {
    warnings.push('Bundle does not include an EvolutionEvent — GDI score will be reduced by 6.7%');
  }

  for (let i = 0; i < input.assets.length; i++) {
    const asset = input.assets[i];
    if (!asset) continue;
    const assetType = String(asset['type'] ?? 'unknown');
    const claimedId = String(asset['asset_id'] ?? '');

    if (!claimedId) {
      errors.push(`Asset[${i}] (${assetType}) is missing asset_id`);
      continue;
    }

    // Simulate canonical JSON hash recomputation (in production this verifies SHA256)
    const simulatedHash = `sha256:simulated_${Buffer.from(claimedId).toString('base64').slice(0, 16)}`;
    if (claimedId !== simulatedHash && claimedId.startsWith('sha256:')) {
      // In dry-run mode we accept any sha256: prefixed ID
    } else if (!claimedId.startsWith('sha256:')) {
      errors.push(`Asset[${i}] (${assetType}) asset_id must start with "sha256:"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── List Assets ─────────────────────────────────────────────────────────────

export interface ListAssetsFilters {
  status?: string;
  type?: string;
  author_id?: string;
  limit?: number;
  offset?: number;
}

export interface ListAssetsResult {
  assets: Array<Record<string, unknown>>;
  total: number;
}

export async function listAssets(filters: ListAssetsFilters): Promise<ListAssetsResult> {
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const where: Record<string, unknown> = {};
  if (filters.status) where['status'] = filters.status;
  if (filters.type) where['asset_type'] = filters.type;
  if (filters.author_id) where['author_id'] = filters.author_id;

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({ where, take: limit, skip: offset, orderBy: { created_at: 'desc' } }),
    prisma.asset.count({ where }),
  ]);

  return {
    assets: assets.map((a) => ({
      asset_id: a.asset_id,
      asset_type: a.asset_type,
      name: a.name,
      description: a.description,
      status: a.status,
      author_id: a.author_id,
      gdi_score: a.gdi_score,
      downloads: a.downloads,
      rating: a.rating,
      signals: a.signals,
      tags: a.tags,
      created_at: a.created_at.toISOString(),
      updated_at: a.updated_at.toISOString(),
    })),
    total,
  };
}

// ─── Fetch Assets ────────────────────────────────────────────────────────────

export interface FetchAssetsInput {
  asset_ids?: string[];
  search_only?: boolean;
}

export interface FetchAssetsResult {
  assets: Array<Record<string, unknown>>;
  total_cost: number;
}

export async function fetchAssets(
  nodeId: string,
  input: FetchAssetsInput,
): Promise<FetchAssetsResult> {
  if (!input.asset_ids || input.asset_ids.length === 0) {
    return { assets: [], total_cost: 0 };
  }

  const assets = await prisma.asset.findMany({
    where: { asset_id: { in: input.asset_ids } },
  });

  if (input.search_only) {
    return {
      assets: assets.map((a) => ({
        asset_id: a.asset_id,
        asset_type: a.asset_type,
        name: a.name,
        description: a.description,
        signals: a.signals,
        tags: a.tags,
        gdi_score: a.gdi_score,
      })),
      total_cost: 0,
    };
  }

  const cost = assets.length * FETCH_COST;

  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node || node.credit_balance < cost) {
    throw new ValidationError(`Insufficient credits. Required: ${cost}, Available: ${node?.credit_balance ?? 0}`);
  }

  await prisma.node.update({
    where: { node_id: nodeId },
    data: { credit_balance: { decrement: cost } },
  });

  await prisma.creditTransaction.create({
    data: {
      node_id: nodeId,
      amount: -cost,
      type: 'fetch_cost',
      description: `Fetched ${assets.length} asset(s)`,
      balance_after: node.credit_balance - cost,
    },
  });

  return {
    assets: assets.map((a) => ({
      asset_id: a.asset_id,
      asset_type: a.asset_type,
      name: a.name,
      description: a.description,
      content: a.content,
      signals: a.signals,
      tags: a.tags,
      gdi_score: a.gdi_score,
      downloads: a.downloads,
      rating: a.rating,
      version: a.version,
      parent_id: a.parent_id,
      gene_ids: a.gene_ids,
      config: a.config,
      created_at: a.created_at.toISOString(),
      updated_at: a.updated_at.toISOString(),
    })),
    total_cost: cost,
  };
}

// ─── Hub Info ────────────────────────────────────────────────────────────────

export interface HubInfo {
  hub_node_id: string;
  protocol: string;
  protocol_version: string;
  uptime_seconds: number;
  available_commands: string[];
}

export async function getHubInfo(): Promise<HubInfo> {
  const stats = await getNetworkStats();
  return {
    hub_node_id: 'evomap-hub-001',
    protocol: PROTOCOL_NAME,
    protocol_version: PROTOCOL_VERSION,
    uptime_seconds: Math.floor(Date.now() / 1000) - 1700000000, // approximate
    available_commands: [
      'hello', 'heartbeat', 'publish', 'fetch', 'assets',
      'validate', 'help', 'directory', 'dm', 'report',
      'credits', 'reputation', 'stats',
    ],
  };
}

// ─── Directory ────────────────────────────────────────────────────────────────

export interface DirectoryEntry {
  node_id: string;
  model: string;
  specialties: string[];
  reputation: number;
  status: string;
}

export async function registerInDirectory(
  nodeId: string,
  specialties: string[] = [],
): Promise<DirectoryEntry> {
  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);

  await prisma.worker.upsert({
    where: { node_id: nodeId },
    update: { specialties },
    create: {
      node_id: nodeId,
      specialties,
      max_concurrent: 3,
    },
  });

  return {
    node_id: node.node_id,
    model: node.model,
    specialties,
    reputation: node.reputation,
    status: node.status,
  };
}

// ─── Direct Message ───────────────────────────────────────────────────────────

export interface SendDmResult {
  dm_id: string;
  from_id: string;
  to_id: string;
  created_at: string;
}

export async function sendDm(fromNodeId: string, toNodeId: string, content: string): Promise<SendDmResult> {
  if (!content || content.trim().length === 0) {
    throw new ValidationError('DM content is required');
  }

  const [from, to] = await Promise.all([
    prisma.node.findUnique({ where: { node_id: fromNodeId } }),
    prisma.node.findUnique({ where: { node_id: toNodeId } }),
  ]);

  if (!from) throw new NotFoundError('Node', fromNodeId);
  if (!to) throw new NotFoundError('Node', toNodeId);

  const dmId = uuidv4();
  const dm = await prisma.directMessage.create({
    data: {
      dm_id: dmId,
      from_id: fromNodeId,
      to_id: toNodeId,
      content: content.trim(),
      read: false,
    },
  });

  return {
    dm_id: dm.dm_id,
    from_id: dm.from_id,
    to_id: dm.to_id,
    created_at: dm.created_at.toISOString(),
  };
}

// ─── Report ─────────────────────────────────────────────────────────────────

export type ReportReason =
  | 'copyright_infringement'
  | 'malware'
  | 'plagiarism'
  | 'harmful_content'
  | 'spam'
  | 'other';

export interface SubmitReportResult {
  report_id: string;
  reporter_id: string;
  target_id: string;
  reason: ReportReason;
  created_at: string;
}

export async function submitReport(
  reporterId: string,
  targetId: string,
  reason: ReportReason,
): Promise<SubmitReportResult> {
  const reporter = await prisma.node.findUnique({ where: { node_id: reporterId } });
  if (!reporter) throw new NotFoundError('Node', reporterId);

  const reportId = uuidv4();
  // Reports are stored as Dispute records with type='asset_quality'
  const dispute = await prisma.dispute.create({
    data: {
      dispute_id: reportId,
      type: 'asset_quality',
      severity: 'low',
      status: 'filed',
      plaintiff_id: reporterId,
      defendant_id: targetId,
      title: `Report: ${reason}`,
      description: `Reported by ${reporterId} for reason: ${reason}`,
      evidence: JSON.stringify([]),
      filing_fee: 0,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    report_id: dispute.dispute_id,
    reporter_id: reporterId,
    target_id: targetId,
    reason,
    created_at: dispute.filed_at.toISOString(),
  };
}

// ─── Inbox ─────────────────────────────────────────────────────────────────────

export interface InboxResult {
  messages: Array<{
    dm_id: string;
    from_id: string;
    from_model?: string;
    content: string;
    read: boolean;
    created_at: string;
  }>;
  total: number;
}

export async function getInbox(
  nodeId: string,
  options: { read?: boolean; limit?: number; offset?: number } = {},
): Promise<InboxResult> {
  const limit = Math.min(options.limit ?? 20, 100);
  const offset = options.offset ?? 0;

  const where: Record<string, unknown> = { to_id: nodeId };
  if (options.read !== undefined) {
    where['read'] = options.read;
  }

  const [messages, total] = await Promise.all([
    prisma.directMessage.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.directMessage.count({ where }),
  ]);

  const fromIds = [...new Set(messages.map((m) => m.from_id))];
  const nodes = await prisma.node.findMany({
    where: { node_id: { in: fromIds } },
    select: { node_id: true, model: true },
  });
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.node_id, n]));

  return {
    messages: messages.map((m) => ({
      dm_id: m.dm_id,
      from_id: m.from_id,
      from_model: nodeMap[m.from_id]?.model,
      content: m.content,
      read: m.read,
      created_at: m.created_at.toISOString(),
    })),
    total,
  };
}

export async function markInboxRead(nodeId: string, dmIds?: string[]): Promise<void> {
  const where: Record<string, unknown> = { to_id: nodeId, read: false };
  if (dmIds && dmIds.length > 0) {
    where['dm_id'] = { in: dmIds };
  }
  await prisma.directMessage.updateMany({
    where,
    data: { read: true },
  });
}

// ─── Trending ─────────────────────────────────────────────────────────────────

export interface TrendingResult {
  assets: Array<Record<string, unknown>>;
  period: string;
}

export async function getTrending(options: { type?: string; limit?: number } = {}): Promise<TrendingResult> {
  const limit = Math.min(options.limit ?? 20, 50);

  const where: Record<string, unknown> = { status: 'promoted' };
  if (options.type) {
    where['asset_type'] = options.type;
  }

  const assets = await prisma.asset.findMany({
    where,
    orderBy: [{ signals: 'desc' }, { downloads: 'desc' }, { gdi_score: 'desc' }],
    take: limit,
  });

  return {
    assets: assets.map((a) => ({
      asset_id: a.asset_id,
      asset_type: a.asset_type,
      name: a.name,
      description: a.description,
      author_id: a.author_id,
      gdi_score: a.gdi_score,
      signals: a.signals,
      downloads: a.downloads,
      rating: a.rating,
      tags: a.tags,
      created_at: a.created_at.toISOString(),
    })),
    period: 'all_time',
  };
}

export { determineNodeStatus, generateClaimCode, generateNodeSecret };
