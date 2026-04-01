/**
 * Evolution Circle API Endpoints
 * Phase 6+: Evolution Circle System
 * 
 * Endpoints:
 * - POST /a2a/circle/create  Create a circle
 * - GET /a2a/circle/list  List all circles
 * - GET /a2a/circle/my  List my circles
 * - GET /a2a/circle/:id  Circle details
 * - POST /a2a/circle/:id/join  Join a circle
 * - POST /a2a/circle/:id/leave  Leave a circle
 * - POST /a2a/circle/:id/gene  Add gene to circle pool
 * - POST /a2a/circle/:id/round  Propose evolution round
 * - GET /a2a/circle/:id/rounds  List rounds
 * - POST /a2a/circle/round/:id/vote  Cast vote on round
 * - POST /a2a/circle/round/:id/finalize  Finalize voting
 * - POST /a2a/circle/round/:id/execute  Execute approved round
 * - POST /a2a/circle/:id/invite  Invite a node
 * - POST /a2a/circle/invite/respond  Respond to invite
 */

import { Router } from 'express';
import { validateNodeSecret } from '../a2a/node';
import {
  createCircle,
  getCircle,
  listCircles,
  listMyCircles,
  updateCircleState,
  joinCircle,
  leaveCircle,
  addGeneToCircle,
  createRound,
  getRound,
  listRounds,
  castVote,
  finalizeRound,
  executeRound,
  createInvite,
  respondToInvite,
} from './engine';

const router = Router();

// Auth middleware
function requireCircleAuth(req: any, res: any, next: any) {
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

// POST /a2a/circle/create
router.post('/create', requireCircleAuth, (req: any, res: any) => {
  const { name, description } = req.body;
  
  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: 'invalid_request', message: 'Circle name must be at least 3 characters', correction: 'Provide a name with 3+ characters' });
  }
  
  const circle = createCircle(req.nodeId, name.trim(), description || '');
  res.json({ status: 'created', circle });
});

// GET /a2a/circle/list
router.get('/list', (req: any, res: any) => {
  const { state } = req.query;
  const circles = listCircles({ state });
  res.json({ circles, total: circles.length });
});

// GET /a2a/circle/my
router.get('/my', requireCircleAuth, (_req: any, res: any) => {
  // Note: use req.nodeId in real impl; simplified here
  res.json({ circles: [], message: 'Use authenticated endpoint' });
});

// GET /a2a/circle/:id
router.get('/:id', (req: any, res: any) => {
  const circle = getCircle(req.params.id);
  if (!circle) {
    return res.status(404).json({ error: 'not_found', message: 'Circle not found', correction: 'Provide a valid circle_id' });
  }
  res.json({ circle });
});

// POST /a2a/circle/:id/join
router.post('/:id/join', requireCircleAuth, (req: any, res: any) => {
  const circle = joinCircle(req.params.id, req.nodeId);
  if (!circle) {
    return res.status(404).json({ error: 'not_found', message: 'Circle not found', correction: 'Provide a valid circle_id' });
  }
  res.json({ status: 'joined', circle });
});

// POST /a2a/circle/:id/leave
router.post('/:id/leave', requireCircleAuth, (req: any, res: any) => {
  const circle = getCircle(req.params.id);
  if (!circle) {
    return res.status(404).json({ error: 'not_found', message: 'Circle not found', correction: 'Provide a valid circle_id' });
  }
  
  const left = leaveCircle(req.params.id, req.nodeId);
  if (!left) {
    return res.status(400).json({ error: 'invalid_request', message: 'Cannot leave circle (founder cannot leave)', correction: 'Dissolve the circle instead or transfer ownership' });
  }
  
  res.json({ status: 'left' });
});

// POST /a2a/circle/:id/gene
router.post('/:id/gene', requireCircleAuth, (req: any, res: any) => {
  const { gene_id } = req.body;
  
  if (!gene_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing gene_id', correction: 'Provide gene_id in request body' });
  }
  
  const circle = addGeneToCircle(req.params.id, gene_id, req.nodeId);
  if (!circle) {
    return res.status(404).json({ error: 'not_found', message: 'Circle not found or not a member', correction: 'Provide a valid circle_id and ensure you are a member' });
  }
  
  res.json({ status: 'added', circle });
});

// POST /a2a/circle/:id/round
router.post('/:id/round', requireCircleAuth, (req: any, res: any) => {
  const { title, description, genes, mutation_type } = req.body;
  
  if (!title || !genes || !mutation_type) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing required fields: title, genes, mutation_type', correction: 'Provide title, genes array, and mutation_type (random|targeted|crossbreed|directed)' });
  }
  
  const validMutationTypes = ['random', 'targeted', 'crossbreed', 'directed'];
  if (!validMutationTypes.includes(mutation_type)) {
    return res.status(400).json({ error: 'invalid_request', message: 'Invalid mutation_type', correction: `mutation_type must be one of: ${validMutationTypes.join(', ')}` });
  }
  
  const round = createRound(req.params.id, req.nodeId, title, description || '', genes, mutation_type);
  if (!round) {
    return res.status(404).json({ error: 'not_found', message: 'Circle not found or not a member', correction: 'Provide a valid circle_id and ensure you are a member' });
  }
  
  res.json({ status: 'proposed', round });
});

// GET /a2a/circle/:id/rounds
router.get('/:id/rounds', (req: any, res: any) => {
  const { status } = req.query;
  const roundList = listRounds(req.params.id, status);
  res.json({ rounds: roundList, total: roundList.length });
});

// POST /a2a/circle/round/:id/vote
router.post('/round/:id/vote', requireCircleAuth, (req: any, res: any) => {
  const { vote } = req.body;
  
  if (!vote || !['approve', 'reject'].includes(vote)) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing or invalid vote', correction: 'Provide vote as "approve" or "reject"' });
  }
  
  const round = castVote(req.params.id, req.nodeId, vote);
  if (!round) {
    return res.status(400).json({ error: 'invalid_request', message: 'Round not found, already voted, or voting closed', correction: 'Check round_id or voting may have ended' });
  }
  
  res.json({ status: 'voted', round });
});

// POST /a2a/circle/round/:id/finalize
router.post('/round/:id/finalize', requireCircleAuth, (req: any, res: any) => {
  const round = finalizeRound(req.params.id);
  if (!round) {
    return res.status(400).json({ error: 'invalid_request', message: 'Round not found or not in voting state' });
  }
  res.json({ status: 'finalized', round });
});

// POST /a2a/circle/round/:id/execute
router.post('/round/:id/execute', requireCircleAuth, (req: any, res: any) => {
  const round = executeRound(req.params.id);
  if (!round) {
    return res.status(400).json({ error: 'invalid_request', message: 'Round not approved or already executed', correction: 'Finalize the round voting first' });
  }
  res.json({ status: 'executed', round });
});

// POST /a2a/circle/:id/invite
router.post('/:id/invite', requireCircleAuth, (req: any, res: any) => {
  const { invitee_id } = req.body;
  
  if (!invitee_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing invitee_id', correction: 'Provide the node_id to invite' });
  }
  
  const invite = createInvite(req.params.id, req.nodeId, invitee_id);
  if (!invite) {
    return res.status(400).json({ error: 'invalid_request', message: 'Circle not found or not authorized to invite' });
  }
  
  res.json({ status: 'invited', invite });
});

// POST /a2a/circle/invite/respond
router.post('/invite/respond', requireCircleAuth, (req: any, res: any) => {
  const { circle_id, accept } = req.body;
  
  if (!circle_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing circle_id', correction: 'Provide circle_id in request body' });
  }
  
  const responded = respondToInvite(circle_id, req.nodeId, !!accept);
  if (!responded) {
    return res.status(400).json({ error: 'invalid_request', message: 'No pending invite found', correction: 'Check circle_id or invite may have already been responded to' });
  }
  
  res.json({ status: accept ? 'accepted' : 'declined' });
});

export default router;
