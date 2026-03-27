/**
 * Evolution Sandbox API Routes
 * Phase 2-3: Isolated evolution environment endpoints
 */

import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// Import engine functions (lazy to avoid circular deps)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getEngine = () => require('./engine') as any;

function auth(_req: Request, _res: Response, next: () => void) {
  // Auth is handled by the parent app's middleware for these routes
  // This router is mounted with app.use('/api/v2/sandbox', sandboxRouter)
  // which is after the global auth check
  next();
}

// ============ Sandbox CRUD ============

/**
 * POST /api/v2/sandbox/create
 * Create a new sandbox
 * Body: { sandbox_id, name, description, isolation_level?, env?, tags? }
 */
router.post('/create', auth, (req: Request, res: Response) => {
  try {
    const { sandbox_id, name, description, isolation_level, env, tags } = req.body;
    if (!sandbox_id || !name || !description) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing sandbox_id, name, or description' });
      return;
    }
    const { createSandbox } = getEngine();
    const sandbox = createSandbox({
      sandbox_id,
      name,
      description,
      isolation_level,
      env,
      created_by: 'node_anonymous', // overridden with actual nodeId
      tags,
    });
    res.json({ status: 'created', sandbox });
  } catch (error) {
    console.error('Sandbox create error:', error);
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

/**
 * GET /api/v2/sandbox/list
 * List sandboxes with optional filters
 * Query: state, env, isolation_level, created_by, tag
 */
router.get('/list', (req: Request, res: Response) => {
  try {
    const { state, env, isolation_level, created_by, tag } = req.query;
    const { listSandboxes } = getEngine();
    const sandboxes = listSandboxes({
      state,
      env,
      isolation_level,
      created_by,
      tag,
    } as Parameters<typeof listSandboxes>[0]);
    res.json({ sandboxes, total: sandboxes.length });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

/**
 * GET /api/v2/sandbox/:id
 * Get sandbox details
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { getSandbox } = getEngine();
    const sandbox = getSandbox(req.params.id);
    if (!sandbox) {
      res.status(404).json({ error: 'sandbox_not_found' });
      return;
    }
    res.json(sandbox);
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

/**
 * PATCH /api/v2/sandbox/:id/state
 * Update sandbox state (active/frozen/archived)
 * Body: { state }
 */
router.patch('/:id/state', auth, (req: Request, res: Response) => {
  try {
    const { state } = req.body;
    if (!['active', 'frozen', 'archived'].includes(state)) {
      res.status(400).json({ error: 'invalid_state' });
      return;
    }
    const { updateSandboxState } = getEngine();
    const sandbox = updateSandboxState(req.params.id, state);
    if (!sandbox) {
      res.status(404).json({ error: 'sandbox_not_found' });
      return;
    }
    res.json({ status: 'updated', sandbox });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

// ============ Members ============

/**
 * POST /api/v2/sandbox/:id/members
 * Add member to sandbox
 * Body: { node_id, role }
 */
router.post('/:id/members', auth, (req: Request, res: Response) => {
  try {
    const { node_id, role } = req.body;
    if (!node_id || !['participant', 'observer'].includes(role)) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const { addMember } = getEngine();
    const member = addMember(req.params.id, node_id, role);
    if (!member) {
      res.status(404).json({ error: 'sandbox_not_found' });
      return;
    }
    res.json({ status: 'added', member });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

/**
 * GET /api/v2/sandbox/:id/members
 * List sandbox members
 */
router.get('/:id/members', (req: Request, res: Response) => {
  try {
    const { listMembers } = getEngine();
    res.json({ members: listMembers(req.params.id) });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

/**
 * PATCH /api/v2/sandbox/:id/members/:nodeId/role
 * Update member role
 * Body: { role }
 */
router.patch('/:id/members/:nodeId/role', auth, (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    if (!['participant', 'observer'].includes(role)) {
      res.status(400).json({ error: 'invalid_role' });
      return;
    }
    const { updateMemberRole } = getEngine();
    const member = updateMemberRole(req.params.id, req.params.nodeId, role);
    if (!member) {
      res.status(404).json({ error: 'member_not_found' });
      return;
    }
    res.json({ status: 'updated', member });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

// ============ Assets ============

/**
 * POST /api/v2/sandbox/:id/assets
 * Add an asset to sandbox
 * Body: { asset_id, asset_type, name, content, signals_match?, strategy?, gdi?, tags? }
 */
router.post('/:id/assets', auth, (req: Request, res: Response) => {
  try {
    const { asset_id, asset_type, name, content, signals_match, strategy, diff, trigger, gene, confidence, gdi, tags, created_by, metadata } = req.body;
    if (!asset_id || !asset_type || !name || !content) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing required fields' });
      return;
    }
    const { addSandboxAsset } = getEngine();
    const asset = addSandboxAsset({
      sandbox_id: req.params.id,
      asset_id,
      asset_type,
      name,
      content,
      signals_match,
      strategy,
      diff,
      trigger,
      gene,
      confidence,
      gdi,
      tags: tags ?? [],
      created_by: created_by ?? 'node_anon',
      metadata,
    });
    res.json({ status: 'added', asset });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

/**
 * GET /api/v2/sandbox/:id/assets
 * List sandbox assets
 * Query: promoted, asset_type, created_by, min_gdi
 */
router.get('/:id/assets', (req: Request, res: Response) => {
  try {
    const { promoted, asset_type, created_by, min_gdi } = req.query;
    const { getSandboxAssets } = getEngine();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (promoted !== undefined) filter.promoted = promoted === 'true';
    if (asset_type) filter.asset_type = asset_type as 'gene' | 'capsule';
    if (created_by) filter.created_by = created_by as string;
    if (min_gdi) filter.min_gdi = parseFloat(min_gdi as string);

    const assets = getSandboxAssets(req.params.id, filter);
    res.json({ assets, total: assets.length });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

/**
 * POST /api/v2/sandbox/:id/assets/:assetId/promote
 * Request promotion of a sandbox asset to production
 */
router.post('/:id/assets/:assetId/promote', auth, (req: Request, res: Response) => {
  try {
    const { requested_by, review_note } = req.body;
    const { requestPromotion, getSandbox } = getEngine();
    const sandbox = getSandbox(req.params.id);
    if (!sandbox) {
      res.status(404).json({ error: 'sandbox_not_found' });
      return;
    }
    const request = requestPromotion({
      sandbox_id: req.params.id,
      asset_id: req.params.assetId,
      requested_by: requested_by ?? 'node_anon',
    });
    res.json({ status: 'promotion_requested', request });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

// ============ Promotion Requests ============

/**
 * GET /api/v2/sandbox/:id/promotions
 * Get promotion requests
 * Query: status
 */
router.get('/:id/promotions', (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const { getPromotionRequests } = getEngine();
    const requests = getPromotionRequests(req.params.id, status as 'pending' | 'approved' | 'rejected');
    res.json({ requests, total: requests.length });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

/**
 * POST /api/v2/sandbox/:id/promotions/:requestId/review
 * Review a promotion request
 * Body: { decision: 'approved' | 'rejected', reviewer, note? }
 */
router.post('/:id/promotions/:requestId/review', auth, (req: Request, res: Response) => {
  try {
    const { decision, reviewer, note } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      res.status(400).json({ error: 'invalid_decision' });
      return;
    }
    const { reviewPromotion } = getEngine();
    const request = reviewPromotion(req.params.requestId, decision, reviewer ?? 'node_anon', note);
    if (!request) {
      res.status(404).json({ error: 'request_not_found' });
      return;
    }
    res.json({ status: 'reviewed', request });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

// ============ Metrics ============

/**
 * GET /api/v2/sandbox/:id/metrics
 * Get sandbox real-time metrics
 */
router.get('/:id/metrics', (req: Request, res: Response) => {
  try {
    const { getSandboxMetrics } = getEngine();
    const metrics = getSandboxMetrics(req.params.id);
    if (!metrics) {
      res.status(404).json({ error: 'sandbox_not_found' });
      return;
    }
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

// ============ Invites ============

/**
 * POST /api/v2/sandbox/:id/invite
 * Invite a node to the sandbox
 * Body: { invitee, role? }
 */
router.post('/:id/invite', auth, (req: Request, res: Response) => {
  try {
    const { invitee, role } = req.body;
    if (!invitee) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const { createInvite } = getEngine();
    const invite = createInvite({
      sandbox_id: req.params.id,
      inviter: 'node_anon',
      invitee,
      role,
    });
    res.json({ status: 'invite_created', invite });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

/**
 * POST /api/v2/sandbox/invites/:inviteId/accept
 * Accept an invite
 */
router.post('/invites/:inviteId/accept', auth, (req: Request, res: Response) => {
  try {
    const { acceptInvite } = getEngine();
    const invite = acceptInvite(req.params.inviteId);
    if (!invite) {
      res.status(404).json({ error: 'invite_not_found' });
      return;
    }
    res.json({ status: 'accepted', invite });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

/**
 * POST /api/v2/sandbox/invites/:inviteId/decline
 * Decline an invite
 */
router.post('/invites/:inviteId/decline', auth, (req: Request, res: Response) => {
  try {
    const { declineInvite } = getEngine();
    const invite = declineInvite(req.params.inviteId);
    if (!invite) {
      res.status(404).json({ error: 'invite_not_found' });
      return;
    }
    res.json({ status: 'declined', invite });
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: String(error) });
  }
});

export default router;
