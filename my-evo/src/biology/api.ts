/**
 * Biology Dashboard API
 * Hub Evolution Analytics - Ecosystem biology concepts for AI agent networks
 */

import { Router, Request, Response } from 'express';
import {
  GeneCategory,
  getEcosystemMetrics,
  addPhylogenyNode,
  getPhylogenyTree,
  getLineage,
  detectSymbioticRelationship,
  getSymbioticRelationships,
  recordMacroEvent,
  getMacroEvents,
  getSelectionPressure,
  getRedQueenEffect,
  getFitnessLandscape,
  addEmergentPattern,
  getEmergentPatterns,
  getBiologyStats,
} from './service';

const router = Router();

/**
 * GET /biology/stats
 * Overview statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  const stats = getBiologyStats();
  res.json(stats);
});

/**
 * GET /biology/ecosystem
 * Full ecosystem metrics (Shannon index, Simpson, Gini, etc.)
 */
router.get('/ecosystem', (req: Request, res: Response) => {
  const distribution: Record<GeneCategory, number> = {
    repair: 40,
    optimize: 30,
    innovate: 20,
    security: 10,
    performance: 15,
    reliability: 25,
  };
  const nodeContributions = [10, 8, 6, 5, 4, 3, 3, 2, 2, 1];
  const activeNodes7d = nodeContributions.filter(v => v > 0).length;
  const uniqueSignals = 12;

  const metrics = getEcosystemMetrics({
    categoryDistribution: distribution,
    nodeContributions,
    activeNodes7d,
    uniqueSignals,
  });

  res.json(metrics);
});

/**
 * GET /biology/phylogeny
 * Phylogenetic tree of genes/capsules
 */
router.get('/phylogeny', (req: Request, res: Response) => {
  const rootId = req.query.root as string | undefined;
  const tree = getPhylogenyTree(rootId);
  res.json({ nodes: tree });
});

/**
 * POST /biology/phylogeny
 * Add a phylogeny node
 */
router.post('/phylogeny', (req: Request, res: Response) => {
  const { type, name, parentId, gdiScore, category } = req.body;
  if (!type || !name || gdiScore === undefined) {
    res.status(400).json({ error: 'missing required fields: type, name, gdiScore' });
    return;
  }
  const node = addPhylogenyNode({ type, name, parentId, gdiScore, category });
  res.json(node);
});

/**
 * GET /biology/lineage/:nodeId
 * Get evolutionary lineage for a node
 */
router.get('/lineage/:nodeId', (req: Request, res: Response) => {
  const lineage = getLineage(req.params.nodeId);
  res.json({ lineage });
});

/**
 * GET /biology/relationships
 * Symbiotic relationships between nodes
 */
router.get('/relationships', (req: Request, res: Response) => {
  const type = req.query.type as 'mutualism' | 'commensalism' | 'parasitism' | undefined;
  const minStrength = req.query.minStrength ? parseFloat(req.query.minStrength as string) : undefined;
  const rels = getSymbioticRelationships({ type, minStrength });
  res.json({ relationships: rels });
});

/**
 * POST /biology/relationships
 * Detect/record a symbiotic relationship
 */
router.post('/relationships', (req: Request, res: Response) => {
  const { nodeA, nodeB, referencesAToB, referencesBToA } = req.body;
  if (!nodeA || !nodeB || referencesAToB === undefined || referencesBToA === undefined) {
    res.status(400).json({ error: 'missing required fields' });
    return;
  }
  const rel = detectSymbioticRelationship({ nodeA, nodeB, referencesAToB, referencesBToA });
  res.json(rel);
});

/**
 * GET /biology/macro-events
 * Macro evolution events
 */
router.get('/macro-events', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;
  const events = getMacroEvents(limit);
  res.json({ events });
});

/**
 * POST /biology/macro-events
 * Record a macro evolution event
 */
router.post('/macro-events', (req: Request, res: Response) => {
  const { type, magnitude, week, createdCount, revokedCount } = req.body;
  if (!type || magnitude === undefined || !week) {
    res.status(400).json({ error: 'missing required fields' });
    return;
  }
  const event = recordMacroEvent({ type, magnitude, week, createdCount: createdCount || 0, revokedCount: revokedCount || 0 });
  res.json(event);
});

/**
 * GET /biology/selection-pressure
 * Selection pressure metrics
 */
router.get('/selection-pressure', (req: Request, res: Response) => {
  const pressure = getSelectionPressure({
    openBounties: 8,
    bountyPool: 2400,
    rejected30d: 12,
    total30d: 100,
    hotSignals: ['concurrency', 'retry', 'memory'],
  });
  res.json(pressure);
});

/**
 * GET /biology/red-queen
 * Red Queen effect analysis
 */
router.get('/red-queen', (req: Request, res: Response) => {
  const categories: GeneCategory[] = ['repair', 'optimize', 'innovate', 'performance', 'reliability'];
  const earlyGDIs = [62, 65, 58, 60, 63];
  const recentGDIs = [67, 61, 70, 58, 65];
  const effects = getRedQueenEffect(categories, earlyGDIs, recentGDIs);
  res.json({ effects });
});

/**
 * GET /biology/fitness-landscape
 * Fitness landscape grid
 */
router.get('/fitness-landscape', (req: Request, res: Response) => {
  const samples = [
    { rigor: 0.2, creativity: 0.8, fitness: 72 },
    { rigor: 0.5, creativity: 0.5, fitness: 85 },
    { rigor: 0.8, creativity: 0.2, fitness: 78 },
    { rigor: 0.3, creativity: 0.7, fitness: 68 },
    { rigor: 0.6, creativity: 0.6, fitness: 90 },
    { rigor: 0.9, creativity: 0.1, fitness: 65 },
    { rigor: 0.1, creativity: 0.9, fitness: 55 },
  ];
  const landscape = getFitnessLandscape(samples);
  res.json(landscape);
});

/**
 * GET /biology/emergent-patterns
 * Emergent patterns
 */
router.get('/emergent-patterns', (req: Request, res: Response) => {
  const status = req.query.status as 'detected' | 'confirmed' | 'dismissed' | undefined;
  const minLift = req.query.minLift ? parseFloat(req.query.minLift as string) : undefined;
  const patterns = getEmergentPatterns({ status, minLift });
  res.json({ patterns });
});

/**
 * POST /biology/emergent-patterns
 * Add an emergent pattern
 */
router.post('/emergent-patterns', (req: Request, res: Response) => {
  const { signalCluster, successRate, baselineRate, environmentConditions } = req.body;
  if (!signalCluster || successRate === undefined || baselineRate === undefined) {
    res.status(400).json({ error: 'missing required fields' });
    return;
  }
  const pattern = addEmergentPattern({
    signalCluster,
    successRate,
    baselineRate,
    environmentConditions: environmentConditions || [],
  });
  res.json(pattern);
});

export default router;
