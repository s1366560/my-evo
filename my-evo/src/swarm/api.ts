import { Router, Request, Response } from 'express';
import {
  createSwarm, getSwarm, listSwarms, updateSwarmState,
  createSubtask, getSubtask, getSubtasksForSwarm, updateSubtaskState, assignSubtask,
  submitDecomposition, getProposal, acceptProposal, rejectProposal,
  submitAggregatedResult, getAggregatedResult,
  distributeBounty, getBountyDistribution,
  createSession, getSession, updateSession,
  getSwarmStats,
} from './engine';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /a2a/task/propose-decomposition
 * Submit a task decomposition proposal for a Swarm
 */
router.post('/task/propose-decomposition', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { swarm_id, subtasks } = req.body;

    if (!swarm_id || !subtasks || !Array.isArray(subtasks)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing swarm_id or subtasks array' });
      return;
    }

    const swarm = getSwarm(swarm_id);
    if (!swarm) {
      res.status(404).json({ error: 'swarm_not_found', message: `Swarm ${swarm_id} not found` });
      return;
    }

    const proposal = submitDecomposition({
      swarm_id,
      proposer: nodeId,
      subtasks: subtasks.map((s: { id: string; description: string; weight: number }) => ({
        id: s.id,
        description: s.description,
        weight: s.weight,
      })),
    });

    const totalWeight = subtasks.reduce((sum: number, s: { weight: number }) => sum + s.weight, 0);
    if (totalWeight <= 0.85) {
      acceptProposal(swarm_id);
    }

    res.json({ status: 'proposal_submitted', proposal, auto_accepted: totalWeight <= 0.85 });
  } catch (error) {
    console.error('Propose decomposition error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/swarm/create
 * Create a new Swarm task
 */
router.post('/swarm/create', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { swarm_id, title, description, bounty, deadline } = req.body;

    if (!swarm_id || !title || !description) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing required fields' });
      return;
    }

    const swarm = createSwarm({
      swarm_id,
      title,
      description,
      bounty: bounty ?? 0,
      created_by: nodeId,
      root_task_id: swarm_id,
      deadline,
    });

    res.json({ status: 'created', swarm });
  } catch (error) {
    console.error('Swarm create error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/task/swarm/:id
 * Get Swarm details
 */
router.get('/task/swarm/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const swarmId = req.params.id;
    const swarm = getSwarm(swarmId);

    if (!swarm) {
      res.status(404).json({ error: 'swarm_not_found', message: `Swarm ${swarmId} not found` });
      return;
    }

    const subtasks = getSubtasksForSwarm(swarmId);
    const proposal = getProposal(swarmId);
    const result = getAggregatedResult(swarmId);

    res.json({ swarm, subtasks, proposal, result });
  } catch (error) {
    console.error('Swarm get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/task/:id/claim
 * Claim a subtask in a Swarm
 */
router.post('/task/:id/claim', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const subtaskId = req.params.id;

    const subtask = getSubtask(subtaskId);
    if (!subtask) {
      res.status(404).json({ error: 'subtask_not_found', message: `Subtask ${subtaskId} not found` });
      return;
    }

    if (subtask.assigned_to && subtask.assigned_to !== nodeId) {
      res.status(409).json({ error: 'already_claimed', message: 'Subtask already claimed by another node' });
      return;
    }

    const updated = assignSubtask(subtaskId, nodeId);
    res.json({ status: 'claimed', subtask: updated });
  } catch (error) {
    console.error('Task claim error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/task/:id/complete
 * Complete a subtask with result
 */
router.post('/task/:id/complete', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const subtaskId = req.params.id;
    const { result } = req.body;

    const subtask = getSubtask(subtaskId);
    if (!subtask) {
      res.status(404).json({ error: 'subtask_not_found', message: `Subtask ${subtaskId} not found` });
      return;
    }

    if (subtask.assigned_to !== nodeId) {
      res.status(403).json({ error: 'forbidden', message: 'Not assigned to this node' });
      return;
    }

    const updated = updateSubtaskState(subtaskId, 'completed', result);
    res.json({ status: 'completed', subtask: updated });
  } catch (error) {
    console.error('Task complete error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/swarm/:id/aggregate
 * Submit aggregated result (aggregator role)
 */
router.post('/swarm/:id/aggregate', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const swarmId = req.params.id;
    const { output, confidence, summary } = req.body;

    const swarm = getSwarm(swarmId);
    if (!swarm) {
      res.status(404).json({ error: 'swarm_not_found', message: `Swarm ${swarmId} not found` });
      return;
    }

    const result = submitAggregatedResult({
      swarm_id: swarmId,
      aggregator: nodeId,
      output,
      confidence: confidence ?? 0.5,
      summary: summary ?? '',
    });

    if (swarm.bounty > 0) {
      distributeBounty(swarmId, swarm.bounty);
    }

    res.json({ status: 'aggregated', result });
  } catch (error) {
    console.error('Swarm aggregate error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/swarm/stats
 * Get Swarm statistics
 */
router.get('/swarm/stats', (_req: Request, res: Response) => {
  try {
    const stats = getSwarmStats();
    res.json(stats);
  } catch (error) {
    console.error('Swarm stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/session/create
 * Create a collaboration session
 */
router.post('/session/create', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { session_id, swarm_id, participants, purpose, context } = req.body;

    if (!session_id || !swarm_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing session_id or swarm_id' });
      return;
    }

    const allParticipants = [...new Set([nodeId, ...(participants ?? [])])];
    const session = createSession({
      session_id,
      swarm_id,
      participants: allParticipants,
      purpose: purpose ?? '',
      context: context ?? {},
    });

    res.json({ status: 'created', session });
  } catch (error) {
    console.error('Session create error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/dialog
 * Structured dialog message
 */
router.post('/dialog', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { session_id, content, dialog_type } = req.body;

    if (!session_id || !content) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing session_id or content' });
      return;
    }

    const session = getSession(session_id);
    if (!session) {
      res.status(404).json({ error: 'session_not_found', message: `Session ${session_id} not found` });
      return;
    }

    updateSession(session_id, {
      context: {
        ...session.context,
        last_message: { from: nodeId, content, type: dialog_type ?? 'reasoning', at: new Date().toISOString() },
      },
    });

    res.json({ status: 'dialog_recorded', session_id });
  } catch (error) {
    console.error('Dialog error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/session/join
 */
router.post('/session/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { session_id } = req.body;

    if (!session_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing session_id' });
      return;
    }

    const svc = await import('../session/service');
    const session = svc.getSession(session_id);
    if (!session) {
      res.status(404).json({ error: 'session_not_found', message: `Session ${session_id} not found` });
      return;
    }

    if (session.members.some(m => m.node_id === nodeId)) {
      res.status(400).json({ error: 'already_member', message: 'Already a member of this session' });
      return;
    }

    const updated = svc.addMember(session, nodeId, 'participant');
    const activated = updated.status === 'creating' ? svc.activateSession(updated) : updated;
    svc.updateSession(session_id, activated);

    res.json({
      status: 'joined',
      session_id,
      session: activated,
      event: svc.createEvent({ type: 'member_joined', session_id, actor_id: nodeId }),
    });
  } catch (error) {
    console.error('Session join error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/session/context
 */
router.get('/session/context', requireAuth, async (req: Request, res: Response) => {
  try {
    const { session_id, node_id } = req.query;
    if (!session_id || typeof session_id !== 'string') {
      res.status(400).json({ error: 'invalid_request', message: 'Missing session_id' });
      return;
    }

    const svc = await import('../session/service');
    const session = svc.getSession(session_id);
    if (!session) {
      res.status(404).json({ error: 'session_not_found', message: `Session ${session_id} not found` });
      return;
    }

    const member = session.members.find(m => m.node_id === (node_id || ''));
    res.json({
      session_id,
      context: session.context,
      participants: session.members,
      vector_clock: session.vector_clock,
      status: session.status,
      purpose: session.context?.purpose || '',
      is_member: node_id ? session.members.some(m => m.node_id === node_id) : true,
      member_role: member?.role || null,
    });
  } catch (error) {
    console.error('Session context error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/session/submit
 */
router.post('/session/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { session_id, task_id, result_asset_id, content } = req.body;

    if (!session_id || !task_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing session_id or task_id' });
      return;
    }

    const svc = await import('../session/service');
    const session = svc.getSession(session_id);
    if (!session) {
      res.status(404).json({ error: 'session_not_found', message: `Session ${session_id} not found` });
      return;
    }

    if (!session.members.some(m => m.node_id === nodeId)) {
      res.status(403).json({ error: 'not_a_member', message: 'Must be a session member to submit results' });
      return;
    }

    const updated = svc.addMessage(session, {
      type: 'subtask_result',
      from: nodeId,
      content: { task_id, result_asset_id, content },
      causal_dependencies: [],
    });

    svc.updateSession(session_id, updated);

    res.json({
      status: 'submitted',
      session_id,
      task_id,
      message_id: updated.messages[updated.messages.length - 1]?.id,
    });
  } catch (error) {
    console.error('Session submit error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/session/list
 */
router.get('/session/list', async (req: Request, res: Response) => {
  try {
    const { limit = '20', node_id } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);

    const svc = await import('../session/service');
    let sessions = node_id ? svc.listSessionsByNode(node_id as string) : svc.listActiveSessions();
    sessions = sessions.slice(0, limitNum);

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        creator_id: s.creator_id,
        members: s.members.map(m => ({ node_id: m.node_id, role: m.role })),
        purpose: s.context?.purpose || '',
        created_at: s.created_at,
        expires_at: s.expires_at,
      })),
      total: sessions.length,
    });
  } catch (error) {
    console.error('Session list error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/session/board
 */
router.get('/session/board', async (req: Request, res: Response) => {
  try {
    const { session_id } = req.query;
    if (!session_id || typeof session_id !== 'string') {
      res.status(400).json({ error: 'invalid_request', message: 'Missing session_id' });
      return;
    }

    const svc = await import('../session/service');
    const session = svc.getSession(session_id);
    if (!session) {
      res.status(404).json({ error: 'session_not_found', message: `Session ${session_id} not found` });
      return;
    }

    const board = (session.context as any)?.task_board || { tasks: [], columns: ['todo', 'in_progress', 'done'] };
    res.json({ session_id, board, participants: session.members.map(m => m.node_id) });
  } catch (error) {
    console.error('Session board error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/session/board/update
 */
router.post('/session/board/update', requireAuth, async (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { session_id, task_board } = req.body;

    if (!session_id || !task_board) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing session_id or task_board' });
      return;
    }

    const svc = await import('../session/service');
    const session = svc.getSession(session_id);
    if (!session) {
      res.status(404).json({ error: 'session_not_found', message: `Session ${session_id} not found` });
      return;
    }

    if (!session.members.some(m => m.node_id === nodeId && (m.role === 'organizer' || m.role === 'participant'))) {
      res.status(403).json({ error: 'insufficient_permissions', message: 'Must be an organizer or participant' });
      return;
    }

    svc.updateSession(session_id, { context: { ...session.context, task_board } });
    res.json({ status: 'board_updated', session_id });
  } catch (error) {
    console.error('Session board update error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/session/orchestrate
 */
router.post('/session/orchestrate', requireAuth, async (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { session_id, action } = req.body;

    if (!session_id || !action) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing session_id or action' });
      return;
    }

    const svc = await import('../session/service');
    const session = svc.getSession(session_id);
    if (!session) {
      res.status(404).json({ error: 'session_not_found', message: `Session ${session_id} not found` });
      return;
    }

    const organizer = session.members.find(m => m.role === 'organizer');
    if (organizer?.node_id !== nodeId) {
      res.status(403).json({ error: 'insufficient_permissions', message: 'Only the organizer can orchestrate' });
      return;
    }

    let updated = session;
    switch (action) {
      case 'pause': updated = svc.pauseSession(session); break;
      case 'resume': updated = svc.resumeSession(session); break;
      case 'complete': updated = svc.completeSession(session); break;
      default:
        res.status(400).json({ error: 'invalid_action', message: `Unknown action: ${action}` });
        return;
    }

    svc.updateSession(session_id, updated);
    res.json({ status: 'orchestrated', session_id, action, new_status: updated.status });
  } catch (error) {
    console.error('Session orchestrate error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/session/discover
 */
router.get('/session/discover', async (req: Request, res: Response) => {
  try {
    const { limit = '10', topic } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);

    const svc = await import('../session/service');
    let sessions = svc.listActiveSessions();

    if (topic) {
      const topicLower = (topic as string).toLowerCase();
      sessions = sessions.filter(s =>
        s.title.toLowerCase().includes(topicLower) ||
        (s.context?.purpose as string || '').toLowerCase().includes(topicLower)
      );
    }

    sessions = sessions.slice(0, limitNum);

    res.json({
      opportunities: sessions.map(s => ({
        session_id: s.id,
        title: s.title,
        purpose: s.context?.purpose || '',
        creator_id: s.creator_id,
        member_count: s.members.length,
        max_participants: s.max_participants,
        slots_available: s.max_participants - s.members.length,
      })),
      total: sessions.length,
    });
  } catch (error) {
    console.error('Session discover error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
