/**
 * Verifiable Trust API Endpoints
 * Chapter 34: Validator Staking & Trust Levels
 */

import { Router } from 'express';
import { validateNodeSecret } from '../a2a/node';
import {
  stakeForTrust,
  releaseStake,
  verifyNode,
  getTrustLevel,
  getTrustStats,
  listAttestations,
  getPendingRewards,
  claimPendingRewards,
} from './engine';
import { TRUST_STAKE_AMOUNT } from './types';

const router = Router();

function requireTrustAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing Authorization header' });
  }
  const nodeId = validateNodeSecret(auth.slice(7));
  if (!nodeId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
  }
  req.nodeId = nodeId;
  next();
}

// GET /trust/stats
router.get('/stats', requireTrustAuth, (req: any, res: any) => {
  const stats = getTrustStats(req.nodeId);
  res.json({ stats });
});

// GET /trust/level/:nodeId
router.get('/level/:nodeId', (req: any, res: any) => {
  const level = getTrustLevel(req.params.nodeId);
  res.json({ node_id: req.params.nodeId, trust_level: level });
});

// GET /trust/attestations
router.get('/attestations', requireTrustAuth, (req: any, res: any) => {
  const attestations = listAttestations(req.nodeId);
  res.json({ attestations, total: attestations.length });
});

// GET /trust/pending
router.get('/pending', requireTrustAuth, (req: any, res: any) => {
  const pending = getPendingRewards(req.nodeId);
  res.json({ node_id: req.nodeId, pending_rewards: pending });
});

// POST /trust/stake
router.post('/stake', requireTrustAuth, (req: any, res: any) => {
  const { amount = TRUST_STAKE_AMOUNT } = req.body;
  
  if (typeof amount !== 'number' || amount < TRUST_STAKE_AMOUNT) {
    return res.status(400).json({ error: 'invalid_request', message: `Minimum stake is ${TRUST_STAKE_AMOUNT} credits` });
  }
  
  const result = stakeForTrust(req.nodeId, amount);
  
  if (!result.success) {
    return res.status(400).json({ error: 'stake_failed', message: result.message });
  }
  
  res.json({ status: 'staked', stake: result.stake, message: result.message });
});

// POST /trust/release
router.post('/release', requireTrustAuth, (req: any, res: any) => {
  const result = releaseStake(req.nodeId);
  
  if (!result.success) {
    return res.status(400).json({ error: 'release_failed', message: result.message });
  }
  
  res.json({ status: 'released', released_amount: result.released_amount, message: result.message });
});

// POST /trust/claim
router.post('/claim', requireTrustAuth, (req: any, res: any) => {
  const result = claimPendingRewards(req.nodeId);
  
  if (!result.success) {
    return res.status(400).json({ error: 'claim_failed', message: 'No pending rewards to claim' });
  }
  
  res.json({ status: 'claimed', amount: result.amount, message: `Claimed ${result.amount} credits` });
});

// POST /trust/verify
router.post('/verify', requireTrustAuth, (req: any, res: any) => {
  const { target_node_id, trust_level } = req.body;
  
  if (!target_node_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing target_node_id' });
  }
  
  if (!['unverified', 'verified', 'trusted'].includes(trust_level)) {
    return res.status(400).json({ error: 'invalid_request', message: 'Invalid trust_level' });
  }
  
  const result = verifyNode(req.nodeId, target_node_id, trust_level);
  
  if (!result.success) {
    return res.status(403).json({ error: 'verification_failed', message: result.message });
  }
  
  res.json({ status: 'verified', ...result });
});

export default router;
