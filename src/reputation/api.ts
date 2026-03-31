import { Router, Request, Response } from 'express';
import {
  calculateReputation, getReputation, calculateTier,
  getCreditBalance, initializeCreditBalance,
  getReputationLeaderboard,
} from './engine';

const router = Router();

/**
 * GET /a2a/reputation/leaderboard
 * Must be defined before /:nodeId to avoid param capture
 */
router.get('/leaderboard', (req: Request, res: Response) => {
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
 * GET /a2a/reputation/:nodeId
 */
router.get('/:nodeId', (req: Request, res: Response) => {
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
 */
router.get('/:nodeId/credits', (req: Request, res: Response) => {
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

export default router;
