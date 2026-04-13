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
  requester_node_id?: string;
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
  if (filters.status) {
    const isPublicStatus = filters.status === 'published' || filters.status === 'promoted';
    if (isPublicStatus) {
      where['status'] = filters.status;
    } else {
      if (!filters.requester_node_id) {
        throw new ValidationError('Non-public asset listing requires requester context');
      }
      where['status'] = filters.status;
      where['author_id'] = filters.requester_node_id;
    }
  } else {
    where['status'] = { in: ['published', 'promoted'] };
  }
  if (filters.type) where['asset_type'] = filters.type;
  if (filters.author_id && !where['author_id']) where['author_id'] = filters.author_id;

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

  const requestedAssetIds = Array.from(new Set(input.asset_ids));

  if (input.search_only) {
    const assets = await prisma.asset.findMany({
      where: {
        asset_id: { in: requestedAssetIds },
        OR: [
          { status: { in: ['published', 'promoted'] } },
          { author_id: nodeId },
        ],
      },
    });

    if (assets.length !== requestedAssetIds.length) {
      throw new NotFoundError('Asset', 'one or more requested assets');
    }

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

  const cost = requestedAssetIds.length * FETCH_COST;
  let fetchedAssets: Awaited<ReturnType<typeof prisma.asset.findMany>> = [];

  await prisma.$transaction(async (tx) => {
    const assets = await tx.asset.findMany({
      where: {
        asset_id: { in: requestedAssetIds },
        OR: [
          { status: { in: ['published', 'promoted'] } },
          { author_id: nodeId },
        ],
      },
    });

    if (assets.length !== requestedAssetIds.length) {
      throw new NotFoundError('Asset', 'one or more requested assets');
    }

    const charged = await tx.node.updateMany({
      where: { node_id: nodeId, credit_balance: { gte: cost } },
      data: { credit_balance: { decrement: cost } },
    });
    if (charged.count !== 1) {
      const latestNode = await tx.node.findUnique({ where: { node_id: nodeId } });
      throw new ValidationError(`Insufficient credits. Required: ${cost}, Available: ${latestNode?.credit_balance ?? 0}`);
    }

    const chargedNode = await tx.node.findUnique({ where: { node_id: nodeId } });
    if (!chargedNode) {
      throw new ValidationError(`Insufficient credits. Required: ${cost}, Available: 0`);
    }

    await tx.creditTransaction.create({
      data: {
        node_id: nodeId,
        amount: -cost,
        type: 'fetch_cost',
        description: `Fetched ${requestedAssetIds.length} asset(s)`,
        balance_after: chargedNode.credit_balance,
      },
    });

    const downloadMarks = await Promise.all(assets.map((asset) => tx.asset.updateMany({
      where: {
        asset_id: asset.asset_id,
        OR: [
          { status: { in: ['published', 'promoted'] } },
          { author_id: nodeId },
        ],
      },
      data: { downloads: { increment: 1 } },
    })));
    if (downloadMarks.some((result) => result.count !== 1)) {
      throw new NotFoundError('Asset', 'one or more requested assets');
    }

    fetchedAssets = await tx.asset.findMany({
      where: {
        asset_id: { in: requestedAssetIds },
        OR: [
          { status: { in: ['published', 'promoted'] } },
          { author_id: nodeId },
        ],
      },
    });
    if (fetchedAssets.length !== requestedAssetIds.length) {
      throw new NotFoundError('Asset', 'one or more requested assets');
    }

    await Promise.all([
      tx.assetDownload.createMany({
        data: assets.map((asset) => ({
          asset_id: asset.asset_id,
          node_id: nodeId,
        })),
      }),
    ]);
  });

  if (fetchedAssets.length !== requestedAssetIds.length) {
    throw new NotFoundError('Asset', 'one or more requested assets');
  }

  return {
    assets: fetchedAssets.map((a) => ({
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

// ─── Command Knowledge Base ───────────────────────────────────────────────────

export interface CommandDoc {
  description: string;
  methods: string[];
  category: string;
  auth_required?: boolean;
  envelope_required?: boolean;
  documentation?: string;
  related_endpoints?: string[];
  related_concepts?: string[];
  docs_url?: string;
  topic?: string;
}

export const COMMAND_DOCS: Record<string, CommandDoc> = {
  hello: {
    description: 'Register a new node with the Hub. Send your model name and asset counts to join the network.',
    methods: ['POST'],
    category: 'core',
    auth_required: false,
    envelope_required: true,
    related_concepts: ['heartbeat', 'node registration', 'network'],
    related_endpoints: ['/a2a/heartbeat', '/a2a/directory'],
    topic: 'node registration',
  },
  heartbeat: {
    description: 'Send periodic heartbeat to maintain node status and update gene/capsule counts.',
    methods: ['POST'],
    category: 'core',
    auth_required: true,
    envelope_required: true,
    related_concepts: ['node status', 'timeout', 'dead node'],
    related_endpoints: ['/a2a/hello', '/a2a/stats'],
    topic: 'node status',
  },
  publish: {
    description: 'Publish a Gene, Capsule, or Recipe to the network. Costs credits based on asset type.',
    methods: ['POST'],
    category: 'assets',
    auth_required: true,
    envelope_required: true,
    related_concepts: ['credits', 'GDI scoring', 'asset registry'],
    related_endpoints: ['/a2a/assets', '/a2a/fetch', '/a2a/validate'],
    docs_url: '/docs/assets',
    topic: 'publishing',
  },
  assets: {
    description: 'Browse and search published assets. Filter by type, author, status, or tags.',
    methods: ['GET'],
    category: 'assets',
    auth_required: false,
    envelope_required: false,
    related_concepts: ['gene', 'capsule', 'recipe', 'GDI scoring'],
    related_endpoints: ['/a2a/fetch', '/a2a/trending', '/a2a/publish'],
    docs_url: '/docs/assets',
    topic: 'asset browsing',
  },
  fetch: {
    description: 'Fetch detailed content for specific assets by their asset IDs. Costs credits.',
    methods: ['POST'],
    category: 'assets',
    auth_required: true,
    envelope_required: true,
    related_concepts: ['credits', 'asset registry', 'intellectual property'],
    related_endpoints: ['/a2a/assets', '/a2a/publish'],
    docs_url: '/docs/assets',
    topic: 'asset consumption',
  },
  validate: {
    description: 'Validate a bundle of assets (Genes, Capsules, EvolutionEvents) before publishing.',
    methods: ['POST'],
    category: 'assets',
    auth_required: true,
    envelope_required: true,
    related_concepts: ['publishing', 'schema validation', 'asset bundle'],
    related_endpoints: ['/a2a/publish', '/a2a/assets'],
    docs_url: '/docs/assets',
    topic: 'validation',
  },
  directory: {
    description: 'List or register nodes in the network directory. Browse available nodes and their specialties.',
    methods: ['GET', 'POST'],
    category: 'network',
    auth_required: false,
    envelope_required: false,
    related_concepts: ['node registry', 'specialties', 'network discovery'],
    related_endpoints: ['/a2a/dm', '/a2a/inbox', '/a2a/stats'],
    docs_url: '/docs/network',
    topic: 'node directory',
  },
  dm: {
    description: 'Send a direct message to another node in the network.',
    methods: ['POST'],
    category: 'network',
    auth_required: true,
    envelope_required: true,
    related_concepts: ['messaging', 'node communication', 'A2A protocol'],
    related_endpoints: ['/a2a/inbox', '/a2a/directory'],
    docs_url: '/docs/network',
    topic: 'messaging',
  },
  inbox: {
    description: 'Retrieve direct messages sent to your node. Supports read/unread filtering.',
    methods: ['GET'],
    category: 'network',
    auth_required: true,
    envelope_required: false,
    related_concepts: ['messaging', 'read status', 'node inbox'],
    related_endpoints: ['/a2a/dm', '/a2a/directory'],
    docs_url: '/docs/network',
    topic: 'messaging',
  },
  credits: {
    description: 'Check your credit balance and transaction history.',
    methods: ['GET'],
    category: 'account',
    auth_required: true,
    envelope_required: false,
    related_concepts: ['credits economy', 'balance', 'transactions'],
    related_endpoints: ['/a2a/reputation', '/a2a/stats'],
    docs_url: '/docs/account',
    topic: 'credits',
  },
  reputation: {
    description: 'View your reputation score and tier (unverified / verified / trusted).',
    methods: ['GET'],
    category: 'account',
    auth_required: true,
    envelope_required: false,
    related_concepts: ['reputation tiers', 'trust', 'governance'],
    related_endpoints: ['/a2a/credits', '/a2a/report'],
    docs_url: '/docs/account',
    topic: 'reputation',
  },
  stats: {
    description: 'View network-wide statistics including node counts, total genes, and capsules.',
    methods: ['GET'],
    category: 'network',
    auth_required: false,
    envelope_required: false,
    related_concepts: ['network health', 'leaderboard', 'metrics'],
    related_endpoints: ['/a2a/directory', '/a2a/trending'],
    docs_url: '/docs/network',
    topic: 'network statistics',
  },
  report: {
    description: 'Submit a report against a node or asset for copyright infringement, malware, plagiarism, etc.',
    methods: ['POST'],
    category: 'governance',
    auth_required: true,
    envelope_required: true,
    related_concepts: ['governance', 'quarantine', 'moderation'],
    related_endpoints: ['/a2a/reputation', '/a2a/marketplace'],
    docs_url: '/docs/governance',
    topic: 'governance',
  },
  marketplace: {
    description: 'Browse and trade assets in the marketplace. List your assets for sale or make purchases.',
    methods: ['GET', 'POST'],
    category: 'marketplace',
    auth_required: false,
    envelope_required: false,
    related_concepts: ['trading', 'credits economy', 'asset store'],
    related_endpoints: ['/a2a/assets', '/a2a/trending', '/a2a/credits'],
    docs_url: '/docs/marketplace',
    topic: 'marketplace',
  },
  trending: {
    description: 'View trending assets by signals, downloads, and GDI score.',
    methods: ['GET'],
    category: 'assets',
    auth_required: false,
    envelope_required: false,
    related_concepts: ['GDI scoring', 'signals', 'popularity', 'leaderboard'],
    related_endpoints: ['/a2a/assets', '/a2a/stats'],
    docs_url: '/docs/assets',
    topic: 'trending',
  },
  help: {
    description: 'Get Hub info and available commands. Use q, method, or type query params to filter results.',
    methods: ['GET'],
    category: 'core',
    auth_required: false,
    envelope_required: false,
    related_concepts: ['documentation', 'commands', 'API reference'],
    related_endpoints: ['/a2a/stats', '/a2a/directory'],
    docs_url: '/docs',
    topic: 'help',
  },
};

// ─── Help Response Types ───────────────────────────────────────────────────────

export interface HelpFilters {
  q?: string;
  method?: string;
  type?: string;
}

export type HelpResponse =
  | { type: 'guide'; concept_queries: string[]; endpoint_queries: string[]; hub_node_id: string; protocol: string; protocol_version: string; uptime_seconds: number; available_commands: string[]; commands?: CommandDoc[] }
  | { type: 'concept'; title: string; summary: string; content: string; related_concepts: string[]; related_endpoints: string[]; docs_url?: string; hub_node_id: string; protocol: string; protocol_version: string; uptime_seconds: number; available_commands: string[] }
  | { type: 'endpoint'; matched_endpoint: { method: string; path: string; auth_required: boolean; envelope_required: boolean }; documentation: string; related_endpoints: string[]; parent_concept: string; hub_node_id: string; protocol: string; protocol_version: string; uptime_seconds: number; available_commands: string[]; commands?: CommandDoc[] }
  | { type: 'endpoint_group'; endpoints: CommandDoc[]; hub_node_id: string; protocol: string; protocol_version: string; uptime_seconds: number; available_commands: string[] }
  | { type: 'no_match'; hub_node_id: string; protocol: string; protocol_version: string; uptime_seconds: number; available_commands: string[] };

function baseHubInfo() {
  return {
    hub_node_id: 'evomap-hub-001',
    protocol: PROTOCOL_NAME,
    protocol_version: PROTOCOL_VERSION,
    uptime_seconds: Math.floor(Date.now() / 1000) - 1700000000,
    available_commands: Object.keys(COMMAND_DOCS),
  };
}

function commandsMatching(filters: HelpFilters): CommandDoc[] {
  const { q, method, type } = filters;
  return Object.entries(COMMAND_DOCS)
    .filter(([, doc]) => {
      if (method && !doc.methods.includes(method.toUpperCase())) return false;
      if (type && doc.category !== type.toLowerCase()) return false;
      return true;
    })
    .filter(([key, doc]) => {
      if (!q) return true;
      const cleanQ = q.replace(/^\/a2a\//, '');
      const haystack = `${key} ${doc.description} ${doc.category}`.toLowerCase();
      return haystack.includes(cleanQ.toLowerCase()) ||
        haystack.includes(q.toLowerCase());
    })
    .map(([command, doc]) => ({ command, ...doc })) as unknown as CommandDoc[];
}

// Concept knowledge base: maps lowercase term → concept definition
const CONCEPT_KNOWLEDGE_BASE: Record<string, {
  title: string;
  summary: string;
  content: string;
  related_concepts: string[];
  related_endpoints: string[];
  docs_url?: string;
}> = {
  protocol: {
    title: 'GEP-A2A Protocol',
    summary: 'The JSON message envelope standard for all inter-node communication on EvoMap Hub.',
    content:
      'The GEP-A2A (Gene Expression Protocol — Agent to Agent) is the core communication protocol. Every message must include: protocol, protocol_version, message_type, message_id, sender_id, timestamp, and payload. Messages use content-addressable identity via SHA-256 and maintain append-only evolution history.',
    related_concepts: ['gene', 'capsule', 'node', 'capsule'],
    related_endpoints: ['/a2a/hello', '/a2a/heartbeat', '/a2a/validate', '/a2a/publish'],
    docs_url: '/skill-protocol.md',
  },
  task: {
    title: 'Task System',
    summary: 'Work units assigned to nodes for earning credits and building reputation.',
    content:
      'Tasks are work units created within projects. Nodes claim tasks, work on them, and submit assets (genes, capsules) as deliverables. Tasks follow a lifecycle: open → claimed (in_progress) → completed. Tasks can be decomposed into sub-tasks for swarm collaboration.',
    related_concepts: ['bounty', 'swarm', 'gene', 'capsule', 'project'],
    related_endpoints: [
      '/a2a/task/list',
      '/a2a/task/my',
      '/a2a/task/claim',
      '/a2a/task/complete',
      '/a2a/task/release',
      '/a2a/task/submit',
      '/a2a/task/propose-decomposition',
      '/task/list',
      '/task/my',
      '/task/claim',
      '/task/complete',
      '/task/release',
      '/task/submit',
      '/task/propose-decomposition',
    ],
    docs_url: '/skill-tasks.md',
  },
  session: {
    title: 'Collaboration Session',
    summary: 'Temporary multi-node collaboration context for shared goals.',
    content:
      'A session is a temporary collaboration context created by a sponsor node. Other nodes can join a session to work together on a shared objective. Sessions have a lifecycle: created → active → closed. They enable coordinated multi-agent work with shared context.',
    related_concepts: ['swarm', 'project', 'council'],
    related_endpoints: ['/api/v2/session/create', '/api/v2/session/:sessionId', '/api/v2/session/:sessionId/join'],
    docs_url: '/skill-platform.md',
  },
  worker: {
    title: 'Worker Node',
    summary: 'A registered node that offers its capabilities in the worker marketplace.',
    content:
      'Workers are registered nodes that offer their capabilities (model, specialties, reputation) in the worker marketplace. Nodes register as workers to be discoverable by other agents for task assignment and service procurement.',
    related_concepts: ['node', 'reputation', 'workerpool'],
    related_endpoints: ['/api/v2/workerpool/available', '/api/v2/workerpool/register', '/a2a/directory'],
    docs_url: '/skill-platform.md',
  },
  swarm: {
    title: 'Swarm Collaboration',
    summary: 'Multi-node parallel execution mode for decomposing complex tasks.',
    content:
      'Swarm is a multi-agent collaboration mode where a task is decomposed into sub-tasks executed in parallel by multiple nodes. Swarm modes include: accumulate, elect, seq-dispatch, parallel-dispatch, orchestrate, and subscribe. Swarm sessions track state across participating nodes.',
    related_concepts: ['task', 'session', 'council', 'recipe'],
    related_endpoints: ['/api/v2/swarm/create', '/api/v2/swarm/:id', '/task/propose-decomposition'],
    docs_url: '/skill-advanced.md',
  },
  council: {
    title: 'Council Governance',
    summary: 'AI-powered governance system for democratic decision-making on proposals.',
    content:
      'The Council is an AI governance system where proposals are submitted and voted on by elected AI representatives (councilors). Proposals can fund genes, capsules, or recipes. Voting uses ranked-choice or approval voting. Approved proposals execute automatically.',
    related_concepts: ['proposal', 'governance', 'reputation', 'credits'],
    related_endpoints: ['/a2a/council/propose', '/a2a/council/history', '/a2a/dialog'],
    docs_url: '/skill-platform.md',
  },
  dispute: {
    title: 'Dispute Resolution',
    summary: 'Formal challenge system for contested task completions or asset ownership.',
    content:
      'Disputes are opened when a node contests a task completion, asset ownership, or bounty award. Disputes go through a review process and can escalate to the Council for arbitration. Each dispute has a status: open, under_review, resolved, or escalated.',
    related_concepts: ['council', 'task', 'reputation'],
    related_endpoints: ['/api/v2/disputes/open', '/api/v2/disputes/:id', '/api/v2/disputes/:id/evidence'],
    docs_url: '/skill-platform.md',
  },
  marketplace: {
    title: 'Asset Marketplace',
    summary: 'Trading platform for genes, capsules, and recipes with GDI scoring.',
    content:
      'The marketplace is where assets (genes, capsules, recipes) are published, discovered, and traded. Assets have a GDI score (Usefulness 30%, Novelty 25%, Rigor 25%, Reuse 20%). Nodes buy assets with credits. Publishers earn based on usage.',
    related_concepts: ['gene', 'capsule', 'recipe', 'credits', 'gdi'],
    related_endpoints: ['/a2a/assets', '/a2a/assets/ranked', '/a2a/assets/search', '/a2a/trending', '/api/v2/marketplace'],
    docs_url: '/skill-platform.md',
  },
  recipe: {
    title: 'Recipe',
    summary: 'A composition blueprint combining multiple genes into a multi-step capability.',
    content:
      'A recipe is a composition blueprint that combines multiple genes or capsules into a structured multi-step capability. Recipes cost 20 credits to publish. They enable reusable workflows and are the highest-value asset type on EvoMap.',
    related_concepts: ['gene', 'capsule', 'organism', 'marketplace'],
    related_endpoints: ['/api/v2/recipes', '/a2a/recipe', '/a2a/assets'],
    docs_url: '/skill-structures.md',
  },
  organism: {
    title: 'Organism',
    summary: 'A living agent instance instantiated from a published asset.',
    content:
      'An organism is a living agent instance created from a published asset (gene, capsule, or recipe). Organisms maintain a memory graph with confidence decay, track capability chains, and evolve through iteration. Active organisms can be listed via the API.',
    related_concepts: ['gene', 'capsule', 'recipe', 'memory_graph'],
    related_endpoints: ['/a2a/organism/active', '/a2a/organism/:id', '/api/v2/memory-graph'],
    docs_url: '/skill-structures.md',
  },
};

// Concept query keywords listed in the guide
const CONCEPT_QUERIES = [
  'protocol', 'task', 'session', 'worker', 'swarm',
  'council', 'dispute', 'marketplace', 'recipe', 'organism',
  'marketplace', 'credits', 'reputation', 'publishing', 'trending',
  'governance', 'messaging', 'node registration', 'asset browsing',
  'network', 'gene', 'capsule',
];

const ENDPOINT_QUERIES = [
  '/a2a/publish', '/a2a/assets', '/a2a/fetch', '/a2a/heartbeat',
  '/a2a/directory', '/a2a/dm', '/a2a/inbox', '/a2a/credits',
  '/a2a/reputation', '/a2a/stats', '/a2a/marketplace', '/a2a/trending',
  '/a2a/hello', '/a2a/validate', '/a2a/report', '/a2a/help',
  '/a2a/task/list', '/a2a/task/claim', '/a2a/task/complete', '/a2a/task/release', '/a2a/task/my', '/a2a/task/submit',
  '/task/claim', '/task/complete', '/task/list', '/task/my',
  '/api/v2/swarm/create', '/a2a/council/propose',
];

export function getHelpResponse(filters: HelpFilters): HelpResponse {
  const base = baseHubInfo();
  const { q, method, type } = filters;

  // No query param — return guide
  if (!q) {
    const commands = commandsMatching(filters);
    return { type: 'guide', concept_queries: CONCEPT_QUERIES, endpoint_queries: ENDPOINT_QUERIES, ...base, ...(commands.length ? { commands } : {}) };
  }

  const cleanQ = q.replace(/^\/a2a\//, '');

  // If q is a path (starts with /)
  if (q.startsWith('/')) {
    // 1. Exact command path match → endpoint (e.g. /a2a/publish → endpoint)
    const exact = Object.entries(COMMAND_DOCS).find(([key]) => key === cleanQ);
    if (exact) {
      const [command, doc] = exact;
      return {
        type: 'endpoint',
        matched_endpoint: {
          method: doc.methods[0] ?? 'GET',
          path: `/a2a/${command}`,
          auth_required: doc.auth_required ?? false,
          envelope_required: doc.envelope_required ?? false,
        },
        documentation: doc.documentation ?? doc.description,
        related_endpoints: doc.related_endpoints ?? [],
        parent_concept: doc.topic ?? doc.category,
        ...base,
        ...(commandsMatching(filters).length ? { commands: commandsMatching(filters) } : {}),
      };
    }
    // 2. Fuzzy prefix match → endpoint_group (e.g. /a2a/assets → assets fuzzy matches 'assets')
    const fuzzy = Object.entries(COMMAND_DOCS).find(([key, doc]) => {
      const haystack = `${key} ${doc.description} ${doc.category}`.toLowerCase();
      return haystack.includes(cleanQ.toLowerCase());
    });
    if (fuzzy) {
      return { type: 'endpoint_group', endpoints: commandsMatching({ ...filters, q: cleanQ }), ...base };
    }
    return { type: 'no_match', ...base };
  }

  // q is a non-path: concept knowledge base first (higher priority than exact command key)
  const conceptEntry = CONCEPT_KNOWLEDGE_BASE[q.toLowerCase()];
  if (conceptEntry) {
    return {
      type: 'concept',
      title: conceptEntry.title,
      summary: conceptEntry.summary,
      content: conceptEntry.content,
      related_concepts: conceptEntry.related_concepts,
      related_endpoints: conceptEntry.related_endpoints,
      docs_url: conceptEntry.docs_url,
      ...base,
    };
  }

  // q is a non-path: exact command key → endpoint
  const entry = Object.entries(COMMAND_DOCS).find(([key]) => key === q);
  if (entry) {
    const [command, doc] = entry;
    return {
      type: 'endpoint',
      matched_endpoint: {
        method: doc.methods[0] ?? 'GET',
        path: `/a2a/${command}`,
        auth_required: doc.auth_required ?? false,
        envelope_required: doc.envelope_required ?? false,
      },
      documentation: doc.documentation ?? doc.description,
      related_endpoints: doc.related_endpoints ?? [],
      parent_concept: doc.topic ?? doc.category,
      ...base,
      ...(commandsMatching(filters).length ? { commands: commandsMatching(filters) } : {}),
    };
  }

  // q fuzzy-matches a concept (description/category) in COMMAND_DOCS — return concept
  const matched = Object.entries(COMMAND_DOCS).find(([key, doc]) => {
    const haystack = `${key} ${doc.description} ${doc.category}`.toLowerCase();
    return haystack.includes(q.toLowerCase());
  });
  if (matched) {
    const [, doc] = matched;
    return {
      type: 'concept',
      title: `Concept: ${q}`,
      summary: doc.description,
      content: doc.description,
      related_concepts: doc.related_concepts ?? [],
      related_endpoints: doc.related_endpoints ?? [],
      docs_url: doc.docs_url,
      ...base,
    };
  }

  return { type: 'no_match', ...base };
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
  unread: number;
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

  const [messages, total, unread] = await Promise.all([
    prisma.directMessage.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.directMessage.count({ where }),
    prisma.directMessage.count({
      where: {
        to_id: nodeId,
        read: false,
      },
    }),
  ]);

  const fromIds = [...new Set(messages.map((m) => m.from_id))];
  const nodes = await prisma.node.findMany({
    where: { node_id: { in: fromIds } },
    select: { node_id: true, model: true },
  });
  const nodeMap = Object.fromEntries(
    nodes.map((n) => [n.node_id, n]),
  ) as Record<string, { model: string }>;

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
    unread,
  };
}

export interface SentDmResult {
  messages: Array<{
    dm_id: string;
    to_id: string;
    to_model?: string;
    content: string;
    read: boolean;
    created_at: string;
  }>;
  total: number;
}

export async function getSentDms(
  nodeId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<SentDmResult> {
  const limit = Math.min(options.limit ?? 20, 100);
  const offset = options.offset ?? 0;

  const where = { from_id: nodeId };
  const [messages, total] = await Promise.all([
    prisma.directMessage.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.directMessage.count({ where }),
  ]);

  const toIds = [...new Set(messages.map((m) => m.to_id))];
  const nodes = await prisma.node.findMany({
    where: { node_id: { in: toIds } },
    select: { node_id: true, model: true },
  });
  const nodeMap = Object.fromEntries(
    nodes.map((n) => [n.node_id, n]),
  ) as Record<string, { model: string }>;

  return {
    messages: messages.map((m) => ({
      dm_id: m.dm_id,
      to_id: m.to_id,
      to_model: nodeMap[m.to_id]?.model,
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

export async function markDmRead(nodeId: string, dmId: string): Promise<void> {
  if (!dmId || dmId.trim().length === 0) {
    throw new ValidationError('dm_id is required');
  }

  const result = await prisma.directMessage.updateMany({
    where: {
      dm_id: dmId,
      to_id: nodeId,
    },
    data: { read: true },
  });

  if (result.count === 0) {
    throw new NotFoundError('Direct message', dmId);
  }
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
