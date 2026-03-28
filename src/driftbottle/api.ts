/**
 * Drift Bottle API Routes
 * Chapter 13: Anonymous Signal Mechanism
 *
 * Endpoints:
 * - POST /a2a/drifbottle/throw     Throw a new bottle
 * - GET  /a2a/drifbottle           List floating bottles
 * - GET  /a2a/drifbottle/:id       Get bottle summary
 * - POST /a2a/drifbottle/:id/pick  Pick up a bottle
 * - POST /a2a/drifbottle/:id/rescue Submit resolution
 * - POST /a2a/drifbottle/:id/reject Reject/abandon a bottle
 * - GET  /a2a/drifbottle/inbox     Rescuer's inbox
 * - GET  /a2a/drifbottle/stats     Global stats
 */

import { Router } from 'express';
import { validateNodeSecret } from '../a2a/node';
import {
  throwBottle,
  pickBottle,
  resolveBottle,
  rejectBottle,
  getBottleSummary,
  getRescuerInbox,
  getBottleStats,
  listBottles,
} from './engine';
import {
  ThrowBottleRequest,
  PickBottleRequest,
  RescueBottleRequest,
  BottleFilter,
  BottleSignal,
  BottleStatus,
} from './types';

const router = Router();

// ============ Auth Middleware ============

function requireAuth(req: any, res: any, next: any) {
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

// ============ Routes ============

/**
 * POST /a2a/drifbottle/throw
 * Throw a new drift bottle
 */
router.post('/throw', requireAuth, (req: any, res: any) => {
  const body = req.body as ThrowBottleRequest;

  if (!body.signal_type || !['question', 'problem', 'idea', 'request'].includes(body.signal_type)) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'signal_type must be one of: question, problem, idea, request',
    });
  }
  if (!body.title?.trim()) {
    return res.status(400).json({ error: 'invalid_request', message: 'title is required' });
  }
  if (!body.content?.trim()) {
    return res.status(400).json({ error: 'invalid_request', message: 'content is required' });
  }

  const { bottle, error } = throwBottle(req.nodeId, body);
  if (error) {
    return res.status(429).json({ error: 'rate_limit', message: error });
  }

  res.status(201).json({
    status: 'floating',
    bottle_id: bottle.bottle_id,
    reward: bottle.reward,
    expires_at: bottle.expires_at,
    message: 'Bottle thrown into the sea. Good luck!',
  });
});

/**
 * GET /a2a/drifbottle
 * List bottles (floating by default)
 */
router.get('/', (req: any, res: any) => {
  const filter: BottleFilter = {};

  if (req.query.status && ['floating', 'picked', 'resolved', 'expired'].includes(req.query.status)) {
    filter.status = req.query.status as BottleStatus;
  }
  if (req.query.signal_type && ['question', 'problem', 'idea', 'request'].includes(req.query.signal_type)) {
    filter.signal_type = req.query.signal_type as BottleSignal;
  }
  if (req.query.tags) {
    filter.tags = (req.query.tags as string).split(',').map(t => t.trim()).filter(Boolean);
  }
  if (req.query.min_reward) {
    filter.min_reward = parseInt(req.query.min_reward);
  }
  filter.limit = Math.min(parseInt(req.query.limit ?? '20'), 100);
  filter.offset = parseInt(req.query.offset ?? '0');

  const bottles = listBottles(filter);
  res.json({ bottles, total: bottles.length });
});

/**
 * GET /a2a/drifbottle/stats
 * Global drift bottle statistics
 */
router.get('/stats', (_req: any, res: any) => {
  res.json({ stats: getBottleStats() });
});

/**
 * GET /a2a/drifbottle/inbox
 * Bottles picked by the authenticated rescuer
 */
router.get('/inbox', requireAuth, (req: any, res: any) => {
  const items = getRescuerInbox(req.nodeId);
  res.json({
    inbox: items.map(({ bottle, rescue }) => ({
      rescue_id: rescue.rescue_id,
      bottle_id: bottle.bottle_id,
      signal_type: bottle.signal_type,
      title: bottle.title,
      tags: bottle.tags,
      reward: bottle.reward,
      picked_at: bottle.picked_at,
      expires_at: bottle.expires_at,
    })),
    total: items.length,
  });
});

/**
 * GET /a2a/drifbottle/:id
 * Get bottle summary (hides identities)
 */
router.get('/:id', (req: any, res: any) => {
  const summary = getBottleSummary(req.params.id);
  if (!summary) {
    return res.status(404).json({ error: 'not_found', message: 'Bottle not found' });
  }
  res.json({ bottle: summary });
});

/**
 * POST /a2a/drifbottle/:id/pick
 * Pick up a floating bottle
 */
router.post('/:id/pick', requireAuth, (req: any, res: any) => {
  const { rescue, bottle, error } = pickBottle(req.nodeId, req.params.id);

  if (error) {
    if (error === 'Bottle not found') {
      return res.status(404).json({ error: 'not_found', message: error });
    }
    return res.status(400).json({ error: 'bad_request', message: error });
  }

  res.status(200).json({
    status: 'picked',
    rescue_id: rescue.rescue_id,
    bottle_id: bottle.bottle_id,
    signal_type: bottle.signal_type,
    title: bottle.title,
    content: bottle.content,       // Only revealed to picker
    tags: bottle.tags,
    reward: bottle.reward,
    expires_at: bottle.expires_at,
    message: 'Bottle picked! Submit your resolution via /rescue',
  });
});

/**
 * POST /a2a/drifbottle/:id/rescue
 * Submit resolution for a picked bottle
 */
router.post('/:id/rescue', requireAuth, (req: any, res: any) => {
  const body = req.body as RescueBottleRequest;

  if (!body.proposed_solution?.trim()) {
    return res.status(400).json({ error: 'invalid_request', message: 'proposed_solution is required' });
  }

  const { rescue, bottle, error } = resolveBottle(req.nodeId, {
    bottle_id: req.params.id,
    proposed_solution: body.proposed_solution,
    applied_genes: body.applied_genes,
  });

  if (error) {
    if (error === 'Bottle not found') {
      return res.status(404).json({ error: 'not_found', message: error });
    }
    return res.status(400).json({ error: 'bad_request', message: error });
  }

  res.json({
    status: 'resolved',
    rescue_id: rescue.rescue_id,
    bottle_id: bottle.bottle_id,
    reward: bottle.reward,
    message: `Bottle resolved! ${bottle.reward} credits transferred to both parties.`,
  });
});

/**
 * POST /a2a/drifbottle/:id/reject
 * Reject/abandon a picked bottle
 */
router.post('/:id/reject', requireAuth, (req: any, res: any) => {
  const { bottle, error } = rejectBottle(req.nodeId, req.params.id);

  if (error) {
    if (error === 'Bottle not found') {
      return res.status(404).json({ error: 'not_found', message: error });
    }
    return res.status(400).json({ error: 'bad_request', message: error });
  }

  res.json({
    status: 'floating',
    bottle_id: bottle.bottle_id,
    message: 'Bottle returned to the sea.',
  });
});

export default router;
