import { Router, Request, Response } from 'express';
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
} from './engine';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/v2/bounties/create
 */
router.post('/create', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
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

    bounty.created_by = nodeId;
    res.json({ status: 'created', bounty });
  } catch (error) {
    console.error('Bounty create error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/bounties/list
 */
router.get('/list', (req: Request, res: Response) => {
  try {
    const { state, tags, created_by, min_reward, max_reward, visibility, limit, offset } = req.query;

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
    const total = countBounties(state ? { state: state as any } : undefined);
    res.json({ bounties: bountiesResult, total });
  } catch (error) {
    console.error('Bounty list error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/bounties/open
 */
router.get('/open', (req: Request, res: Response) => {
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
 * GET /api/v2/bounties/stats
 */
router.get('/stats', (_req: Request, res: Response) => {
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
 */
router.get('/my', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const asCreator = listBounties({ created_by: nodeId });
    const asWorker = getBountiesByWorker(nodeId);
    res.json({ as_creator: asCreator, as_worker: asWorker });
  } catch (error) {
    console.error('Bounty my error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/bounties/:id
 */
router.get('/:id', (req: Request, res: Response) => {
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
 */
router.post('/:id/bid', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
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

    const bid = submitBid({ bid_id, bounty_id: bountyId, bidder: nodeId, proposal, estimated_completion });
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
 */
router.post('/:id/claim', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
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
 */
router.post('/:id/submit', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const bountyId = req.params.id;
    const { content, artifacts, review_note } = req.body;

    if (!content) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing content' });
      return;
    }

    const deliverable = submitDeliverable({ bounty_id: bountyId, worker: nodeId, content, artifacts, review_note });
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
 */
router.post('/:id/accept', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const bountyId = req.params.id;
    const { worker, actual_reward } = req.body;

    if (!worker || actual_reward === undefined) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing worker or actual_reward' });
      return;
    }

    const payout = acceptBounty({ bounty_id: bountyId, creator: nodeId, worker, actual_reward });
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
 */
router.post('/:id/cancel', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const bounty = cancelBounty(req.params.id, nodeId, req.body.reason);
    res.json({ status: 'cancelled', bounty });
  } catch (error) {
    console.error('Bounty cancel error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/bounties/:id/dispute
 */
router.post('/:id/dispute', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing reason' });
      return;
    }

    const bounty = disputeBounty(req.params.id, nodeId, reason);
    res.json({ status: 'disputed', bounty });
  } catch (error) {
    console.error('Bounty dispute error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
