/**
 * A2A Protocol Service
 * Core business logic for agent-to-agent communication
 */

import type { PrismaClient } from '@prisma/client';
import type {
  A2ANode,
  HelloRequest,
  HelloResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  PublishRequest,
  PublishResponse,
  FetchRequest,
  FetchResponse,
  SearchRequest,
  SearchResponse,
  ReportRequest,
  ReportResponse,
  DirectoryResponse,
  NodeDetailResponse,
  EarningsResponse,
  HelpResponse,
  NodeStatus,
} from './types';

const PROTOCOL_VERSION = '1.0.0';

// In-memory cache for directory (production would use Redis)
const nodeDirectory = new Map<string, A2ANode>();

export async function processHello(
  prisma: PrismaClient,
  req: HelloRequest
): Promise<HelloResponse> {
  const { node_id, model, capabilities = [], endpoint } = req;

  // Update or create node in database
  await prisma.node.upsert({
    where: { node_id },
    update: {
      model,
      status: 'active',
      last_seen: new Date(),
    },
    create: {
      node_id,
      model,
      status: 'active',
      node_secret: '', // Will be set via separate auth
    },
  });

  // Update in-memory directory
  nodeDirectory.set(node_id, {
    node_id,
    model,
    status: 'active',
    trust_level: 'unverified',
    reputation: 50,
    capabilities,
    endpoint,
    last_seen: new Date(),
    registered_at: new Date(),
  });

  return {
    success: true,
    node_id,
    protocol_version: PROTOCOL_VERSION,
    server_time: new Date().toISOString(),
  };
}

export async function processHeartbeat(
  prisma: PrismaClient,
  req: HeartbeatRequest
): Promise<HeartbeatResponse> {
  const { node_id, load_metrics } = req;

  // Update last_seen in database
  await prisma.node.update({
    where: { node_id },
    data: {
      last_seen: new Date(),
      status: 'active',
    },
  }).catch(() => {
    // Node might not exist yet, create it
    return prisma.node.create({
      data: {
        node_id,
        model: 'unknown',
        status: 'active',
        node_secret: '',
        last_seen: new Date(),
      },
    });
  });

  // Update in-memory cache
  const cached = nodeDirectory.get(node_id);
  if (cached) {
    cached.last_seen = new Date();
    nodeDirectory.set(node_id, cached);
  }

  return {
    success: true,
    server_time: new Date().toISOString(),
    message: load_metrics ? 'Metrics received' : undefined,
  };
}

export async function processPublish(
  prisma: PrismaClient,
  req: PublishRequest
): Promise<PublishResponse> {
  const { node_id, capabilities, metadata } = req;

  // Update node with new capabilities
  await prisma.node.update({
    where: { node_id },
    data: {
      last_seen: new Date(),
      status: 'active',
    },
  });

  // Update cached entry
  const cached = nodeDirectory.get(node_id);
  if (cached) {
    cached.capabilities = capabilities;
    nodeDirectory.set(node_id, cached);
  }

  return {
    success: true,
    published_at: new Date().toISOString(),
    directory_version: nodeDirectory.size,
  };
}

export async function processFetch(
  prisma: PrismaClient,
  req: FetchRequest
): Promise<FetchResponse> {
  const { node_id, target_id, resource_type } = req;

  // Update requester's last_seen
  await prisma.node.update({
    where: { node_id },
    data: { last_seen: new Date() },
  }).catch(() => {});

  if (resource_type === 'node') {
    // Check in-memory cache first
    const cached = nodeDirectory.get(target_id);
    if (cached) {
      return {
        success: true,
        data: cached,
        cached: true,
        cache_age: Date.now() - cached.last_seen.getTime(),
      };
    }

    // Fetch from database
    const node = await prisma.node.findUnique({
      where: { node_id: target_id },
    });

    if (!node) {
      return { success: false, cached: false };
    }

    const a2aNode: A2ANode = {
      node_id: node.node_id,
      model: node.model,
      status: node.status as NodeStatus,
      trust_level: node.trust_level,
      reputation: node.reputation,
      capabilities: [],
      last_seen: node.last_seen,
      registered_at: node.registered_at,
    };

    // Cache it
    nodeDirectory.set(target_id, a2aNode);

    return {
      success: true,
      data: a2aNode,
      cached: false,
    };
  }

  if (resource_type === 'asset') {
    const asset = await prisma.asset.findUnique({
      where: { asset_id: target_id },
    });

    if (!asset) {
      return { success: false, cached: false };
    }

    return {
      success: true,
      data: asset,
      cached: false,
    };
  }

  return { success: false, cached: false };
}

export async function processSearch(
  prisma: PrismaClient,
  req: SearchRequest
): Promise<SearchResponse> {
  const { node_id, query, filters, limit = 10 } = req;

  // Update requester's last_seen
  await prisma.node.update({
    where: { node_id },
    data: { last_seen: new Date() },
  }).catch(() => {});

  // Search in database
  const whereClause: Record<string, unknown> = {};
  if (filters?.status) {
    whereClause.status = filters.status;
  }
  if (filters?.trust_level_min) {
    whereClause.reputation = { gte: filters.trust_level_min };
  }

  const nodes = await prisma.node.findMany({
    where: whereClause,
    take: limit,
    orderBy: { reputation: 'desc' },
  });

  const results = nodes.map((node) => ({
    node_id: node.node_id,
    model: node.model,
    reputation: node.reputation,
    capabilities: [] as string[],
    relevance_score: 0.8, // Placeholder - would use vector search in production
  }));

  return {
    success: true,
    results,
    total: results.length,
  };
}

export async function processReport(
  prisma: PrismaClient,
  req: ReportRequest
): Promise<ReportResponse> {
  const { node_id, report_type, data } = req;

  // Update last_seen
  await prisma.node.update({
    where: { node_id },
    data: { last_seen: new Date() },
  }).catch(() => {});

  const reportId = `rpt_${Date.now()}_${node_id}`;

  // In production, would store report in database or send to monitoring
  console.log(`A2A Report from ${node_id}:`, { report_type, data });

  return {
    success: true,
    report_id: reportId,
    acknowledged: true,
  };
}

export async function getDirectory(
  prisma: PrismaClient,
  limit = 100
): Promise<DirectoryResponse> {
  const nodes = await prisma.node.findMany({
    take: limit,
    orderBy: { reputation: 'desc' },
  });

  const a2aNodes: A2ANode[] = nodes.map((node) => ({
    node_id: node.node_id,
    model: node.model,
    status: node.status as NodeStatus,
    trust_level: node.trust_level,
    reputation: node.reputation,
    capabilities: [],
    last_seen: node.last_seen,
    registered_at: node.registered_at,
  }));

  return {
    nodes: a2aNodes,
    total: a2aNodes.length,
    version: Date.now(),
  };
}

export async function getNodeDetail(
  prisma: PrismaClient,
  nodeId: string
): Promise<NodeDetailResponse | null> {
  const node = await prisma.node.findUnique({
    where: { node_id: nodeId },
  });

  if (!node) {
    return null;
  }

  return {
    node: {
      node_id: node.node_id,
      model: node.model,
      status: node.status as NodeStatus,
      trust_level: node.trust_level,
      reputation: node.reputation,
      capabilities: [],
      last_seen: node.last_seen,
      registered_at: node.registered_at,
    },
    recent_activity: {
      last_heartbeat: node.last_seen.toISOString(),
      task_completion_rate: 0.85, // Placeholder
    },
  };
}

export async function getEarnings(
  prisma: PrismaClient,
  nodeId: string,
  period = 'month'
): Promise<EarningsResponse> {
  // Get transactions for this node
  const transactions = await prisma.creditTransaction.findMany({
    where: {
      node_id: nodeId,
      timestamp: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
  });

  const taskExecution = transactions
    .filter((t) => t.type === 'task_reward')
    .reduce((sum, t) => sum + t.amount, 0);

  const assetPublication = transactions
    .filter((t) => t.type === 'asset_publication')
    .reduce((sum, t) => sum + t.amount, 0);

  const reputationBonus = transactions
    .filter((t) => t.type === 'reputation_bonus')
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    node_id: nodeId,
    period,
    earnings: {
      total: taskExecution + assetPublication + reputationBonus,
      breakdown: {
        task_execution: taskExecution,
        asset_publication: assetPublication,
        reputation_bonus: reputationBonus,
      },
    },
  };
}

export function getHelp(): HelpResponse {
  return {
    protocol: 'A2A',
    version: PROTOCOL_VERSION,
    endpoints: [
      { method: 'POST', path: '/a2a/hello', description: 'Node handshake', auth_required: false },
      { method: 'POST', path: '/a2a/heartbeat', description: 'Heartbeat', auth_required: false },
      { method: 'POST', path: '/a2a/publish', description: 'Publish capability', auth_required: true },
      { method: 'POST', path: '/a2a/fetch', description: 'Fetch node/asset', auth_required: false },
      { method: 'POST', path: '/a2a/search', description: 'Search directory', auth_required: false },
      { method: 'POST', path: '/a2a/report', description: 'Report status', auth_required: true },
      { method: 'GET', path: '/a2a/directory', description: 'List nodes', auth_required: false },
      { method: 'GET', path: '/a2a/nodes/:nodeId', description: 'Get specific node', auth_required: false },
      { method: 'GET', path: '/a2a/billing/earnings', description: 'Earnings', auth_required: true },
      { method: 'GET', path: '/a2a/help', description: 'Help info', auth_required: false },
    ],
  };
}
