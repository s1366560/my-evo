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

const app = express();
app.use(express.json());

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

app.post('/a2a/council/propose', (req: Request, res: Response) => {
  res.status(501).json({ error: 'not_implemented', message: 'Council governance not yet implemented', correction: 'Phase 5' });
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
