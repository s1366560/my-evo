import { Router, Request, Response } from 'express';
import { syncFetch, syncPublish, syncClaim, syncCheck, getSyncState, getGlobalSyncStats } from './engine';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /a2a/sync/fetch
 * STEP 1: Pull new/updated/revoked assets since last sync
 */
router.post('/fetch', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { last_sync } = req.body;
    const result = syncFetch(nodeId, last_sync);
    res.json(result);
  } catch (error) {
    console.error('Sync fetch error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/sync/publish
 * STEP 2: Push pending local assets to Hub
 */
router.post('/publish', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { assets } = req.body;

    if (!assets || !Array.isArray(assets)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing assets array' });
      return;
    }

    const result = syncPublish(nodeId, assets);
    res.json(result);
  } catch (error) {
    console.error('Sync publish error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/sync/claim
 * STEP 3: Claim assigned tasks during sync cycle
 */
router.post('/claim', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { capacity, skills } = req.body;
    const result = syncClaim(nodeId, capacity ?? 5, skills);
    res.json(result);
  } catch (error) {
    console.error('Sync claim error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/sync/check
 * STEP 4: Reputation check and submit pending validation reports
 */
router.post('/check', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { pending_reports } = req.body;
    const result = syncCheck(nodeId, pending_reports ?? []);
    res.json(result);
  } catch (error) {
    console.error('Sync check error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/sync/state
 * Get sync state for current node
 */
router.get('/state', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const state = getSyncState(nodeId);

    if (!state) {
      res.status(404).json({ error: 'not_found', message: 'No sync state found for this node' });
      return;
    }

    res.json(state);
  } catch (error) {
    console.error('Sync state error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/sync/stats
 * Get global sync statistics (Hub only)
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getGlobalSyncStats();
    res.json(stats);
  } catch (error) {
    console.error('Sync stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
