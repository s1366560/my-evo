/**
 * Memory Graph API Routes - Chapter 30
 * Express routes for memory graph operations
 */

import { Router, Request, Response } from 'express';
import {
  addNode,
  addEdge,
  buildLineageEdges,
  constructChain,
  getChain,
  recall,
  recordPositiveVerification,
  recordNegativeVerification,
  applyDecay,
  getConfidence,
  getConfidenceStats,
  checkBanThresholds,
  exportGraph,
  importGraph,
  getGraphStats,
} from './service';

export const memoryGraphApi = Router();

// ==================== Graph Operations ====================

/**
 * POST /api/v2/memory/graph/node
 * Add a node to the memory graph
 */
memoryGraphApi.post('/node', (req: Request, res: Response) => {
  const { asset_id, type, signals, confidence, gdi, metadata } = req.body;

  if (!asset_id || !type || !signals || confidence === undefined) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'asset_id, type, signals, and confidence are required',
    });
    return;
  }

  if (!['Gene', 'Capsule', 'EvolutionEvent'].includes(type)) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'type must be Gene, Capsule, or EvolutionEvent',
    });
    return;
  }

  const node = addNode(asset_id, type, signals, confidence, gdi, metadata);
  res.status(201).json({ node });
});

/**
 * POST /api/v2/memory/graph/edge
 * Add an edge between two nodes
 */
memoryGraphApi.post('/edge', (req: Request, res: Response) => {
  const { from, to, relation, weight } = req.body;

  if (!from || !to || !relation) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'from, to, and relation are required',
    });
    return;
  }

  const validRelations = ['produced', 'triggered', 'references', 'evolves_from', 'derived_from', 'bundled_with'];
  if (!validRelations.includes(relation)) {
    res.status(400).json({
      error: 'invalid_request',
      message: `relation must be one of: ${validRelations.join(', ')}`,
    });
    return;
  }

  const edge = addEdge(from, to, relation, weight || 0.8);
  if (!edge) {
    res.status(404).json({ error: 'not_found', message: 'Source or target node not found' });
    return;
  }

  res.status(201).json({ edge });
});

/**
 * POST /api/v2/memory/graph/lineage
 * Build lineage edges for Gene → Capsule → EvolutionEvent chain
 */
memoryGraphApi.post('/lineage', (req: Request, res: Response) => {
  const { gene_id, capsule_id, event_id } = req.body;

  if (!gene_id || !capsule_id) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'gene_id and capsule_id are required',
    });
    return;
  }

  buildLineageEdges(gene_id, capsule_id, event_id);
  res.json({ success: true, gene_id, capsule_id, event_id });
});

/**
 * GET /api/v2/memory/graph/stats
 * Get memory graph statistics
 */
memoryGraphApi.get('/stats', (_req: Request, res: Response) => {
  res.json(getGraphStats());
});

// ==================== Capability Chains ====================

/**
 * POST /api/v2/memory/chain/construct
 * Construct a capability chain from a root asset
 */
memoryGraphApi.post('/chain/construct', (req: Request, res: Response) => {
  const { root_asset_id, chain_id } = req.body;

  if (!root_asset_id) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'root_asset_id is required',
    });
    return;
  }

  const chain = constructChain(root_asset_id, chain_id);
  if (!chain) {
    res.status(404).json({ error: 'not_found', message: 'Root asset not found in graph' });
    return;
  }

  res.status(201).json({ chain });
});

/**
 * GET /api/v2/memory/chain/:chainId
 * Get a capability chain by ID
 */
memoryGraphApi.get('/chain/:chainId', (req: Request, res: Response) => {
  const chain = getChain(req.params.chainId);
  if (!chain) {
    res.status(404).json({ error: 'not_found', message: 'Chain not found' });
    return;
  }
  res.json({ chain });
});

// ==================== Semantic Recall ====================

/**
 * POST /api/v2/memory/recall
 * Recall matching assets from the memory graph based on signals
 */
memoryGraphApi.post('/recall', (req: Request, res: Response) => {
  const { signals, min_confidence, min_gdi, limit, chain_id, node_type, decay_window_days } = req.body;

  if (!signals || !Array.isArray(signals) || signals.length === 0) {
    res.status(400).json({
      error: 'invalid_request',
      message: 'signals (array) is required',
    });
    return;
  }

  const results = recall({
    signals,
    min_confidence,
    min_gdi,
    limit,
    chain_id,
    node_type,
    decay_window_days,
  });

  res.json({
    results,
    count: results.length,
    query: signals,
  });
});

// ==================== Confidence Management ====================

/**
 * POST /api/v2/memory/confidence/:assetId/positive
 * Record a positive verification event
 */
memoryGraphApi.post('/confidence/:assetId/positive', (req: Request, res: Response) => {
  const record = recordPositiveVerification(req.params.assetId);
  if (!record) {
    res.status(404).json({ error: 'not_found', message: 'Asset not found' });
    return;
  }
  res.json({ confidence: record });
});

/**
 * POST /api/v2/memory/confidence/:assetId/negative
 * Record a negative verification event
 */
memoryGraphApi.post('/confidence/:assetId/negative', (req: Request, res: Response) => {
  const record = recordNegativeVerification(req.params.assetId);
  if (!record) {
    res.status(404).json({ error: 'not_found', message: 'Asset not found' });
    return;
  }
  res.json({ confidence: record });
});

/**
 * GET /api/v2/memory/confidence/:assetId
 * Get confidence record for an asset
 */
memoryGraphApi.get('/confidence/:assetId', (req: Request, res: Response) => {
  const record = getConfidence(req.params.assetId);
  if (!record) {
    res.status(404).json({ error: 'not_found', message: 'Confidence record not found' });
    return;
  }
  res.json({ confidence: record });
});

/**
 * GET /api/v2/memory/confidence/stats
 * Get confidence statistics across all assets
 */
memoryGraphApi.get('/confidence/stats', (_req: Request, res: Response) => {
  res.json(getConfidenceStats());
});

/**
 * POST /api/v2/memory/decay
 * Trigger time-based confidence decay across all assets
 */
memoryGraphApi.post('/decay', (req: Request, res: Response) => {
  const { lambda, half_life_days, positive_boost, negative_penalty } = req.body;

  const params = {
    lambda: lambda || 0.015,
    half_life_days: half_life_days || 30,
    positive_boost: positive_boost || 0.05,
    negative_penalty: negative_penalty || 0.15,
  };

  applyDecay(params);
  res.json({ success: true, params });
});

// ==================== Ban Thresholds ====================

/**
 * GET /api/v2/memory/ban-check
 * Check assets against ban thresholds
 */
memoryGraphApi.get('/ban-check', (_req: Request, res: Response) => {
  const result = checkBanThresholds();
  res.json({
    ...result,
    summary: {
      below_confidence_min: result.below_confidence_min.length,
      below_gdi_min: result.below_gdi_min.length,
      quarantine_ready: result.quarantine_ready.length,
    },
  });
});

// ==================== Export / Import (for .gepx) ====================

/**
 * GET /api/v2/memory/export
 * Export the full memory graph (used by .gepx format)
 */
memoryGraphApi.get('/export', (_req: Request, res: Response) => {
  const data = exportGraph();
  res.json({
    type: 'MemoryGraph',
    version: '1.0',
    exported_at: new Date().toISOString(),
    ...data,
  });
});

/**
 * POST /api/v2/memory/import
 * Import a memory graph (used by .gepx format)
 */
memoryGraphApi.post('/import', (req: Request, res: Response) => {
  const { nodes, edges, chains, confidence } = req.body;

  const result = importGraph({ nodes, edges, chains, confidence });
  res.json({
    success: true,
    imported: result.imported,
    conflicts: result.conflicts,
  });
});
