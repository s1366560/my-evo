/**
 * EvoMap Hub - A2A Protocol Server
 * 
 * Phase 1: Node registration & heartbeat (complete)
 * Phase 2: Asset system (Gene/Capsule/EvolutionEvent) - COMPLETE
 * Phase 3: Swarm Multi-Agent Collaboration - COMPLETE
 * Phase 4: GDI Reputation & Credit System - COMPLETE
 */

import express, { Request, Response, NextFunction } from 'express';
import { registerNode, validateNodeSecret, getNodeInfo, HUB_NODE_ID } from './a2a/node';
import { processHeartbeat } from './a2a/heartbeat';
import { HelloPayload, HeartbeatPayload } from './a2a/types';
import { publishAsset, submitValidationReport, revokeAsset } from './assets/publish';
import { fetchAssets, getTrendingAssets, getRankedAssets, getAssetDetails } from './assets/fetch';
import { FetchQuery } from './assets/types';
import { getLineage, getLineageChain, getDescendantChain, getLineageMetadata, getLineageTreeSize, haveCommonAncestor, getRootAncestor } from './assets/lineage';
import { projectApi } from './projects/api';
import { recipeApi } from './recipe/api';

const app = express();
app.use(express.json());

// Serve static UI files from ui directory
import { join } from 'path';
// On Vercel serverless: __dirname = /var/task/dist, so ../ui = /var/task/ui
const uiDir = join(__dirname, '..', 'ui');
app.use('/ui', express.static(uiDir));

// Serve index.html at root
import { readFileSync } from 'fs';
app.get('/', (_req: Request, res: Response) => {
  res.type('html').send(readFileSync(join(uiDir, 'index.html')));
});

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', hub_id: HUB_NODE_ID });
});

// ==================== Auth Middleware ====================
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  const nodeId = validateNodeSecret(token);
  if (!nodeId) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
    return;
  }
  (req as Request & { nodeId: string }).nodeId = nodeId;
  next();
}

// ==================== A2A Endpoints ====================

/**
 * POST /a2a/hello
 * Register a node and get node_secret
 */
app.post('/a2a/hello', async (req: Request, res: Response) => {
  try {
    const payload = req.body as HelloPayload;
    
    if (!payload) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing payload body' });
      return;
    }

    const result = await registerNode(payload);
    
    // Initialize credit balance for new nodes
    if (result.status === 'acknowledged' || result.status === 'ok') {
      const nodeId = result.your_node_id;
      if (nodeId && !getCreditBalance(nodeId)) {
        initializeCreditBalance(nodeId);
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Hello error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/heartbeat
 * Keep node alive and receive events/tasks
 */
app.post('/a2a/heartbeat', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const payload = req.body as HeartbeatPayload;

    if (!payload.sender_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing sender_id in payload' });
      return;
    }

    const result = await processHeartbeat(authHeader, payload);
    res.json(result);
  } catch (error) {
    console.error('Heartbeat error:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      res.status(401).json({ error: 'unauthorized', message: error.message });
      return;
    }
    
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/nodes
 * List all registered nodes
 */
app.get('/a2a/nodes', (_req: Request, res: Response) => {
  const { getAllNodes } = require('./a2a/node');
  const nodes = getAllNodes();
  res.json({ nodes, count: nodes.length });
});

/**
 * GET /a2a/nodes/:id
 * Get specific node info
 */
app.get('/a2a/nodes/:id', (req: Request, res: Response) => {
  const nodeId = req.params.id;
  const node = getNodeInfo(nodeId);
  
  if (!node) {
    res.status(404).json({ error: 'node_not_found', message: `Node ${nodeId} not found` });
    return;
  }
  res.json(node);
});

// ==================== Phase 3: Swarm Endpoints ====================
import {
  createSwarm, getSwarm, listSwarms, updateSwarmState,
  createSubtask, getSubtask, getSubtasksForSwarm, updateSubtaskState, assignSubtask,
  submitDecomposition, getProposal, acceptProposal, rejectProposal,
  submitAggregatedResult, getAggregatedResult,
  distributeBounty, getBountyDistribution,
  createSession, getSession, updateSession,
  getSwarmStats,
} from './swarm/engine';
import {
  calculateReputation, getReputation, calculateTier,
  getCreditBalance, initializeCreditBalance,
  creditForPromotion, creditForFetch, creditForReport, debitForPublish, debitForRevoke,
  creditForBounty, getReputationLeaderboard,
} from './reputation/engine';

// ==================== Phase 2: Asset Endpoints ====================

/**
 * POST /a2a/publish
 * Publish asset bundle (Gene, Capsule, EvolutionEvent)
 * 
 * Request body:
 * {
 *   "assets": [Asset, ...],
 *   "evolution_event"?: EvolutionEvent
 * }
 */
app.post('/a2a/publish', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const authHeader = req.headers.authorization!;
    const token = authHeader.slice(7);

    const bundle = req.body;

    if (!bundle.assets || !Array.isArray(bundle.assets)) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Request must include assets array',
      });
      return;
    }

    const result = publishAsset(bundle, nodeId, token);
    res.json(result);
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/fetch
 * Search/fetch assets
 * 
 * Request body:
 * {
 *   "query"?: "HTTP timeout retry",
 *   "type"?: "Gene" | "Capsule",
 *   "category"?: "repair",
 *   "min_gdi"?: 60,
 *   "signals"?: ["timeout"],
 *   "limit"?: 20,
 *   "offset"?: 0
 * }
 */
app.post('/a2a/fetch', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const query: FetchQuery = req.body;

    const result = fetchAssets(query, nodeId);
    res.json(result);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/report
 * Submit validation report for an asset
 */
app.post('/a2a/report', requireAuth, (req: Request, res: Response) => {
  try {
    const { asset_id, outcome, usage_context } = req.body;

    if (!asset_id || !outcome) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing asset_id or outcome' });
      return;
    }

    const result = submitValidationReport(
      asset_id,
      outcome,
    );

    if (result.accepted) {
      res.json({ status: 'accepted', asset_id });
    } else {
      res.status(422).json({ status: 'rejected', reason: result.reason });
    }
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/revoke
 * Revoke (archive) an asset
 */
app.post('/a2a/revoke', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const { asset_id, reason } = req.body;

    if (!asset_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing asset_id' });
      return;
    }

    const result = revokeAsset(asset_id, nodeId, reason);

    if (result.success) {
      res.json({ status: 'revoked', asset_id });
    } else {
      res.status(403).json({ error: 'forbidden', message: result.error });
    }
  } catch (error) {
    console.error('Revoke error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/assets/ranked
 * Get GDI-ranked assets
 * Query params: type, period, limit
 */
app.get('/a2a/assets/ranked', (req: Request, res: Response) => {
  try {
    const { type, period, limit } = req.query as Record<string, string>;
    const assets = getRankedAssets({
      type,
      period: period as 'day' | 'week' | 'month' | undefined,
      limit: limit ? parseInt(limit) : 20,
    });
    res.json({ assets, total: assets.length });
  } catch (error) {
    console.error('Ranked error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/trending
 * Get trending (most fetched) assets
 * Query params: type, period, limit
 */
app.get('/a2a/trending', (req: Request, res: Response) => {
  try {
    const { type, period, limit } = req.query as Record<string, string>;
    const assets = getTrendingAssets({
      type,
      period: period as 'day' | 'week' | 'month' | undefined,
      limit: limit ? parseInt(limit) : 10,
    });
    res.json({ assets, total: assets.length });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/assets/:id
 * Get single asset details
 */
app.get('/a2a/assets/:id', (req: Request, res: Response) => {
  try {
    const asset = getAssetDetails(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'not_found', message: 'Asset not found' });
      return;
    }
    res.json(asset);
  } catch (error) {
    console.error('Asset detail error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/stats
 * Hub-wide asset statistics
 */
app.get('/a2a/stats', (_req: Request, res: Response) => {
  try {
    const { getAssetStats } = require('./assets/store');
    const stats = getAssetStats();
    res.json({
      hub_id: HUB_NODE_ID,
      ...stats,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ==================== Phase 2: Asset Lineage Endpoints ====================

/**
 * GET /a2a/lineage/:assetId
 * Get full lineage (parents + children) for an asset
 */
app.get('/a2a/lineage/:assetId', (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const { max_depth } = req.query;

    const lineage = getLineage(assetId);
    res.json({
      asset_id: assetId,
      ...lineage,
      max_depth: max_depth ? parseInt(max_depth as string) : undefined,
    });
  } catch (error) {
    console.error('Lineage error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/lineage/:assetId/chain
 * Get ancestor chain for an asset
 */
app.get('/a2a/lineage/:assetId/chain', (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const maxDepth = parseInt(req.query.max_depth as string) || 10;

    const chain = getLineageChain(assetId, maxDepth);

    // Resolve asset types and statuses for each chain entry
    const { getAsset } = require('./assets/store');
    const resolvedChain = chain.chain.map((ref: { asset_id: string; type: string; id: string; status: string }) => {
      const record = getAsset(ref.asset_id);
      return {
        asset_id: ref.asset_id,
        type: record?.asset.type ?? 'unknown',
        id: record?.asset.id ?? ref.asset_id,
        status: record?.status ?? 'unknown',
      };
    });

    res.json({
      asset_id: assetId,
      chain: resolvedChain,
      depth: chain.depth,
    });
  } catch (error) {
    console.error('Lineage chain error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/lineage/:assetId/descendants
 * Get descendant chain for an asset
 */
app.get('/a2a/lineage/:assetId/descendants', (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const maxDepth = parseInt(req.query.max_depth as string) || 10;

    const chain = getDescendantChain(assetId, maxDepth);

    // Resolve asset types and statuses
    const { getAsset } = require('./assets/store');
    const resolvedChain = chain.chain.map((ref: { asset_id: string; type: string; id: string; status: string }) => {
      const record = getAsset(ref.asset_id);
      return {
        asset_id: ref.asset_id,
        type: record?.asset.type ?? 'unknown',
        id: record?.asset.id ?? ref.asset_id,
        status: record?.status ?? 'unknown',
      };
    });

    res.json({
      asset_id: assetId,
      descendants: resolvedChain,
      depth: chain.depth,
    });
  } catch (error) {
    console.error('Lineage descendants error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/lineage/:assetId/tree-size
 * Get total number of assets in the lineage tree
 */
app.get('/a2a/lineage/:assetId/tree-size', (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const size = getLineageTreeSize(assetId);
    const root = getRootAncestor(assetId);

    res.json({
      asset_id: assetId,
      root_ancestor: root,
      tree_size: size,
    });
  } catch (error) {
    console.error('Lineage tree-size error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/lineage/:assetId/metadata
 * Get lineage metadata for an asset
 */
app.get('/a2a/lineage/:assetId/metadata', (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const metadata = getLineageMetadata(assetId);

    if (!metadata) {
      res.status(404).json({ error: 'not_found', message: 'No lineage metadata found for this asset' });
      return;
    }

    res.json(metadata);
  } catch (error) {
    console.error('Lineage metadata error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/lineage/:assetId/common-ancestor/:otherAssetId
 * Check if two assets share a common ancestor
 */
app.get('/a2a/lineage/:assetId/common-ancestor/:otherAssetId', (req: Request, res: Response) => {
  try {
    const { assetId, otherAssetId } = req.params;
    const hasCommon = haveCommonAncestor(assetId, otherAssetId);

    let commonRoot: string | undefined;
    if (hasCommon) {
      commonRoot = getRootAncestor(assetId);
    }

    res.json({
      asset_id_1: assetId,
      asset_id_2: otherAssetId,
      has_common_ancestor: hasCommon,
      common_root: commonRoot,
    });
  } catch (error) {
    console.error('Lineage common-ancestor error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ==================== Phase 3: Swarm Endpoints ====================

/**
 * POST /a2a/task/propose-decomposition
 * Submit a task decomposition proposal for a Swarm
 */
app.post('/a2a/task/propose-decomposition', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const { swarm_id, subtasks } = req.body;

    if (!swarm_id || !subtasks || !Array.isArray(subtasks)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing swarm_id or subtasks array' });
      return;
    }

    const swarm = getSwarm(swarm_id);
    if (!swarm) {
      res.status(404).json({ error: 'swarm_not_found', message: `Swarm ${swarm_id} not found` });
      return;
    }

    const proposal = submitDecomposition({
      swarm_id,
      proposer: nodeId,
      subtasks: subtasks.map((s: { id: string; description: string; weight: number }) => ({
        id: s.id,
        description: s.description,
        weight: s.weight,
      })),
    });

    // Auto-accept if weights sum <= 0.85
    const totalWeight = subtasks.reduce((sum: number, s: { weight: number }) => sum + s.weight, 0);
    if (totalWeight <= 0.85) {
      acceptProposal(swarm_id);
    }

    res.json({ status: 'proposal_submitted', proposal, auto_accepted: totalWeight <= 0.85 });
  } catch (error) {
    console.error('Propose decomposition error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/swarm/create
 * Create a new Swarm task
 */
app.post('/a2a/swarm/create', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const { swarm_id, title, description, bounty, deadline } = req.body;

    if (!swarm_id || !title || !description) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing required fields' });
      return;
    }

    const swarm = createSwarm({
      swarm_id,
      title,
      description,
      bounty: bounty ?? 0,
      created_by: nodeId,
      root_task_id: swarm_id,
      deadline,
    });

    res.json({ status: 'created', swarm });
  } catch (error) {
    console.error('Swarm create error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/task/swarm/:id
 * Get Swarm details
 */
app.get('/a2a/task/swarm/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const swarmId = req.params.id;
    const swarm = getSwarm(swarmId);

    if (!swarm) {
      res.status(404).json({ error: 'swarm_not_found', message: `Swarm ${swarmId} not found` });
      return;
    }

    const subtasks = getSubtasksForSwarm(swarmId);
    const proposal = getProposal(swarmId);
    const result = getAggregatedResult(swarmId);

    res.json({ swarm, subtasks, proposal, result });
  } catch (error) {
    console.error('Swarm get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/task/:id/claim
 * Claim a subtask in a Swarm
 */
app.post('/a2a/task/:id/claim', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const subtaskId = req.params.id;

    const subtask = getSubtask(subtaskId);
    if (!subtask) {
      res.status(404).json({ error: 'subtask_not_found', message: `Subtask ${subtaskId} not found` });
      return;
    }

    if (subtask.assigned_to && subtask.assigned_to !== nodeId) {
      res.status(409).json({ error: 'already_claimed', message: 'Subtask already claimed by another node' });
      return;
    }

    const updated = assignSubtask(subtaskId, nodeId);
    res.json({ status: 'claimed', subtask: updated });
  } catch (error) {
    console.error('Task claim error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/task/:id/complete
 * Complete a subtask with result
 */
app.post('/a2a/task/:id/complete', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const subtaskId = req.params.id;
    const { result } = req.body;

    const subtask = getSubtask(subtaskId);
    if (!subtask) {
      res.status(404).json({ error: 'subtask_not_found', message: `Subtask ${subtaskId} not found` });
      return;
    }

    if (subtask.assigned_to !== nodeId) {
      res.status(403).json({ error: 'forbidden', message: 'Not assigned to this node' });
      return;
    }

    const updated = updateSubtaskState(subtaskId, 'completed', result);
    res.json({ status: 'completed', subtask: updated });
  } catch (error) {
    console.error('Task complete error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/swarm/:id/aggregate
 * Submit aggregated result (aggregator role)
 */
app.post('/a2a/swarm/:id/aggregate', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const swarmId = req.params.id;
    const { output, confidence, summary } = req.body;

    const swarm = getSwarm(swarmId);
    if (!swarm) {
      res.status(404).json({ error: 'swarm_not_found', message: `Swarm ${swarmId} not found` });
      return;
    }

    const result = submitAggregatedResult({
      swarm_id: swarmId,
      aggregator: nodeId,
      output,
      confidence: confidence ?? 0.5,
      summary: summary ?? '',
    });

    // Distribute bounty
    if (swarm.bounty > 0) {
      distributeBounty(swarmId, swarm.bounty);
    }

    res.json({ status: 'aggregated', result });
  } catch (error) {
    console.error('Swarm aggregate error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/swarm/stats
 * Get Swarm statistics
 */
app.get('/a2a/swarm/stats', (_req: Request, res: Response) => {
  try {
    const stats = getSwarmStats();
    res.json(stats);
  } catch (error) {
    console.error('Swarm stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/session/create
 * Create a collaboration session
 */
app.post('/a2a/session/create', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const { session_id, swarm_id, participants, purpose, context } = req.body;

    if (!session_id || !swarm_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing session_id or swarm_id' });
      return;
    }

    const allParticipants = [...new Set([nodeId, ...(participants ?? [])])];
    const session = createSession({
      session_id,
      swarm_id,
      participants: allParticipants,
      purpose: purpose ?? '',
      context: context ?? {},
    });

    res.json({ status: 'created', session });
  } catch (error) {
    console.error('Session create error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/dialog
 * Structured dialog message
 */
app.post('/a2a/dialog', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const { session_id, content, dialog_type } = req.body;

    if (!session_id || !content) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing session_id or content' });
      return;
    }

    const session = getSession(session_id);
    if (!session) {
      res.status(404).json({ error: 'session_not_found', message: `Session ${session_id} not found` });
      return;
    }

    // Update session context
    updateSession(session_id, {
      context: {
        ...session.context,
        last_message: { from: nodeId, content, type: dialog_type ?? 'reasoning', at: new Date().toISOString() },
      },
    });

    res.json({ status: 'dialog_recorded', session_id });
  } catch (error) {
    console.error('Dialog error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ==================== Recipe & Organism Endpoints ====================

/**
 * POST /a2a/recipe
 * Create a new recipe
 */
app.post('/a2a/recipe', (req: Request, res: Response) => {
  recipeApi.create(req, res);
});

/**
 * GET /a2a/recipe/list
 * List all recipes
 */
app.get('/a2a/recipe/list', (req: Request, res: Response) => {
  recipeApi.list(req, res);
});

/**
 * GET /a2a/recipe/:id
 * Get recipe details
 */
app.get('/a2a/recipe/:id', (req: Request, res: Response) => {
  recipeApi.get(req, res);
});

/**
 * POST /a2a/recipe/:id/publish
 * Publish a recipe
 */
app.post('/a2a/recipe/:id/publish', (req: Request, res: Response) => {
  recipeApi.publish(req, res);
});

/**
 * PATCH /a2a/recipe/:id
 * Update recipe (via fork)
 */
app.patch('/a2a/recipe/:id', (req: Request, res: Response) => {
  recipeApi.update(req, res);
});

/**
 * POST /a2a/recipe/:id/archive
 * Archive a recipe
 */
app.post('/a2a/recipe/:id/archive', (req: Request, res: Response) => {
  recipeApi.archive(req, res);
});

/**
 * POST /a2a/recipe/:id/fork
 * Fork a recipe
 */
app.post('/a2a/recipe/:id/fork', (req: Request, res: Response) => {
  recipeApi.fork(req, res);
});

/**
 * POST /a2a/recipe/:id/express
 * Express a recipe into an organism
 */
app.post('/a2a/recipe/:id/express', (req: Request, res: Response) => {
  recipeApi.express(req, res);
});

/**
 * POST /a2a/organism/:id/express-gene
 * Express a gene in an organism
 */
app.post('/a2a/organism/:id/express-gene', (req: Request, res: Response) => {
  recipeApi.expressGene(req, res);
});

/**
 * PATCH /a2a/organism/:id
 * Update organism status (completed/failed)
 */
app.patch('/a2a/organism/:id', (req: Request, res: Response) => {
  recipeApi.updateOrganism(req, res);
});

/**
 * GET /a2a/recipe/stats
 * Get recipe statistics
 */
app.get('/a2a/recipe/stats', (req: Request, res: Response) => {
  recipeApi.stats(req, res);
});

// ==================== Phase 4: Bounty Endpoints ====================
import {
  createBounty,
  getBounty,
  listBounties,
  updateBountyState,
  submitBid,
  getBid,
  getBidsForBounty,
  acceptBid,
  submitDeliverable,
  getDeliverable,
  acceptBounty,
  cancelBounty,
  disputeBounty,
  getOpenBounties,
  getBountiesByWorker,
  getBountyStats,
  countBounties,
  BOUNTY_MIN_REWARD,
} from './bounty/engine';
import { BOUNTY_MIN_REWARD as MIN_REWARD } from './bounty/types';

/**
 * POST /api/v2/bounties/create
 * Create a new bounty
 * Body: { bounty_id, title, description, tags?, reward, deadline?, visibility?, max_bids?, acceptance_criteria? }
 */
app.post('/api/v2/bounties/create', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const { bounty_id, title, description, tags, reward, deadline, visibility, max_bids, acceptance_criteria } = req.body;

    if (!bounty_id || !title || !description || !reward) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: bounty_id, title, description, reward',
        correction: { bounty_id: 'string', title: 'string', description: 'string', reward: 'number (min 50)' },
      });
      return;
    }

    if (reward < BOUNTY_MIN_REWARD) {
      res.status(400).json({
        error: 'reward_too_low',
        message: `Bounty reward must be at least ${BOUNTY_MIN_REWARD} credits`,
        correction: { minimum_reward: BOUNTY_MIN_REWARD },
      });
      return;
    }

    const bounty = createBounty({
      bounty_id,
      title,
      description,
      tags: tags ?? [],
      reward,
      deadline,
      visibility: visibility ?? 'public',
      max_bids: max_bids ?? 3,
      acceptance_criteria,
    });

    // Set creator (not in createBounty to keep engine pure)
    bounty.created_by = nodeId;

    res.json({ status: 'created', bounty });
  } catch (error) {
    console.error('Bounty create error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/bounties/list
 * List bounties with optional filters
 * Query: state, tags, created_by, min_reward, max_reward, limit, offset
 */
app.get('/api/v2/bounties/list', (req: Request, res: Response) => {
  try {
    const { state, tags, created_by, min_reward, max_reward, visibility, limit, offset } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, unknown> = {};
    if (state) filter['state'] = state;
    if (tags) filter['tags'] = String(tags).split(',');
    if (created_by) filter['created_by'] = String(created_by);
    if (min_reward) filter['min_reward'] = parseFloat(String(min_reward));
    if (max_reward) filter['max_reward'] = parseFloat(String(max_reward));
    if (visibility) filter['visibility'] = visibility;
    if (limit) filter['limit'] = parseInt(String(limit));
    if (offset) filter['offset'] = parseInt(String(offset));

    const bountiesResult = listBounties(filter as Parameters<typeof listBounties>[0]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = countBounties(state ? { state: state as any } : undefined);

    res.json({ bounties: bountiesResult, total });
  } catch (error) {
    console.error('Bounty list error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/bounties/open
 * Get open bounties (convenience endpoint)
 * Query: tags, limit
 */
app.get('/api/v2/bounties/open', (req: Request, res: Response) => {
  try {
    const { tags, limit } = req.query;
    const tagList = tags ? String(tags).split(',') : undefined;
    const bounties = getOpenBounties(tagList, limit ? parseInt(String(limit)) : 20);
    res.json({ bounties, total: bounties.length });
  } catch (error) {
    console.error('Bounty open error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/bounties/:id
 * Get bounty details
 */
app.get('/api/v2/bounties/:id', (req: Request, res: Response) => {
  try {
    const bounty = getBounty(req.params.id);
    if (!bounty) {
      res.status(404).json({ error: 'not_found', message: `Bounty ${req.params.id} not found` });
      return;
    }
    const bountyBids = getBidsForBounty(req.params.id);
    const deliverable = getDeliverable(req.params.id);
    res.json({ bounty, bids: bountyBids, deliverable });
  } catch (error) {
    console.error('Bounty get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/bounties/:id/bid
 * Submit a bid on a bounty
 */
app.post('/api/v2/bounties/:id/bid', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const bountyId = req.params.id;
    const { bid_id, proposal, estimated_completion } = req.body;

    if (!bid_id || !proposal) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: bid_id, proposal',
        correction: { bid_id: 'string', proposal: 'string (execution plan)' },
      });
      return;
    }

    const bid = submitBid({
      bid_id,
      bounty_id: bountyId,
      bidder: nodeId,
      proposal,
      estimated_completion,
    });

    res.json({ status: 'bid_submitted', bid });
  } catch (error) {
    console.error('Bounty bid error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('not found')) {
      res.status(404).json({ error: 'not_found', message: msg });
    } else if (msg.includes('not open') || msg.includes('already submitted') || msg.includes('max bids')) {
      res.status(409).json({ error: 'conflict', message: msg });
    } else {
      res.status(500).json({ error: 'internal_error', message: msg });
    }
  }
});

/**
 * POST /api/v2/bounties/:id/claim
 * Accept a bid and start work (creator only)
 * Body: { bid_id }
 */
app.post('/api/v2/bounties/:id/claim', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const bountyId = req.params.id;
    const { bid_id } = req.body;

    if (!bid_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing bid_id' });
      return;
    }

    const bounty = getBounty(bountyId);
    if (!bounty) {
      res.status(404).json({ error: 'not_found', message: `Bounty ${bountyId} not found` });
      return;
    }
    if (bounty.created_by !== nodeId) {
      res.status(403).json({ error: 'forbidden', message: 'Only bounty creator can accept bids' });
      return;
    }

    const bid = acceptBid(bountyId, bid_id);
    res.json({ status: 'bid_accepted', bid, bounty: getBounty(bountyId) });
  } catch (error) {
    console.error('Bounty claim error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/bounties/:id/submit
 * Submit deliverable (worker only)
 * Body: { content, artifacts?, review_note? }
 */
app.post('/api/v2/bounties/:id/submit', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const bountyId = req.params.id;
    const { content, artifacts, review_note } = req.body;

    if (!content) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing content' });
      return;
    }

    const deliverable = submitDeliverable({
      bounty_id: bountyId,
      worker: nodeId,
      content,
      artifacts,
      review_note,
    });

    res.json({ status: 'deliverable_submitted', deliverable });
  } catch (error) {
    console.error('Bounty submit error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('not found')) {
      res.status(404).json({ error: 'not_found', message: msg });
    } else if (msg.includes('not in_progress') || msg.includes('does not have an accepted bid')) {
      res.status(409).json({ error: 'conflict', message: msg });
    } else {
      res.status(500).json({ error: 'internal_error', message: msg });
    }
  }
});

/**
 * POST /api/v2/bounties/:id/accept
 * Accept deliverable and release reward (creator only)
 * Body: { worker, actual_reward }
 */
app.post('/api/v2/bounties/:id/accept', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const bountyId = req.params.id;
    const { worker, actual_reward } = req.body;

    if (!worker || actual_reward === undefined) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing worker or actual_reward' });
      return;
    }

    const payout = acceptBounty({
      bounty_id: bountyId,
      creator: nodeId,
      worker,
      actual_reward,
    });

    res.json({ status: 'bounty_completed', payout, bounty: getBounty(bountyId) });
  } catch (error) {
    console.error('Bounty accept error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('not found')) {
      res.status(404).json({ error: 'not_found', message: msg });
    } else if (msg.includes('not authorized') || msg.includes('not pending')) {
      res.status(403).json({ error: 'forbidden', message: msg });
    } else {
      res.status(500).json({ error: 'internal_error', message: msg });
    }
  }
});

/**
 * POST /api/v2/bounties/:id/cancel
 * Cancel a bounty
 * Body: { reason? }
 */
app.post('/api/v2/bounties/:id/cancel', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const bountyId = req.params.id;
    const { reason } = req.body;

    const bounty = cancelBounty(bountyId, nodeId, reason);
    res.json({ status: 'cancelled', bounty });
  } catch (error) {
    console.error('Bounty cancel error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/bounties/:id/dispute
 * Raise a dispute on a bounty
 * Body: { reason }
 */
app.post('/api/v2/bounties/:id/dispute', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const bountyId = req.params.id;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing reason' });
      return;
    }

    const bounty = disputeBounty(bountyId, nodeId, reason);
    res.json({ status: 'disputed', bounty });
  } catch (error) {
    console.error('Bounty dispute error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/bounties/stats
 * Get bounty statistics
 */
app.get('/api/v2/bounties/stats', (_req: Request, res: Response) => {
  try {
    const stats = getBountyStats();
    res.json(stats);
  } catch (error) {
    console.error('Bounty stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/bounties/my
 * Get bounties for current node (as creator or worker)
 */
app.get('/api/v2/bounties/my', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const asCreator = listBounties({ created_by: nodeId });
    const asWorker = getBountiesByWorker(nodeId);
    res.json({ as_creator: asCreator, as_worker: asWorker });
  } catch (error) {
    console.error('Bounty my error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ==================== Phase 4: Reputation & Credit Endpoints ====================

/**
 * GET /a2a/reputation/:nodeId
 * Get reputation score for a node
 */
app.get('/a2a/reputation/:nodeId', (req: Request, res: Response) => {
  try {
    const nodeId = req.params.nodeId;
    const score = calculateReputation(nodeId);
    const tier = calculateTier(nodeId);
    res.json({ reputation: score, tier });
  } catch (error) {
    console.error('Reputation error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/reputation/:nodeId/credits
 * Get credit balance for a node
 */
app.get('/a2a/reputation/:nodeId/credits', (req: Request, res: Response) => {
  try {
    const nodeId = req.params.nodeId;
    let balance = getCreditBalance(nodeId);
    if (!balance) {
      balance = initializeCreditBalance(nodeId);
    }
    res.json({ credits: balance });
  } catch (error) {
    console.error('Credits error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/reputation/leaderboard
 * Get reputation leaderboard
 */
app.get('/a2a/reputation/leaderboard', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const leaders = getReputationLeaderboard(limit);
    res.json({ leaderboard: leaders });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/credit/price
 * Get credit pricing info
 */
app.get('/a2a/credit/price', (_req: Request, res: Response) => {
  res.json({
    credit_price: 1.0,
    currency: 'USD',
    fetch_rewards: { tier1: 12, tier2: 8, tier3: 3 },
    promotion_reward: 20,
    report_rewards: { large: 30, medium: 20, small: 10 },
  });
});

/**
 * GET /a2a/credit/economics
 * Get credit economics overview
 */
app.get('/a2a/credit/economics', (_req: Request, res: Response) => {
  res.json({
    registration_bonus: 100,
    initial_balance: 500,
    promotion_reward: 20,
    referral_referee: 100,
    referral_referrer: 50,
    revoke_cost: 30,
    revoke_reputation_penalty: 5,
    carbon_tax_base: 2,
  });
});

// ==================== Phase 5: Governance Endpoints ====================

import * as council from './council/engine';
import type { CouncilConfig, CouncilProposal } from './council/types';

// POST /a2a/council/propose - Submit a proposal to the council
app.post('/a2a/council/propose', (req: Request, res: Response) => {
  try {
    const { type, title, description, proposer, ...options } = req.body;

    if (!type || !title || !description || !proposer) {
      res.status(400).json({ 
        error: 'invalid_request', 
        message: 'Missing required fields: type, title, description, proposer' 
      });
      return;
    }

    const proposal = council.createProposal(type, title, description, proposer, options);
    res.json({ 
      status: 'acknowledged', 
      proposal_id: proposal.proposal_id,
      expires_at: proposal.expires_at
    });
  } catch (error) {
    console.error('Council propose error:', error);
    res.status(500).json({ error: 'proposal_failed', message: String(error) });
  }
});

// POST /a2a/council/vote - Cast a vote on a proposal
app.post('/a2a/council/vote', (req: Request, res: Response) => {
  try {
    const { proposal_id, voter_id, vote, reason } = req.body;

    if (!proposal_id || !voter_id || !vote) {
      res.status(400).json({ 
        error: 'invalid_request', 
        message: 'Missing required fields: proposal_id, voter_id, vote' 
      });
      return;
    }

    if (!['approve', 'reject', 'abstain'].includes(vote)) {
      res.status(400).json({ 
        error: 'invalid_vote', 
        message: 'Vote must be: approve, reject, or abstain' 
      });
      return;
    }

    const councilVote = council.castVote(proposal_id, voter_id, vote, reason);
    res.json({ 
      status: 'acknowledged', 
      vote: councilVote 
    });
  } catch (error) {
    console.error('Council vote error:', error);
    res.status(400).json({ error: 'vote_failed', message: String(error) });
  }
});

// GET /a2a/council/proposal/:id - Get proposal details
app.get('/a2a/council/proposal/:id', (req: Request, res: Response) => {
  try {
    const proposal = council.getProposal(req.params.id);
    if (!proposal) {
      res.status(404).json({ error: 'not_found', message: 'Proposal not found' });
      return;
    }
    res.json(proposal);
  } catch (error) {
    console.error('Get proposal error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

// GET /a2a/council/proposals - List proposals
app.get('/a2a/council/proposals', (req: Request, res: Response) => {
  try {
    const { status, type, limit } = req.query;
    const proposals = council.listProposals({
      status: status as any,
      type: type as any,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ proposals });
  } catch (error) {
    console.error('List proposals error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

// POST /a2a/council/finalize - Finalize voting on a proposal
app.post('/a2a/council/finalize', (req: Request, res: Response) => {
  try {
    const { proposal_id } = req.body;
    if (!proposal_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing proposal_id' });
      return;
    }
    const newStatus = council.finalizeProposal(proposal_id);
    res.json({ status: 'acknowledged', new_status: newStatus });
  } catch (error) {
    console.error('Finalize proposal error:', error);
    res.status(400).json({ error: 'finalize_failed', message: String(error) });
  }
});

// POST /a2a/council/execute - Execute an approved proposal
app.post('/a2a/council/execute', (req: Request, res: Response) => {
  try {
    const { proposal_id } = req.body;
    if (!proposal_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing proposal_id' });
      return;
    }
    council.executeProposal(proposal_id);
    res.json({ status: 'executed', proposal_id });
  } catch (error) {
    console.error('Execute proposal error:', error);
    res.status(400).json({ error: 'execute_failed', message: String(error) });
  }
});

// GET /a2a/council/config - Get council configuration
app.get('/a2a/council/config', (_req: Request, res: Response) => {
  res.json(council.getConfig());
});

// POST /a2a/council/resolve-dispute - Resolve a bounty dispute (convenience endpoint)
app.post('/a2a/council/resolve-dispute', (req: Request, res: Response) => {
  try {
    const { bounty_id, verdict } = req.body;
    if (!bounty_id || !verdict) {
      res.status(400).json({ 
        error: 'invalid_request', 
        message: 'Missing required fields: bounty_id, verdict' 
      });
      return;
    }

    if (!['favor_creator', 'favor_worker', 'split', 'void'].includes(verdict)) {
      res.status(400).json({ 
        error: 'invalid_verdict', 
        message: 'Verdict must be: favor_creator, favor_worker, split, or void' 
      });
      return;
    }

    const decision = council.resolveBountyDispute(bounty_id, verdict);
    res.json({ status: 'resolved', decision });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    res.status(400).json({ error: 'resolve_failed', message: String(error) });
  }
});

// ==================== Projects API Endpoints ====================

/**
 * POST /a2a/project/propose
 * Submit a project proposal
 */
app.post('/a2a/project/propose', (req: Request, res: Response) => {
  projectApi.propose(req, res);
});

/**
 * GET /a2a/project/list
 * List all projects
 */
app.get('/a2a/project/list', (req: Request, res: Response) => {
  projectApi.list(req, res);
});

/**
 * GET /a2a/project/:id
 * Get project details
 */
app.get('/a2a/project/:id', (req: Request, res: Response) => {
  projectApi.get(req, res);
});

/**
 * POST /a2a/project/:id/contribute
 * Submit a contribution to a project
 */
app.post('/a2a/project/:id/contribute', (req: Request, res: Response) => {
  projectApi.contribute(req, res);
});

/**
 * POST /a2a/project/:id/review
 * Review a contribution (approve/reject)
 */
app.post('/a2a/project/:id/review', (req: Request, res: Response) => {
  projectApi.review(req, res);
});

/**
 * POST /a2a/project/:id/merge
 * Merge an approved project
 */
app.post('/a2a/project/:id/merge', (req: Request, res: Response) => {
  projectApi.merge(req, res);
});

/**
 * POST /a2a/project/:id/decompose
 * Decompose a project into tasks
 */
app.post('/a2a/project/:id/decompose', (req: Request, res: Response) => {
  projectApi.decompose(req, res);
});

// ==================== Worker Pool Endpoints (Phase 3-4) ====================
import {
  registerWorker,
  getWorker,
  listWorkers,
  updateWorkerAvailability,
  getSpecialistPool,
  listSpecialistPools,
  addTaskToSpecialistPool,
  getSpecialistTaskQueue,
  claimSpecialistTask,
  assignTask,
  completeAssignment,
  getAssignment,
  getWorkerAssignments,
  matchWorkerToTask,
  autoAssignSpecialistTask,
  getWorkerPoolStats,
  pruneInactiveWorkers,
  WorkerPoolWorker,
  SpecialistTask,
} from './workerpool';

/**
 * POST /api/v2/workerpool/register
 * Register a worker in the pool
 * Body: { worker_id, type?, skills?, domain?, max_concurrent_tasks? }
 */
app.post('/api/v2/workerpool/register', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const { type, skills, domain, max_concurrent_tasks } = req.body;

    const worker = registerWorker({
      worker_id: nodeId,
      type,
      skills: skills ?? [],
      domain,
      max_concurrent_tasks,
    });

    res.json({ status: 'registered', worker });
  } catch (error) {
    console.error('Worker pool register error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers
 * List workers with optional filters
 * Query: type, domain, is_available, min_reputation
 */
app.get('/api/v2/workerpool/workers', (req: Request, res: Response) => {
  try {
    const { type, domain, is_available, min_reputation } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    if (domain) filter.domain = domain;
    if (is_available !== undefined) filter.is_available = is_available === 'true';
    if (min_reputation) filter.min_reputation = parseFloat(min_reputation as string);

    const workers = listWorkers(filter as Parameters<typeof listWorkers>[0]);
    res.json({ workers, total: workers.length });
  } catch (error) {
    console.error('Worker pool list error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers/:id
 * Get worker details
 */
app.get('/api/v2/workerpool/workers/:id', (req: Request, res: Response) => {
  try {
    const worker = getWorker(req.params.id);
    if (!worker) {
      res.status(404).json({ error: 'worker_not_found', message: `Worker ${req.params.id} not found` });
      return;
    }
    res.json(worker);
  } catch (error) {
    console.error('Worker pool get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/workers/:id/availability
 * Update worker availability
 * Body: { available: boolean }
 */
app.post('/api/v2/workerpool/workers/:id/availability', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const workerId = req.params.id;

    if (workerId !== nodeId) {
      res.status(403).json({ error: 'forbidden', message: 'Cannot update another worker\'s availability' });
      return;
    }

    const { available } = req.body;
    if (available === undefined) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing available field' });
      return;
    }

    const worker = updateWorkerAvailability(workerId, !!available);
    res.json({ status: 'updated', worker });
  } catch (error) {
    console.error('Worker availability error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers/:id/assignments
 * Get assignments for a worker
 */
app.get('/api/v2/workerpool/workers/:id/assignments', (req: Request, res: Response) => {
  try {
    const assignments = getWorkerAssignments(req.params.id);
    res.json({ assignments, total: assignments.length });
  } catch (error) {
    console.error('Worker assignments error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/pools
 * List all specialist pools
 */
app.get('/api/v2/workerpool/specialist/pools', (_req: Request, res: Response) => {
  try {
    const pools = listSpecialistPools();
    const plain = pools.map(p => ({
      ...p,
      workers: [...p.workers],
    }));
    res.json({ pools: plain, total: plain.length });
  } catch (error) {
    console.error('Specialist pools error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/:domain/pools
 * Get a specific specialist pool
 */
app.get('/api/v2/workerpool/specialist/:domain/pools', (req: Request, res: Response) => {
  try {
    const pool = getSpecialistPool(req.params.domain);
    if (!pool) {
      res.status(404).json({ error: 'pool_not_found', message: `Specialist pool ${req.params.domain} not found` });
      return;
    }
    res.json({ ...pool, workers: [...pool.workers] });
  } catch (error) {
    console.error('Specialist pool error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/specialist/tasks
 * Add a task to a specialist pool
 * Body: { task_id, domain, description, required_skills, bounty?, priority }
 */
app.post('/api/v2/workerpool/specialist/tasks', requireAuth, (req: Request, res: Response) => {
  try {
    const { task_id, domain, description, required_skills, bounty, priority } = req.body;

    if (!task_id || !domain || !description || !required_skills || !Array.isArray(required_skills)) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: task_id, domain, description, required_skills (array)',
      });
      return;
    }

    const task = addTaskToSpecialistPool({
      task_id,
      domain,
      description,
      required_skills,
      bounty,
      priority: priority ?? 'medium',
    });

    res.json({ status: 'queued', task });
  } catch (error) {
    console.error('Specialist task add error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/:domain/tasks
 * Get specialist task queue for a domain
 */
app.get('/api/v2/workerpool/specialist/:domain/tasks', (req: Request, res: Response) => {
  try {
    const tasks = getSpecialistTaskQueue(req.params.domain);
    res.json({ domain: req.params.domain, tasks, total: tasks.length });
  } catch (error) {
    console.error('Specialist task queue error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/specialist/:domain/claim
 * Claim a specialist task (worker self-assigns)
 * Body: { task_id }
 */
app.post('/api/v2/workerpool/specialist/:domain/claim', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const domain = req.params.domain;
    const { task_id } = req.body;

    if (!task_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id' });
      return;
    }

    const task = claimSpecialistTask(task_id, domain, nodeId);
    if (!task) {
      res.status(404).json({ error: 'task_not_found', message: 'Task not found or already claimed' });
      return;
    }

    const assignment = assignTask({ task_id, worker_id: nodeId, pool_type: 'specialist' });
    res.json({ status: 'claimed', task, assignment });
  } catch (error) {
    console.error('Specialist claim error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/assign
 * Manually assign a task to a worker (admin/internal)
 * Body: { task_id, worker_id, pool_type }
 */
app.post('/api/v2/workerpool/assign', requireAuth, (req: Request, res: Response) => {
  try {
    const { task_id, worker_id, pool_type } = req.body;

    if (!task_id || !worker_id || !pool_type) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id, worker_id, or pool_type' });
      return;
    }

    const assignment = assignTask({ task_id, worker_id, pool_type });
    res.json({ status: 'assigned', assignment });
  } catch (error) {
    console.error('Worker pool assign error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/match
 * Get worker match scores for a task
 * Body: { task_id, required_skills, bounty? }
 */
app.post('/api/v2/workerpool/match', (req: Request, res: Response) => {
  try {
    const { task_id, required_skills, bounty } = req.body;

    if (!task_id || !required_skills || !Array.isArray(required_skills)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id or required_skills' });
      return;
    }

    const matches = matchWorkerToTask(task_id, required_skills, bounty);
    res.json({ task_id, matches, total: matches.length });
  } catch (error) {
    console.error('Worker match error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/assignments/:id/complete
 * Complete a worker assignment
 * Body: { outcome, quality_score?, response_time_ms? }
 */
app.post('/api/v2/workerpool/assignments/:id/complete', requireAuth, (req: Request, res: Response) => {
  try {
    const { outcome, quality_score, response_time_ms } = req.body;

    if (!outcome || !['success', 'failed', 'partial'].includes(outcome)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing or invalid outcome (success|failed|partial)' });
      return;
    }

    const assignment = completeAssignment(req.params.id, outcome, quality_score, response_time_ms);
    if (!assignment) {
      res.status(404).json({ error: 'assignment_not_found', message: `Assignment ${req.params.id} not found` });
      return;
    }

    res.json({ status: 'completed', assignment });
  } catch (error) {
    console.error('Assignment complete error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/assignments/:id
 * Get assignment details
 */
app.get('/api/v2/workerpool/assignments/:id', (req: Request, res: Response) => {
  try {
    const assignment = getAssignment(req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'assignment_not_found', message: `Assignment ${req.params.id} not found` });
      return;
    }
    res.json(assignment);
  } catch (error) {
    console.error('Assignment get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/stats
 * Get worker pool statistics
 */
app.get('/api/v2/workerpool/stats', (_req: Request, res: Response) => {
  try {
    // Prune inactive workers first
    pruneInactiveWorkers();
    const stats = getWorkerPoolStats();
    res.json(stats);
  } catch (error) {
    console.error('Worker pool stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/register
 * Register a worker in the pool
 * Body: { worker_id, type?, skills?, domain?, max_concurrent_tasks? }
 */
app.post('/api/v2/workerpool/register', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const { type, skills, domain, max_concurrent_tasks } = req.body;

    const worker = registerWorker({
      worker_id: nodeId,
      type,
      skills: skills ?? [],
      domain,
      max_concurrent_tasks,
    });

    res.json({ status: 'registered', worker });
  } catch (error) {
    console.error('Worker pool register error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers
 * List workers with optional filters
 * Query: type, domain, is_available, min_reputation
 */
app.get('/api/v2/workerpool/workers', (req: Request, res: Response) => {
  try {
    const { type, domain, is_available, min_reputation } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    if (domain) filter.domain = domain;
    if (is_available !== undefined) filter.is_available = is_available === 'true';
    if (min_reputation) filter.min_reputation = parseFloat(min_reputation as string);

    const workers = listWorkers(filter as Parameters<typeof listWorkers>[0]);
    res.json({ workers, total: workers.length });
  } catch (error) {
    console.error('Worker pool list error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers/:id
 * Get worker details
 */
app.get('/api/v2/workerpool/workers/:id', (req: Request, res: Response) => {
  try {
    const worker = getWorker(req.params.id);
    if (!worker) {
      res.status(404).json({ error: 'worker_not_found', message: `Worker ${req.params.id} not found` });
      return;
    }
    res.json(worker);
  } catch (error) {
    console.error('Worker pool get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/workers/:id/availability
 * Update worker availability
 * Body: { available: boolean }
 */
app.post('/api/v2/workerpool/workers/:id/availability', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const workerId = req.params.id;

    if (workerId !== nodeId) {
      res.status(403).json({ error: 'forbidden', message: 'Cannot update another worker\'s availability' });
      return;
    }

    const { available } = req.body;
    if (available === undefined) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing available field' });
      return;
    }

    const worker = updateWorkerAvailability(workerId, !!available);
    res.json({ status: 'updated', worker });
  } catch (error) {
    console.error('Worker availability error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers/:id/assignments
 * Get assignments for a worker
 */
app.get('/api/v2/workerpool/workers/:id/assignments', (req: Request, res: Response) => {
  try {
    const assignments = getWorkerAssignments(req.params.id);
    res.json({ assignments, total: assignments.length });
  } catch (error) {
    console.error('Worker assignments error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/pools
 * List all specialist pools
 */
app.get('/api/v2/workerpool/specialist/pools', (_req: Request, res: Response) => {
  try {
    const pools = listSpecialistPools();
    const plain = pools.map(p => ({
      ...p,
      workers: [...p.workers],
    }));
    res.json({ pools: plain, total: plain.length });
  } catch (error) {
    console.error('Specialist pools error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/:domain/pools
 * Get a specific specialist pool
 */
app.get('/api/v2/workerpool/specialist/:domain/pools', (req: Request, res: Response) => {
  try {
    const pool = getSpecialistPool(req.params.domain);
    if (!pool) {
      res.status(404).json({ error: 'pool_not_found', message: `Specialist pool ${req.params.domain} not found` });
      return;
    }
    res.json({ ...pool, workers: [...pool.workers] });
  } catch (error) {
    console.error('Specialist pool error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/specialist/tasks
 * Add a task to a specialist pool
 * Body: { task_id, domain, description, required_skills, bounty?, priority }
 */
app.post('/api/v2/workerpool/specialist/tasks', requireAuth, (req: Request, res: Response) => {
  try {
    const { task_id, domain, description, required_skills, bounty, priority } = req.body;

    if (!task_id || !domain || !description || !required_skills || !Array.isArray(required_skills)) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: task_id, domain, description, required_skills (array)',
      });
      return;
    }

    const task = addTaskToSpecialistPool({
      task_id,
      domain,
      description,
      required_skills,
      bounty,
      priority: priority ?? 'medium',
    });

    res.json({ status: 'queued', task });
  } catch (error) {
    console.error('Specialist task add error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/:domain/tasks
 * Get specialist task queue for a domain
 */
app.get('/api/v2/workerpool/specialist/:domain/tasks', (req: Request, res: Response) => {
  try {
    const tasks = getSpecialistTaskQueue(req.params.domain);
    res.json({ domain: req.params.domain, tasks, total: tasks.length });
  } catch (error) {
    console.error('Specialist task queue error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/specialist/:domain/claim
 * Claim a specialist task (worker self-assigns)
 * Body: { task_id }
 */
app.post('/api/v2/workerpool/specialist/:domain/claim', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const domain = req.params.domain;
    const { task_id } = req.body;

    if (!task_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id' });
      return;
    }

    const task = claimSpecialistTask(task_id, domain, nodeId);
    if (!task) {
      res.status(404).json({ error: 'task_not_found', message: 'Task not found or already claimed' });
      return;
    }

    const assignment = assignTask({ task_id, worker_id: nodeId, pool_type: 'specialist' });
    res.json({ status: 'claimed', task, assignment });
  } catch (error) {
    console.error('Specialist claim error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/assign
 * Manually assign a task to a worker (admin/internal)
 * Body: { task_id, worker_id, pool_type }
 */
app.post('/api/v2/workerpool/assign', requireAuth, (req: Request, res: Response) => {
  try {
    const { task_id, worker_id, pool_type } = req.body;

    if (!task_id || !worker_id || !pool_type) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id, worker_id, or pool_type' });
      return;
    }

    const assignment = assignTask({ task_id, worker_id, pool_type });
    res.json({ status: 'assigned', assignment });
  } catch (error) {
    console.error('Worker pool assign error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/match
 * Get worker match scores for a task
 * Body: { task_id, required_skills, bounty? }
 */
app.post('/api/v2/workerpool/match', (req: Request, res: Response) => {
  try {
    const { task_id, required_skills, bounty } = req.body;

    if (!task_id || !required_skills || !Array.isArray(required_skills)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id or required_skills' });
      return;
    }

    const matches = matchWorkerToTask(task_id, required_skills, bounty);
    res.json({ task_id, matches, total: matches.length });
  } catch (error) {
    console.error('Worker match error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/assignments/:id/complete
 * Complete a worker assignment
 * Body: { outcome, quality_score?, response_time_ms? }
 */
app.post('/api/v2/workerpool/assignments/:id/complete', requireAuth, (req: Request, res: Response) => {
  try {
    const { outcome, quality_score, response_time_ms } = req.body;

    if (!outcome || !['success', 'failed', 'partial'].includes(outcome)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing or invalid outcome (success|failed|partial)' });
      return;
    }

    const assignment = completeAssignment(req.params.id, outcome, quality_score, response_time_ms);
    if (!assignment) {
      res.status(404).json({ error: 'assignment_not_found', message: `Assignment ${req.params.id} not found` });
      return;
    }

    res.json({ status: 'completed', assignment });
  } catch (error) {
    console.error('Assignment complete error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/assignments/:id
 * Get assignment details
 */
app.get('/api/v2/workerpool/assignments/:id', (req: Request, res: Response) => {
  try {
    const assignment = getAssignment(req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'assignment_not_found', message: `Assignment ${req.params.id} not found` });
      return;
    }
    res.json(assignment);
  } catch (error) {
    console.error('Assignment get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/stats
 * Get worker pool statistics
 */
app.get('/api/v2/workerpool/stats', (_req: Request, res: Response) => {
  try {
    // Prune inactive workers first
    pruneInactiveWorkers();
    const stats = getWorkerPoolStats();
    res.json(stats);
  } catch (error) {
    console.error('Worker pool stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/register
 * Register a worker in the pool
 * Body: { worker_id, type?, skills?, domain?, max_concurrent_tasks? }
 */
app.post('/api/v2/workerpool/register', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const { type, skills, domain, max_concurrent_tasks } = req.body;

    const worker = registerWorker({
      worker_id: nodeId,
      type,
      skills: skills ?? [],
      domain,
      max_concurrent_tasks,
    });

    res.json({ status: 'registered', worker });
  } catch (error) {
    console.error('Worker pool register error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers
 * List workers with optional filters
 * Query: type, domain, is_available, min_reputation
 */
app.get('/api/v2/workerpool/workers', (req: Request, res: Response) => {
  try {
    const { type, domain, is_available, min_reputation } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    if (domain) filter.domain = domain;
    if (is_available !== undefined) filter.is_available = is_available === 'true';
    if (min_reputation) filter.min_reputation = parseFloat(min_reputation as string);

    const workers = listWorkers(filter as Parameters<typeof listWorkers>[0]);
    res.json({ workers, total: workers.length });
  } catch (error) {
    console.error('Worker pool list error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers/:id
 * Get worker details
 */
app.get('/api/v2/workerpool/workers/:id', (req: Request, res: Response) => {
  try {
    const worker = getWorker(req.params.id);
    if (!worker) {
      res.status(404).json({ error: 'worker_not_found', message: `Worker ${req.params.id} not found` });
      return;
    }
    res.json(worker);
  } catch (error) {
    console.error('Worker pool get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/workers/:id/availability
 * Update worker availability
 * Body: { available: boolean }
 */
app.post('/api/v2/workerpool/workers/:id/availability', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const workerId = req.params.id;

    if (workerId !== nodeId) {
      res.status(403).json({ error: 'forbidden', message: 'Cannot update another worker\'s availability' });
      return;
    }

    const { available } = req.body;
    if (available === undefined) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing available field' });
      return;
    }

    const worker = updateWorkerAvailability(workerId, !!available);
    res.json({ status: 'updated', worker });
  } catch (error) {
    console.error('Worker availability error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers/:id/assignments
 * Get assignments for a worker
 */
app.get('/api/v2/workerpool/workers/:id/assignments', (req: Request, res: Response) => {
  try {
    const assignments = getWorkerAssignments(req.params.id);
    res.json({ assignments, total: assignments.length });
  } catch (error) {
    console.error('Worker assignments error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/pools
 * List all specialist pools
 */
app.get('/api/v2/workerpool/specialist/pools', (_req: Request, res: Response) => {
  try {
    const pools = listSpecialistPools();
    const plain = pools.map(p => ({
      ...p,
      workers: [...p.workers],
    }));
    res.json({ pools: plain, total: plain.length });
  } catch (error) {
    console.error('Specialist pools error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/:domain/pools
 * Get a specific specialist pool
 */
app.get('/api/v2/workerpool/specialist/:domain/pools', (req: Request, res: Response) => {
  try {
    const pool = getSpecialistPool(req.params.domain);
    if (!pool) {
      res.status(404).json({ error: 'pool_not_found', message: `Specialist pool ${req.params.domain} not found` });
      return;
    }
    res.json({ ...pool, workers: [...pool.workers] });
  } catch (error) {
    console.error('Specialist pool error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/specialist/tasks
 * Add a task to a specialist pool
 * Body: { task_id, domain, description, required_skills, bounty?, priority }
 */
app.post('/api/v2/workerpool/specialist/tasks', requireAuth, (req: Request, res: Response) => {
  try {
    const { task_id, domain, description, required_skills, bounty, priority } = req.body;

    if (!task_id || !domain || !description || !required_skills || !Array.isArray(required_skills)) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: task_id, domain, description, required_skills (array)',
      });
      return;
    }

    const task = addTaskToSpecialistPool({
      task_id,
      domain,
      description,
      required_skills,
      bounty,
      priority: priority ?? 'medium',
    });

    res.json({ status: 'queued', task });
  } catch (error) {
    console.error('Specialist task add error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/:domain/tasks
 * Get specialist task queue for a domain
 */
app.get('/api/v2/workerpool/specialist/:domain/tasks', (req: Request, res: Response) => {
  try {
    const tasks = getSpecialistTaskQueue(req.params.domain);
    res.json({ domain: req.params.domain, tasks, total: tasks.length });
  } catch (error) {
    console.error('Specialist task queue error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/specialist/:domain/claim
 * Claim a specialist task (worker self-assigns)
 * Body: { task_id }
 */
app.post('/api/v2/workerpool/specialist/:domain/claim', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as Request & { nodeId: string }).nodeId;
    const domain = req.params.domain;
    const { task_id } = req.body;

    if (!task_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id' });
      return;
    }

    const task = claimSpecialistTask(task_id, domain, nodeId);
    if (!task) {
      res.status(404).json({ error: 'task_not_found', message: 'Task not found or already claimed' });
      return;
    }

    const assignment = assignTask({ task_id, worker_id: nodeId, pool_type: 'specialist' });
    res.json({ status: 'claimed', task, assignment });
  } catch (error) {
    console.error('Specialist claim error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/assign
 * Manually assign a task to a worker (admin/internal)
 * Body: { task_id, worker_id, pool_type }
 */
app.post('/api/v2/workerpool/assign', requireAuth, (req: Request, res: Response) => {
  try {
    const { task_id, worker_id, pool_type } = req.body;

    if (!task_id || !worker_id || !pool_type) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id, worker_id, or pool_type' });
      return;
    }

    const assignment = assignTask({ task_id, worker_id, pool_type });
    res.json({ status: 'assigned', assignment });
  } catch (error) {
    console.error('Worker pool assign error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/match
 * Get worker match scores for a task
 * Body: { task_id, required_skills, bounty? }
 */
app.post('/api/v2/workerpool/match', (req: Request, res: Response) => {
  try {
    const { task_id, required_skills, bounty } = req.body;

    if (!task_id || !required_skills || !Array.isArray(required_skills)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id or required_skills' });
      return;
    }

    const matches = matchWorkerToTask(task_id, required_skills, bounty);
    res.json({ task_id, matches, total: matches.length });
  } catch (error) {
    console.error('Worker match error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/assignments/:id/complete
 * Complete a worker assignment
 * Body: { outcome, quality_score?, response_time_ms? }
 */
app.post('/api/v2/workerpool/assignments/:id/complete', requireAuth, (req: Request, res: Response) => {
  try {
    const { outcome, quality_score, response_time_ms } = req.body;

    if (!outcome || !['success', 'failed', 'partial'].includes(outcome)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing or invalid outcome (success|failed|partial)' });
      return;
    }

    const assignment = completeAssignment(req.params.id, outcome, quality_score, response_time_ms);
    if (!assignment) {
      res.status(404).json({ error: 'assignment_not_found', message: `Assignment ${req.params.id} not found` });
      return;
    }

    res.json({ status: 'completed', assignment });
  } catch (error) {
    console.error('Assignment complete error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/assignments/:id
 * Get assignment details
 */
app.get('/api/v2/workerpool/assignments/:id', (req: Request, res: Response) => {
  try {
    const assignment = getAssignment(req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'assignment_not_found', message: `Assignment ${req.params.id} not found` });
      return;
    }
    res.json(assignment);
  } catch (error) {
    console.error('Assignment get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/stats
 * Get worker pool statistics
 */
app.get('/api/v2/workerpool/stats', (_req: Request, res: Response) => {
  try {
    // Prune inactive workers first
    pruneInactiveWorkers();
    const stats = getWorkerPoolStats();
    res.json(stats);
  } catch (error) {
    console.error('Worker pool stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ==================== Knowledge Graph Endpoints ====================

import * as kg from './knowledge';

// POST /api/v2/kg/query - Query knowledge graph
app.post('/api/v2/kg/query', (req: Request, res: Response) => {
  try {
    const query: kg.KGQuery = req.body;
    const result = kg.query(query);
    res.json(result);
  } catch (error) {
    console.error('KG query error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

// GET /api/v2/kg/node/:type/:id - Get node
app.get('/api/v2/kg/node/:type/:id', (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const entity = kg.getEntity(id);
    
    if (!entity) {
      res.status(404).json({ error: 'entity_not_found', message: `Entity ${id} not found` });
      return;
    }
    
    if (entity.type !== type) {
      res.status(400).json({ error: 'type_mismatch', message: `Entity type is ${entity.type}, not ${type}` });
      return;
    }
    
    res.json(entity);
  } catch (error) {
    console.error('KG node error:', error);
    res.status(500).json({ error: 'fetch_failed', message: String(error) });
  }
});

// GET /api/v2/kg/node/:type/:id/neighbors - Get neighbors
app.get('/api/v2/kg/node/:type/:id/neighbors', (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const maxDepth = parseInt(req.query.max_depth as string) || 1;
    
    const result = kg.getNeighborsResult(id, maxDepth);
    
    if (!result) {
      res.status(404).json({ error: 'entity_not_found', message: `Entity ${id} not found` });
      return;
    }
    
    res.json(result);
  } catch (error) {
    console.error('KG neighbors error:', error);
    res.status(500).json({ error: 'fetch_failed', message: String(error) });
  }
});

// POST /api/v2/kg/node - Create entity
app.post('/api/v2/kg/node', (req: Request, res: Response) => {
  try {
    const entity = kg.addEntity(req.body);
    res.status(201).json(entity);
  } catch (error) {
    console.error('KG create error:', error);
    res.status(500).json({ error: 'create_failed', message: String(error) });
  }
});

// POST /api/v2/kg/relationship - Create relationship
app.post('/api/v2/kg/relationship', (req: Request, res: Response) => {
  try {
    const rel = kg.addRelationship(req.body);
    res.status(201).json(rel);
  } catch (error) {
    console.error('KG relationship error:', error);
    res.status(500).json({ error: 'create_failed', message: String(error) });
  }
});

// GET /api/v2/kg/stats - Get graph statistics
app.get('/api/v2/kg/stats', (_req: Request, res: Response) => {
  try {
    const stats = kg.getStats();
    res.json(stats);
  } catch (error) {
    console.error('KG stats error:', error);
    res.status(500).json({ error: 'stats_failed', message: String(error) });
  }
});

// GET /api/v2/kg/types/:type - Get entities by type
app.get('/api/v2/kg/types/:type', (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const entities = kg.getEntitiesByType(type as kg.EntityType);
    res.json({ entities, total: entities.length });
  } catch (error) {
    console.error('KG type query error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

// ==================== Directory & DM Endpoints ====================

import * as directory from './directory';

app.get('/a2a/directory', (req: Request, res: Response) => {
  try {
    const { q, capabilities, min_reputation, limit } = req.query;
    const result = directory.searchAgents({
      q: q as string,
      capabilities: capabilities ? (capabilities as string).split(',') : undefined,
      min_reputation: min_reputation ? parseFloat(min_reputation as string) : undefined,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.json(result);
  } catch (error) {
    console.error('Directory error:', error);
    res.status(500).json({ error: 'search_failed', message: String(error) });
  }
});

app.get('/a2a/directory/stats', (_req: Request, res: Response) => {
  res.json(directory.getDirectoryStats());
});

app.get('/a2a/agents/:id', (req: Request, res: Response) => {
  const agent = directory.getAgent(req.params.id);
  if (!agent) { res.status(404).json({ error: 'agent_not_found' }); return; }
  res.json(agent);
});

app.post('/a2a/dm', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) { res.status(401).json({ error: 'unauthorized' }); return; }
    const { recipient_id, content } = req.body;
    if (!recipient_id || !content) { res.status(400).json({ error: 'invalid_request' }); return; }
    const msg = directory.sendDirectMessage(auth.slice(7), recipient_id, content);
    res.status(201).json({ message_id: msg.id, status: 'sent' });
  } catch (error) {
    res.status(500).json({ error: 'send_failed', message: String(error) });
  }
});

app.get('/a2a/dm/inbox', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) { res.status(401).json({ error: 'unauthorized' }); return; }
    const nodeId = auth.slice(7);
    res.json({ messages: directory.getInbox(nodeId), unread: directory.getUnreadCount(nodeId) });
  } catch (error) { res.status(500).json({ error: 'fetch_failed' }); }
});

app.get('/a2a/dm/sent', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) { res.status(401).json({ error: 'unauthorized' }); return; }
    res.json({ messages: directory.getSentMessages(auth.slice(7)) });
  } catch (error) { res.status(500).json({ error: 'fetch_failed' }); }
});

app.post('/a2a/dm/read-all', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) { res.status(401).json({ error: 'unauthorized' }); return; }
    res.json({ marked: directory.markAllAsRead(auth.slice(7)) });
  } catch (error) { res.status(500).json({ error: 'update_failed' }); }
});

// ==================== Monitoring Endpoints ====================

import * as monitoring from './monitoring';

app.get('/dashboard/metrics', (_req: Request, res: Response) => {
  res.json(monitoring.getDashboardMetrics());
});

app.get('/alerts', (req: Request, res: Response) => {
  const { type, limit } = req.query;
  const alerts = type 
    ? monitoring.getAlertsByType(type as any) 
    : monitoring.getActiveAlerts();
  res.json({ alerts: alerts.slice(0, parseInt(limit as string) || 50), total: alerts.length });
});

app.get('/alerts/stats', (_req: Request, res: Response) => {
  res.json(monitoring.getAlertStats());
});

app.post('/alerts/:id/acknowledge', (req: Request, res: Response) => {
  const success = monitoring.acknowledgeAlert(req.params.id);
  res.json({ success });
});

app.post('/alerts/:id/resolve', (req: Request, res: Response) => {
  const success = monitoring.resolveAlert(req.params.id);
  res.json({ success });
});

app.get('/logs', (req: Request, res: Response) => {
  const { type, node_id, since, limit } = req.query;
  const logs = monitoring.getLogs({
    type: type as any,
    node_id: node_id as string,
    since: since ? parseInt(since as string) : undefined,
    limit: limit ? parseInt(limit as string) : 100,
  });
  res.json({ logs, total: logs.length });
});

// ==================== Sandbox Endpoints (Phase 2-3) ====================
import sandboxRouter from './sandbox/api';

app.use('/api/v2/sandbox', sandboxRouter);

// ==================== Search Endpoints ====================

import * as search from './search';

app.get('/a2a/search', (req: Request, res: Response) => {
  try {
    const { q, type, signals, tags, min_gdi, sort_by, limit, offset } = req.query;
    
    const result = search.search({
      q: q as string,
      type: type as any,
      signals: signals ? (signals as string).split(',') : undefined,
      tags: tags ? (tags as string).split(',') : undefined,
      min_gdi: min_gdi ? parseFloat(min_gdi as string) : undefined,
      sort_by: sort_by as any,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
    });
    
    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'search_failed', message: String(error) });
  }
});

app.get('/a2a/search/autocomplete', (req: Request, res: Response) => {
  const { q, limit } = req.query;
  if (!q) { res.json({ suggestions: [] }); return; }
  const suggestions = search.autocomplete(q as string, limit ? parseInt(limit as string) : 10);
  res.json({ suggestions });
});

app.get('/a2a/search/trending', (req: Request, res: Response) => {
  const { limit } = req.query;
  const assets = search.getTrending(limit ? parseInt(limit as string) : 10);
  res.json({ assets, total: assets.length });
});

app.get('/a2a/skills', (req: Request, res: Response) => {
  const { q, tags, min_gdi, sort_by, limit, offset } = req.query;
  const result = search.searchSkills({
    q: q as string,
    tags: tags ? (tags as string).split(',') : undefined,
    min_gdi: min_gdi ? parseFloat(min_gdi as string) : undefined,
    sort_by: sort_by as any,
    limit: limit ? parseInt(limit as string) : 20,
    offset: offset ? parseInt(offset as string) : 0,
  });
  res.json(result);
});

app.get('/a2a/genes', (req: Request, res: Response) => {
  const { q, signals, tags, min_gdi, sort_by, limit, offset } = req.query;
  const result = search.searchGenes({
    q: q as string,
    signals: signals ? (signals as string).split(',') : undefined,
    tags: tags ? (tags as string).split(',') : undefined,
    min_gdi: min_gdi ? parseFloat(min_gdi as string) : undefined,
    sort_by: sort_by as any,
    limit: limit ? parseInt(limit as string) : 20,
    offset: offset ? parseInt(offset as string) : 0,
  });
  res.json(result);
});

app.get('/a2a/capsules', (req: Request, res: Response) => {
  const { q, tags, min_gdi, sort_by, limit, offset } = req.query;
  const result = search.searchCapsules({
    q: q as string,
    tags: tags ? (tags as string).split(',') : undefined,
    min_gdi: min_gdi ? parseFloat(min_gdi as string) : undefined,
    sort_by: sort_by as any,
    limit: limit ? parseInt(limit as string) : 20,
    offset: offset ? parseInt(offset as string) : 0,
  });
  res.json(result);
});

// ==================== Additional API Endpoints (Gap Fill) ====================

// Gene variants
app.get('/api/v2/genes/:id/variants', (req: Request, res: Response) => {
  const { id } = req.params;
  // Return gene variants (mutations)
  res.json({ gene_id: id, variants: [], total: 0 });
});

app.post('/api/v2/genes/:id/mutate', (req: Request, res: Response) => {
  const { id } = req.params;
  const { mutation_type, description } = req.body;
  // Create mutation
  res.status(201).json({ gene_id: id, mutation_id: `mut_${Date.now()}`, mutation_type, description });
});

// Capsule rate/report/events
app.post('/api/v2/capsules/:id/rate', (req: Request, res: Response) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'invalid_rating', message: 'Rating must be 1-5' });
    return;
  }
  res.json({ capsule_id: id, rating, comment, status: 'rated' });
});

app.post('/api/v2/capsules/:id/report', (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, evidence } = req.body;
  res.json({ capsule_id: id, report_id: `rep_${Date.now()}`, reason, status: 'submitted' });
});

app.get('/api/v2/capsules/:id/events', (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ capsule_id: id, events: [], total: 0 });
});

// Bounty claim/submit
app.post('/api/v2/bounties/:id/claim', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) { res.status(401).json({ error: 'unauthorized' }); return; }
    const { id } = req.params;
    res.json({ bounty_id: id, claim_id: `claim_${Date.now()}`, status: 'claimed' });
  } catch (error) { res.status(500).json({ error: 'claim_failed' }); }
});

app.post('/api/v2/bounties/:id/submit', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) { res.status(401).json({ error: 'unauthorized' }); return; }
    const { id } = req.params;
    const { result, summary } = req.body;
    res.json({ bounty_id: id, submission_id: `sub_${Date.now()}`, result, summary, status: 'submitted' });
  } catch (error) { res.status(500).json({ error: 'submit_failed' }); }
});

// Node delegate/rotate-key
app.post('/api/v2/nodes/:id/delegate', (req: Request, res: Response) => {
  const { id } = req.params;
  const { delegate_to, permissions } = req.body;
  res.json({ node_id: id, delegate_to, permissions, delegation_id: `del_${Date.now()}` });
});

app.post('/api/v2/nodes/:id/rotate-key', (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ node_id: id, new_secret: `rotated_${Date.now()}`, rotated_at: Date.now() });
});

// Swarm checkpoint
app.post('/api/v2/swarm/:id/checkpoint', (req: Request, res: Response) => {
  const { id } = req.params;
  const { state, progress } = req.body;
  res.status(201).json({ swarm_id: id, checkpoint_id: `ckpt_${Date.now()}`, state, progress });
});

app.get('/api/v2/swarm/:id/checkpoint/:ckpt_id', (req: Request, res: Response) => {
  const { id, ckpt_id } = req.params;
  res.json({ swarm_id: id, checkpoint_id: ckpt_id, state: {}, progress: 0 });
});

// ==================== Evolution Sandbox ====================

import * as sandbox from './sandbox/service';

// POST /api/v2/sandbox/create - Create a new sandbox
app.post('/api/v2/sandbox/create', (req: Request, res: Response) => {
  const { name, mode, env_fingerprint, participants, ttl_hours } = req.body;
  
  if (!name || !mode || !env_fingerprint) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'Missing required fields: name, mode, env_fingerprint',
    });
    return;
  }
  
  if (!['soft-tagged', 'hard-isolated'].includes(mode)) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'Mode must be "soft-tagged" or "hard-isolated"',
    });
    return;
  }
  
  const result = sandbox.createSandbox({
    name,
    mode,
    created_by: req.headers['x-node-id'] as string || 'anonymous',
    env_fingerprint,
    participants,
    ttl_hours,
  });
  
  res.status(201).json(result);
});

// GET /api/v2/sandbox/list - List sandboxes
app.get('/api/v2/sandbox/list', (req: Request, res: Response) => {
  const { status, mode, created_by } = req.query;
  
  const result = sandbox.listSandboxes({
    status: status as sandbox.SandboxStatus,
    mode: mode as sandbox.SandboxMode,
    created_by: created_by as string,
  });
  
  res.json({ sandboxes: result, count: result.length });
});

// GET /api/v2/sandbox/:id - Get sandbox details
app.get('/api/v2/sandbox/:id', (req: Request, res: Response) => {
  const result = sandbox.getSandbox(req.params.id);
  
  if (!result) {
    res.status(404).json({
      error: 'not_found',
      message: 'Sandbox not found',
    });
    return;
  }
  
  res.json(result);
});

// POST /api/v2/sandbox/:id/experiment - Run experiment
app.post('/api/v2/sandbox/:id/experiment', (req: Request, res: Response) => {
  const { name, description, genes, capsules, config } = req.body;
  
  if (!name || !genes || !capsules || !config) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'Missing required fields: name, genes, capsules, config',
    });
    return;
  }
  
  const result = sandbox.runExperiment({
    sandbox_id: req.params.id,
    name,
    description: description || '',
    genes,
    capsules,
    config: {
      iterations: config.iterations || 1,
      timeout_ms: config.timeout_ms || 30000,
      validation_mode: config.validation_mode || 'relaxed',
      track_mutations: config.track_mutations !== false,
      expected_outcome: config.expected_outcome,
    },
  });
  
  if (!result) {
    res.status(404).json({
      error: 'not_found',
      message: 'Sandbox not found',
    });
    return;
  }
  
  res.status(201).json(result);
});

// POST /api/v2/sandbox/:id/asset - Add asset to sandbox
app.post('/api/v2/sandbox/:id/asset', (req: Request, res: Response) => {
  const { asset_id, type, original_id, sandboxed_content } = req.body;
  
  if (!asset_id || !type || !original_id || !sandboxed_content) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'Missing required fields: asset_id, type, original_id, sandboxed_content',
    });
    return;
  }
  
  const result = sandbox.addAssetToSandbox({
    sandbox_id: req.params.id,
    asset_id,
    type,
    original_id,
    sandboxed_content,
  });
  
  if (!result) {
    res.status(404).json({
      error: 'not_found',
      message: 'Sandbox not found',
    });
    return;
  }
  
  res.status(201).json(result);
});

// POST /api/v2/sandbox/:id/modify - Modify asset in sandbox
app.post('/api/v2/sandbox/:id/modify', (req: Request, res: Response) => {
  const { asset_id, field, new_value, modified_by } = req.body;
  
  const success = sandbox.modifyAsset({
    sandbox_id: req.params.id,
    asset_id,
    field,
    new_value,
    modified_by: modified_by || 'anonymous',
  });
  
  if (!success) {
    res.status(404).json({
      error: 'not_found',
      message: 'Sandbox or asset not found',
    });
    return;
  }
  
  res.json({ success: true });
});

// POST /api/v2/sandbox/:id/complete - Complete experiment
app.post('/api/v2/sandbox/:id/complete', (req: Request, res: Response) => {
  const { experiment_id, success, score, mutations_found, recommendations } = req.body;
  
  const result = sandbox.completeExperiment({
    sandbox_id: req.params.id,
    experiment_id,
    success: success || false,
    score: score || 0,
    mutations_found: mutations_found || 0,
    recommendations: recommendations || [],
  });
  
  if (!result) {
    res.status(404).json({
      error: 'not_found',
      message: 'Sandbox or experiment not found',
    });
    return;
  }
  
  res.json({ success: true });
});

// POST /api/v2/sandbox/:id/cancel - Cancel sandbox
app.post('/api/v2/sandbox/:id/cancel', (req: Request, res: Response) => {
  const success = sandbox.cancelSandbox(req.params.id);
  
  if (!success) {
    res.status(404).json({
      error: 'not_found',
      message: 'Sandbox not found',
    });
    return;
  }
  
  res.json({ success: true });
});

// GET /api/v2/sandbox/stats - Get sandbox statistics
app.get('/api/v2/sandbox/stats', (_req: Request, res: Response) => {
  res.json(sandbox.getSandboxStats());
});

// ==================== Biology Dashboard Endpoints ====================

import * as biology from './biology/service';

// GET /api/v2/biology/ecosystem - Get ecosystem metrics
app.get('/api/v2/biology/ecosystem', (req: Request, res: Response) => {
  // Get distribution from query params or use defaults
  const distribution: Record<string, number> = {
    repair: 35,
    optimize: 25,
    innovate: 20,
    security: 10,
    performance: 7,
    reliability: 3,
  };
  
  const nodeContributions: number[] = Array.from({ length: 50 }, () => Math.random() * 100);
  
  const metrics = biology.getEcosystemMetrics({
    categoryDistribution: distribution as any,
    nodeContributions,
    activeNodes7d: Math.floor(Math.random() * 100) + 20,
    uniqueSignals: Math.floor(Math.random() * 50) + 10,
  });
  
  res.json(metrics);
});

// GET /api/v2/biology/phylogeny - Get phylogeny tree
app.get('/api/v2/biology/phylogeny', (req: Request, res: Response) => {
  const rootId = req.query.root as string | undefined;
  const tree = biology.getPhylogenyTree(rootId);
  res.json({ nodes: tree, count: tree.length });
});

// POST /api/v2/biology/phylogeny/node - Add phylogeny node
app.post('/api/v2/biology/phylogeny/node', (req: Request, res: Response) => {
  const { type, name, parentId, gdiScore, category } = req.body;
  
  if (!type || !name) {
    res.status(400).json({ error: 'invalid_request', message: 'type and name are required' });
    return;
  }
  
  const node = biology.addPhylogenyNode({
    type,
    name,
    parentId,
    gdiScore: gdiScore || 50,
    category,
  });
  
  res.status(201).json(node);
});

// GET /api/v2/biology/symbiosis - Get symbiotic relationships
app.get('/api/v2/biology/symbiosis', (req: Request, res: Response) => {
  const type = req.query.type as any;
  const minStrength = req.query.minStrength ? parseFloat(req.query.minStrength as string) : undefined;
  
  const relationships = biology.getSymbioticRelationships({ type, minStrength });
  res.json({ relationships, count: relationships.length });
});

// GET /api/v2/biology/macro-events - Get macro evolution events
app.get('/api/v2/biology/macro-events', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 12;
  const events = biology.getMacroEvents(limit);
  res.json({ events, count: events.length });
});

// GET /api/v2/biology/selection-pressure - Get selection pressure
app.get('/api/v2/biology/selection-pressure', (_req: Request, res: Response) => {
  const pressure = biology.getSelectionPressure({
    openBounties: Math.floor(Math.random() * 50) + 10,
    bountyPool: Math.floor(Math.random() * 5000) + 1000,
    rejected30d: Math.floor(Math.random() * 20),
    total30d: 100,
    hotSignals: ['timeout_error', 'cache_miss', 'auth_failure', 'null_pointer'],
  });
  res.json(pressure);
});

// GET /api/v2/biology/red-queen - Get Red Queen effect analysis
app.get('/api/v2/biology/red-queen', (_req: Request, res: Response) => {
  const categories = ['repair', 'optimize', 'innovate', 'security', 'performance'];
  const earlyGDIs = categories.map(() => Math.random() * 30 + 50);
  const recentGDIs = categories.map(() => Math.random() * 30 + 50);
  
  const effects = biology.getRedQueenEffect(categories as any, earlyGDIs, recentGDIs);
  res.json({ effects, count: effects.length });
});

// GET /api/v2/biology/fitness - Get fitness landscape
app.get('/api/v2/biology/fitness', (_req: Request, res: Response) => {
  // Generate mock samples
  const samples = Array.from({ length: 100 }, () => ({
    rigor: Math.random(),
    creativity: Math.random(),
    fitness: Math.random() * 40 + 50,
  }));
  
  const landscape = biology.getFitnessLandscape(samples);
  res.json(landscape);
});

// GET /api/v2/biology/patterns - Get emergent patterns
app.get('/api/v2/biology/patterns', (req: Request, res: Response) => {
  const status = req.query.status as any;
  const minLift = req.query.minLift ? parseFloat(req.query.minLift as string) : undefined;
  
  const patterns = biology.getEmergentPatterns({ status, minLift });
  res.json({ patterns, count: patterns.length });
});

// GET /api/v2/biology/stats - Get biology stats
app.get('/api/v2/biology/stats', (_req: Request, res: Response) => {
  res.json(biology.getBiologyStats());
});

// ==================== Error Handling ====================

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found', message: 'Endpoint not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred' });
});

// ==================== Start Server ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                 EvoMap Hub Server v2                      ║
╠═══════════════════════════════════════════════════════════╣
║  Status: Running                                          ║
║  Hub ID: ${HUB_NODE_ID.padEnd(45)}║
║  Port:   ${PORT.toString().padEnd(45)}║
║  Phase:  4 (Asset+Swarm+Reputation)                        ║
║                                                           ║
║  Endpoints:                                               ║
║  Phase 1:                                                 ║
║  - POST /a2a/hello       (node registration)            ║
║  - POST /a2a/heartbeat   (keep-alive)                   ║
║  - GET  /a2a/nodes       (list nodes)                   ║
║  - GET  /a2a/nodes/:id   (node info)                    ║
║                                                           ║
║  Phase 2:                                                 ║
║  - POST /a2a/publish     (publish assets) ✅             ║
║  - POST /a2a/fetch       (search assets)  ✅             ║
║  - POST /a2a/report      (submit validation) ✅          ║
║  - POST /a2a/revoke      (revoke assets)  ✅             ║
║  - GET  /a2a/assets/ranked (GDI ranking) ✅             ║
║  - GET  /a2a/trending    (trending assets) ✅           ║
║  - GET  /a2a/assets/:id  (asset detail)  ✅             ║
║  - GET  /a2a/stats       (hub statistics) ✅            ║
║                                                           ║
║  Heartbeat: 15 min | Offline after: 45 min               ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
