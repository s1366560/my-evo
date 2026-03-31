import { Router } from 'express';
import type { Request, Response } from 'express';
import { publishAsset, submitValidationReport, revokeAsset } from './publish';
import {
  fetchAssets,
  getTrendingAssets,
  getRankedAssets,
  getAssetDetails,
  getCategories,
  getPopularSignals,
  exploreAssets,
  getDailyDiscovery,
  getRelatedAssets,
  getRecommendedAssets,
  voteAsset,
  getValidationReports,
  getEvolutionEvents,
} from './fetch';
import { listReviews, createReview, updateReview, deleteReview, getReviewSummary } from './reviews';
import { handleGetAuditTrail, handleGetBranches, handleGetTimeline, handleMyUsage, handleSelfRevoke, handleForkAsset } from './history';
import type { FetchQuery } from './types';
import { getLineage, getLineageChain, getDescendantChain, getLineageMetadata, getLineageTreeSize, haveCommonAncestor, getRootAncestor } from './lineage';
import {
  getConfidenceRecord,
  getAssetConfidence,
  recordPositiveVerification,
  recordNegativeVerification,
  getBatchConfidence,
  filterByMinGrade,
  getConfidenceStats,
  gradeAllowedOps,
  CONFIDENCE_PARAMS,
} from './confidence';
import type { ConfidenceGrade } from './confidence';
import { getAsset, listAssets, getAssetStats } from './store';
import { HUB_NODE_ID } from '../a2a/node';
import { requireAuth } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import * as kg from '../knowledge';

const router = Router();

router.post('/publish', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'unauthorized', message: 'Missing Authorization header' });
      return;
    }

    const bundle = req.body;

    if (!bundle.assets || !Array.isArray(bundle.assets)) {
      res.status(400).json({ error: 'invalid_request', message: 'Request must include assets array' });
      return;
    }

    const token = authHeader.slice(7);
    const result = publishAsset(bundle, nodeId, token);
    res.json(result);
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/fetch', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const query: FetchQuery = req.body;
    const result = fetchAssets(query, nodeId);
    res.json(result);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/report', requireAuth, (req: Request, res: Response) => {
  try {
    const { asset_id, outcome } = req.body;

    if (!asset_id || !outcome) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing asset_id or outcome' });
      return;
    }

    const result = submitValidationReport(asset_id, outcome);

    if (result.accepted) {
      res.json({ status: 'accepted', asset_id });
      return;
    }

    res.status(422).json({ status: 'rejected', reason: result.reason });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/revoke', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { asset_id, reason } = req.body;

    if (!asset_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing asset_id' });
      return;
    }

    const result = revokeAsset(asset_id, nodeId, reason);

    if (result.success) {
      res.json({ status: 'revoked', asset_id });
      return;
    }

    res.status(403).json({ error: 'forbidden', message: result.error });
  } catch (error) {
    console.error('Revoke error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/ranked', (req: Request, res: Response) => {
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

router.get('/trending', (req: Request, res: Response) => {
  try {
    const { type, period, limit } = req.query as Record<string, string>;
    const assets = getTrendingAssets({
      type,
      period: period as 'day' | 'week' | 'month' | 'all' | undefined,
      limit: limit ? parseInt(limit) : 10,
    });
    res.json({ assets, total: assets.length });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/:id', (req: Request, res: Response) => {
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

router.get('/assets/graph-search', (req: Request, res: Response) => {
  try {
    const { type, relation, seed_id, depth, limit } = req.query as Record<string, string>;
    const maxDepth = Math.min(parseInt(depth) || 1, 3);
    const maxLimit = Math.min(parseInt(limit) || 20, 100);

    if (seed_id) {
      const result = kg.getNeighborsResult(seed_id, maxDepth);
      if (!result) {
        res.status(404).json({ error: 'not_found', message: 'Seed entity not found in knowledge graph' });
        return;
      }

      let neighbors = result.neighbors;
      if (type) {
        neighbors = neighbors.filter((neighbor) => neighbor.entity.type === type);
      }
      if (relation) {
        neighbors = neighbors.filter((neighbor) => neighbor.relationship.type === relation);
      }

      res.json({
        seed: result.node,
        neighbors: neighbors.slice(0, maxLimit).map((neighbor) => ({
          entity: neighbor.entity,
          relationship: neighbor.relationship.type,
          depth: neighbor.depth,
        })),
        total: neighbors.length,
      });
      return;
    }

    const filters: NonNullable<kg.KGQuery['filters']> = {};
    if (type) filters.types = [type as kg.EntityType];
    if (relation) filters.relation_types = [relation as kg.RelationshipType];

    const result = kg.query({ filters, limit: maxLimit });
    res.json({
      entities: result.entities,
      relationships: result.relationships,
      total: result.total,
      query_time_ms: result.query_time_ms,
    });
  } catch (error) {
    console.error('Graph search error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/categories', (_req: Request, res: Response) => {
  try {
    const categories = getCategories();
    res.json({ categories, total: categories.length });
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/explore', (req: Request, res: Response) => {
  try {
    const { type, category, status, query, limit, offset } = req.query as Record<string, string>;
    const result = exploreAssets({
      type,
      category,
      status,
      query,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    });
    res.json(result);
  } catch (error) {
    console.error('Explore error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/daily-discovery', (req: Request, res: Response) => {
  try {
    const { limit } = req.query as Record<string, string>;
    const assets = getDailyDiscovery({ limit: limit ? parseInt(limit) : 10 });
    res.json({ assets, total: assets.length });
  } catch (error) {
    console.error('Daily discovery error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/recommended', requireAuth, (req: Request, res: Response) => {
  try {
    const { limit } = req.query as Record<string, string>;
    const nodeId = (req as AuthRequest).nodeId;
    const assets = getRecommendedAssets(nodeId, { limit: limit ? parseInt(limit) : 10 });
    res.json({ assets, total: assets.length });
  } catch (error) {
    console.error('Recommended error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/:id/related', (req: Request, res: Response) => {
  try {
    const { limit } = req.query as Record<string, string>;
    const assets = getRelatedAssets(req.params.id, { limit: limit ? parseInt(limit) : 5 });
    res.json({ assets, total: assets.length });
  } catch (error) {
    console.error('Related assets error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/assets/:id/vote', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { direction } = req.body;
    if (!direction || !['up', 'down'].includes(direction)) {
      res.status(400).json({ error: 'invalid_direction', message: 'direction must be up or down' });
      return;
    }

    const result = voteAsset(req.params.id, nodeId, direction);
    res.json(result);
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/:id/reviews', (req: Request, res: Response) => {
  try {
    const reviews = listReviews(req.params.id);
    const summary = getReviewSummary(req.params.id);
    res.json({ reviews, summary });
  } catch (error) {
    console.error('List reviews error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/assets/:id/reviews', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { rating, title, body, vote, use_case } = req.body;
    if (!rating || !vote) {
      res.status(400).json({ error: 'invalid_request', message: 'rating and vote are required' });
      return;
    }

    const review = createReview({ assetId: req.params.id, reviewerId: nodeId, rating, title, body, vote, use_case });
    res.status(201).json({ review });
  } catch (error: unknown) {
    console.error('Create review error:', error);
    const status = error instanceof Error && 'status' in error ? Number((error as Error & { status?: number }).status) || 500 : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(status).json({ error: 'create_review_failed', message });
  }
});

router.put('/assets/:id/reviews/:reviewId', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { rating, title, body, vote, use_case } = req.body;
    const review = updateReview({
      assetId: req.params.id,
      reviewId: req.params.reviewId,
      reviewerId: nodeId,
      rating,
      title,
      body,
      vote,
      use_case,
    });

    res.json({ review });
  } catch (error: unknown) {
    console.error('Update review error:', error);
    const status = error instanceof Error && 'status' in error ? Number((error as Error & { status?: number }).status) || 500 : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(status).json({ error: 'update_review_failed', message });
  }
});

router.delete('/assets/:id/reviews/:reviewId', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    deleteReview({ assetId: req.params.id, reviewId: req.params.reviewId, reviewerId: nodeId });
    res.json({ status: 'ok' });
  } catch (error: unknown) {
    console.error('Delete review error:', error);
    const status = error instanceof Error && 'status' in error ? Number((error as Error & { status?: number }).status) || 500 : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(status).json({ error: 'delete_review_failed', message });
  }
});

router.get('/assets/:id/audit-trail', (req: Request, res: Response) => {
  try {
    handleGetAuditTrail(req, res);
  } catch (error) {
    console.error('Audit trail error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/:id/branches', (req: Request, res: Response) => {
  try {
    handleGetBranches(req, res);
  } catch (error) {
    console.error('Branches error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/:id/timeline', (req: Request, res: Response) => {
  try {
    handleGetTimeline(req, res);
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/assets/my-usage', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    handleMyUsage(nodeId, res);
  } catch (error) {
    console.error('My usage error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/asset/self-revoke', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    handleSelfRevoke(nodeId, req.body, res);
  } catch (error) {
    console.error('Self-revoke error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/assets/:id/fork', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const reason = (req.body as { reason?: string }).reason ?? 'manual_fork';
    handleForkAsset(nodeId, req.params.id, reason, res);
  } catch (error) {
    console.error('Fork asset error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/signals/popular', (req: Request, res: Response) => {
  try {
    const { type, limit } = req.query as Record<string, string>;
    const signals = getPopularSignals({ type, limit: limit ? parseInt(limit) : 20 });
    res.json({ signals, total: signals.length });
  } catch (error) {
    console.error('Popular signals error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/validation-reports', (req: Request, res: Response) => {
  try {
    const { assetId, limit } = req.query as Record<string, string>;
    const reports = getValidationReports({ assetId, limit: limit ? parseInt(limit) : 50 });
    res.json({ reports, total: reports.length });
  } catch (error) {
    console.error('Validation reports error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/evolution-events', (req: Request, res: Response) => {
  try {
    const { limit } = req.query as Record<string, string>;
    const events = getEvolutionEvents({ limit: limit ? parseInt(limit) : 50 });
    res.json({ events, total: events.length });
  } catch (error) {
    console.error('Evolution events error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getAssetStats();
    res.json({ hub_id: HUB_NODE_ID, ...stats });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/confidence/params', (_req: Request, res: Response) => {
  res.json({ parameters: CONFIDENCE_PARAMS });
});

router.get('/confidence/stats', (_req: Request, res: Response) => {
  try {
    const stats = getConfidenceStats();
    res.json({ hub_id: HUB_NODE_ID, ...stats });
  } catch (error) {
    console.error('Confidence stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/confidence/:assetId', (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const record = getAsset(assetId);
    if (!record) {
      res.status(404).json({ error: 'not_found', message: 'Asset not found' });
      return;
    }

    const score = getAssetConfidence(assetId, record.gdi?.total ?? 50, record.published_at);
    const tracked = getConfidenceRecord(assetId) !== undefined;

    res.json({
      asset_id: assetId,
      ...score,
      allowed_ops: gradeAllowedOps(score.grade),
      tracked,
    });
  } catch (error) {
    console.error('Confidence error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/confidence/:assetId/verify', requireAuth, (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const { result } = req.body as { result?: string };

    const record = getAsset(assetId);
    if (!record) {
      res.status(404).json({ error: 'not_found', message: 'Asset not found' });
      return;
    }

    if (result === 'positive') {
      recordPositiveVerification(assetId);
    } else if (result === 'negative') {
      recordNegativeVerification(assetId);
    } else {
      res.status(400).json({ error: 'invalid_request', message: 'result must be "positive" or "negative"' });
      return;
    }

    const confidence = getAssetConfidence(assetId, record.gdi?.total ?? 50, record.published_at);

    res.json({
      asset_id: assetId,
      verification_recorded: result,
      ...confidence,
      allowed_ops: gradeAllowedOps(confidence.grade),
    });
  } catch (error) {
    console.error('Confidence verify error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/confidence', (req: Request, res: Response) => {
  try {
    const minGrade = req.query.min_grade as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    let assets = listAssets({ status: 'active' });
    assets = assets.slice(offset, offset + limit);
    if (minGrade) {
      assets = filterByMinGrade(assets, minGrade as ConfidenceGrade);
    }

    const scores = getBatchConfidence(assets);

    res.json({
      hub_id: HUB_NODE_ID,
      count: scores.length,
      confidence_scores: scores,
    });
  } catch (error) {
    console.error('Confidence list error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/lineage/:assetId', (req: Request, res: Response) => {
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

router.get('/lineage/:assetId/chain', (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const maxDepth = parseInt(req.query.max_depth as string) || 10;
    const chain = getLineageChain(assetId, maxDepth);
    const resolvedChain = chain.chain.map(ref => {
      const record = getAsset(ref.asset_id);
      return {
        asset_id: ref.asset_id,
        type: record?.asset.type ?? 'unknown',
        id: record?.asset.id ?? ref.asset_id,
        status: record?.status ?? 'unknown',
      };
    });

    res.json({ asset_id: assetId, chain: resolvedChain, depth: chain.depth });
  } catch (error) {
    console.error('Lineage chain error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/lineage/:assetId/descendants', (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const maxDepth = parseInt(req.query.max_depth as string) || 10;
    const chain = getDescendantChain(assetId, maxDepth);
    const resolvedChain = chain.chain.map(ref => {
      const record = getAsset(ref.asset_id);
      return {
        asset_id: ref.asset_id,
        type: record?.asset.type ?? 'unknown',
        id: record?.asset.id ?? ref.asset_id,
        status: record?.status ?? 'unknown',
      };
    });

    res.json({ asset_id: assetId, descendants: resolvedChain, depth: chain.depth });
  } catch (error) {
    console.error('Lineage descendants error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/lineage/:assetId/tree-size', (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const size = getLineageTreeSize(assetId);
    const root = getRootAncestor(assetId);
    res.json({ asset_id: assetId, root_ancestor: root, tree_size: size });
  } catch (error) {
    console.error('Lineage tree-size error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/lineage/:assetId/metadata', (req: Request, res: Response) => {
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

router.get('/lineage/:assetId/common-ancestor/:otherAssetId', (req: Request, res: Response) => {
  try {
    const { assetId, otherAssetId } = req.params;
    const hasCommon = haveCommonAncestor(assetId, otherAssetId);
    const commonRoot = hasCommon ? getRootAncestor(assetId) : undefined;

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

export default router;
