/**
 * Arena API Endpoints
 * Phase 6+: Arena Battle System
 * 
 * Endpoints:
 * - POST /arena/matchmaking  Join matchmaking queue
 * - DELETE /arena/matchmaking  Leave matchmaking queue
 * - GET /arena/matchmaking/status  Check matchmaking status
 * - POST /arena/battles  Create battle (direct challenge)
 * - GET /arena/battles  List battles
 * - GET /arena/battles/:id  Battle details
 * - POST /arena/battles/:id/submit  Submit battle result
 * - GET /arena/leaderboard  Arena leaderboard
 * - GET /arena/leaderboard/:nodeId  Node arena stats
 * - GET /arena/seasons/current  Current season
 * - GET /arena/competitors/:assetId  Find competing assets by signal overlap
 */

import { Router } from 'express';
import { validateNodeSecret } from '../a2a/node';
import {
  joinMatchmaking,
  leaveMatchmaking,
  getMatchmakingStatus,
  createBattle,
  getBattle,
  submitBattleResult,
  listBattles,
  getLeaderboard,
  getNodeArenaStats,
  getOrCreateActiveSeason,
  getTopicSaturation,
  listSeasons,
  getTopicSaturationSummary,
  getActiveBenchmarks,
  castVote,
  getArenaStats,
  findCompetingAssets,
} from './engine';
import { BattleResultPayload } from './types';

const router = Router();

// Auth middleware for arena
function requireArenaAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' });
  }
  const nodeId = validateNodeSecret(auth.slice(7));
  if (!nodeId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
  }
  req.nodeId = nodeId;
  next();
}

// POST /arena/matchmaking - Join matchmaking queue
router.post('/matchmaking', requireArenaAuth, (req: any, res: any) => {
  const { topic = 'general' } = req.body;
  const result = joinMatchmaking(req.nodeId, topic);
  res.json({ status: 'queued', ...result });
});

// DELETE /arena/matchmaking - Leave matchmaking queue
router.delete('/matchmaking', requireArenaAuth, (req: any, res: any) => {
  const left = leaveMatchmaking(req.nodeId);
  res.json({ status: left ? 'left' : 'not_in_queue' });
});

// GET /arena/matchmaking/status - Check matchmaking status
router.get('/matchmaking/status', requireArenaAuth, (req: any, res: any) => {
  const status = getMatchmakingStatus(req.nodeId);
  res.json(status);
});

// POST /arena/battles - Create a direct challenge battle
router.post('/battles', requireArenaAuth, (req: any, res: any) => {
  const { opponent_id, topic = 'general' } = req.body;
  
  if (!opponent_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing opponent_id', correction: 'Provide opponent_id as the node ID to challenge' });
  }
  
  if (opponent_id === req.nodeId) {
    return res.status(400).json({ error: 'invalid_request', message: 'Cannot battle yourself', correction: 'Provide a different opponent_id' });
  }
  
  const battle = createBattle(req.nodeId, opponent_id, topic);
  res.json({ status: 'created', battle });
});

// GET /arena/battles - List battles
router.get('/battles', (req: any, res: any) => {
  const { season_id, node_id, status } = req.query;
  const battles = listBattles({ season_id, node_id, status });
  res.json({ battles, total: battles.length });
});

// GET /arena/battles/:id - Battle details
router.get('/battles/:id', (req: any, res: any) => {
  const battle = getBattle(req.params.id);
  if (!battle) {
    return res.status(404).json({ error: 'not_found', message: 'Battle not found', correction: 'Provide a valid battle_id' });
  }
  res.json({ battle });
});

// POST /arena/battles/:id/submit - Submit battle result
router.post('/battles/:id/submit', requireArenaAuth, (req: any, res: any) => {
  const { score, summary } = req.body;
  
  if (score === undefined || score === null) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing score', correction: 'Provide score (0-100) in request body' });
  }
  
  if (typeof score !== 'number' || score < 0 || score > 100) {
    return res.status(400).json({ error: 'invalid_request', message: 'Invalid score range', correction: 'score must be a number between 0 and 100' });
  }
  
  const battle = getBattle(req.params.id);
  if (!battle) {
    return res.status(404).json({ error: 'not_found', message: 'Battle not found', correction: 'Provide a valid battle_id' });
  }
  
  if (battle.node_a !== req.nodeId && battle.node_b !== req.nodeId) {
    return res.status(403).json({ error: 'forbidden', message: 'You are not a participant in this battle' });
  }
  
  const payload: BattleResultPayload = {
    battle_id: req.params.id,
    node_id: req.nodeId,
    score,
    summary: summary || '',
  };
  
  const updatedBattle = submitBattleResult(payload);
  res.json({ status: 'submitted', battle: updatedBattle });
});

// GET /arena/leaderboard - Arena leaderboard
router.get('/leaderboard', (req: any, res: any) => {
  const limit = Math.min(parseInt(req.query.limit || '20'), 100);
  const leaderboard = getLeaderboard(limit);
  res.json({ leaderboard });
});

// GET /arena/leaderboard/:nodeId - Node arena stats
router.get('/leaderboard/:nodeId', (req: any, res: any) => {
  const stats = getNodeArenaStats(req.params.nodeId);
  if (!stats) {
    return res.status(404).json({ error: 'not_found', message: 'No arena stats found for this node', correction: 'Participate in battles first to appear on the leaderboard' });
  }
  res.json({ stats });
});

// GET /arena/seasons/current - Current season info
router.get('/seasons/current', (_req: any, res: any) => {
  const season = getOrCreateActiveSeason();
  res.json({ season });
});

// GET /arena/topic-saturation - Topic saturation analysis
router.get('/topic-saturation', (_req: any, res: any) => {
  const saturation = getTopicSaturation();
  res.json(saturation);
});

// GET /arena/topic-saturation/summary - Topic saturation summary
router.get('/topic-saturation/summary', (_req: any, res: any) => {
  const summary = getTopicSaturationSummary();
  res.json(summary);
});

// GET /arena/seasons - List all seasons
router.get('/seasons', (_req: any, res: any) => {
  const allSeasons = listSeasons();
  res.json({ seasons: allSeasons, total: allSeasons.length });
});

// GET /arena/benchmark/current - Active benchmarks
router.get('/benchmark/current', (_req: any, res: any) => {
  const benchmarks = getActiveBenchmarks();
  res.json(benchmarks);
});

// POST /arena/matches/:id/vote - Community vote on a battle
router.post('/matches/:id/vote', (req: any, res: any) => {
  const { entry_id } = req.body;
  
  if (!entry_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing entry_id', correction: 'Provide entry_id in request body' });
  }
  
  const result = castVote(req.params.id, entry_id, req.headers.authorization ? req.headers.authorization.slice(7) : undefined);
  
  if (!result?.success) {
    return res.status(400).json({ error: 'vote_failed', message: result?.message || 'Vote failed' });
  }
  
  res.json(result);
});

// GET /arena/stats — Arena hub-wide statistics
router.get('/stats', (_req: any, res: any) => {
  const stats = getArenaStats();
  res.json({ stats });
});

// GET /arena/competitors/:assetId — Find competing assets by signal overlap
router.get('/competitors/:assetId', (req: any, res: any) => {
  const { assetId } = req.params;
  
  if (!assetId) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing assetId', correction: 'Provide an asset_id path parameter' });
  }
  
  const result = findCompetingAssets(assetId);
  res.json(result);
});

export default router;
