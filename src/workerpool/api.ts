import { Router, Request, Response } from 'express';
import {
  registerWorker,
  getWorker,
  listWorkers,
  updateWorkerAvailability,
  getSpecialistPool,
  listSpecialistPools,
  addTaskToSpecialistPool,
  getSpecialistTaskQueue,
  claimSpecialistTask,
  assignTask,
  completeAssignment,
  getAssignment,
  getWorkerAssignments,
  matchWorkerToTask,
  getWorkerPoolStats,
  pruneInactiveWorkers,
} from './index';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/v2/workerpool/register
 */
router.post('/register', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { type, skills, domain, max_concurrent_tasks } = req.body;

    const worker = registerWorker({ worker_id: nodeId, type, skills: skills ?? [], domain, max_concurrent_tasks });
    res.json({ status: 'registered', worker });
  } catch (error) {
    console.error('Worker pool register error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers
 */
router.get('/workers', (req: Request, res: Response) => {
  try {
    const { type, domain, is_available, min_reputation } = req.query;

    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    if (domain) filter.domain = domain;
    if (is_available !== undefined) filter.is_available = is_available === 'true';
    if (min_reputation) filter.min_reputation = parseFloat(min_reputation as string);

    const workers = listWorkers(filter as Parameters<typeof listWorkers>[0]);
    res.json({ workers, total: workers.length });
  } catch (error) {
    console.error('Worker pool list error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers/:id
 */
router.get('/workers/:id', (req: Request, res: Response) => {
  try {
    const worker = getWorker(req.params.id);
    if (!worker) {
      res.status(404).json({ error: 'worker_not_found', message: `Worker ${req.params.id} not found` });
      return;
    }
    res.json(worker);
  } catch (error) {
    console.error('Worker pool get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/workers/:id/availability
 */
router.post('/workers/:id/availability', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const workerId = req.params.id;

    if (workerId !== nodeId) {
      res.status(403).json({ error: 'forbidden', message: 'Cannot update another worker\'s availability' });
      return;
    }

    const { available } = req.body;
    if (available === undefined) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing available field' });
      return;
    }

    const worker = updateWorkerAvailability(workerId, !!available);
    res.json({ status: 'updated', worker });
  } catch (error) {
    console.error('Worker availability error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/workers/:id/assignments
 */
router.get('/workers/:id/assignments', (req: Request, res: Response) => {
  try {
    const assignments = getWorkerAssignments(req.params.id);
    res.json({ assignments, total: assignments.length });
  } catch (error) {
    console.error('Worker assignments error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/pools
 */
router.get('/specialist/pools', (_req: Request, res: Response) => {
  try {
    const pools = listSpecialistPools();
    const plain = pools.map(p => ({ ...p, workers: [...p.workers] }));
    res.json({ pools: plain, total: plain.length });
  } catch (error) {
    console.error('Specialist pools error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/:domain/pools
 */
router.get('/specialist/:domain/pools', (req: Request, res: Response) => {
  try {
    const pool = getSpecialistPool(req.params.domain);
    if (!pool) {
      res.status(404).json({ error: 'pool_not_found', message: `Specialist pool ${req.params.domain} not found` });
      return;
    }
    res.json({ ...pool, workers: [...pool.workers] });
  } catch (error) {
    console.error('Specialist pool error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/specialist/tasks
 */
router.post('/specialist/tasks', requireAuth, (req: Request, res: Response) => {
  try {
    const { task_id, domain, description, required_skills, bounty, priority } = req.body;

    if (!task_id || !domain || !description || !required_skills || !Array.isArray(required_skills)) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: task_id, domain, description, required_skills (array)',
      });
      return;
    }

    const task = addTaskToSpecialistPool({ task_id, domain, description, required_skills, bounty, priority: priority ?? 'medium' });
    res.json({ status: 'queued', task });
  } catch (error) {
    console.error('Specialist task add error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/specialist/:domain/tasks
 */
router.get('/specialist/:domain/tasks', (req: Request, res: Response) => {
  try {
    const tasks = getSpecialistTaskQueue(req.params.domain);
    res.json({ domain: req.params.domain, tasks, total: tasks.length });
  } catch (error) {
    console.error('Specialist task queue error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/specialist/:domain/claim
 */
router.post('/specialist/:domain/claim', requireAuth, (req: Request, res: Response) => {
  try {
    const nodeId = (req as AuthRequest).nodeId;
    const { task_id } = req.body;

    if (!task_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id' });
      return;
    }

    const task = claimSpecialistTask(task_id, req.params.domain, nodeId);
    if (!task) {
      res.status(404).json({ error: 'task_not_found', message: 'Task not found or already claimed' });
      return;
    }

    const assignment = assignTask({ task_id, worker_id: nodeId, pool_type: 'specialist' });
    res.json({ status: 'claimed', task, assignment });
  } catch (error) {
    console.error('Specialist claim error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/assign
 */
router.post('/assign', requireAuth, (req: Request, res: Response) => {
  try {
    const { task_id, worker_id, pool_type } = req.body;

    if (!task_id || !worker_id || !pool_type) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id, worker_id, or pool_type' });
      return;
    }

    const assignment = assignTask({ task_id, worker_id, pool_type });
    res.json({ status: 'assigned', assignment });
  } catch (error) {
    console.error('Worker pool assign error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/match
 */
router.post('/match', (req: Request, res: Response) => {
  try {
    const { task_id, required_skills, bounty } = req.body;

    if (!task_id || !required_skills || !Array.isArray(required_skills)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing task_id or required_skills' });
      return;
    }

    const matches = matchWorkerToTask(task_id, required_skills, bounty);
    res.json({ task_id, matches, total: matches.length });
  } catch (error) {
    console.error('Worker match error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/v2/workerpool/assignments/:id/complete
 */
router.post('/assignments/:id/complete', requireAuth, (req: Request, res: Response) => {
  try {
    const { outcome, quality_score, response_time_ms } = req.body;

    if (!outcome || !['success', 'failed', 'partial'].includes(outcome)) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing or invalid outcome (success|failed|partial)' });
      return;
    }

    const assignment = completeAssignment(req.params.id, outcome, quality_score, response_time_ms);
    if (!assignment) {
      res.status(404).json({ error: 'assignment_not_found', message: `Assignment ${req.params.id} not found` });
      return;
    }

    res.json({ status: 'completed', assignment });
  } catch (error) {
    console.error('Assignment complete error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/assignments/:id
 */
router.get('/assignments/:id', (req: Request, res: Response) => {
  try {
    const assignment = getAssignment(req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'assignment_not_found', message: `Assignment ${req.params.id} not found` });
      return;
    }
    res.json(assignment);
  } catch (error) {
    console.error('Assignment get error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/v2/workerpool/stats
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    pruneInactiveWorkers();
    const stats = getWorkerPoolStats();
    res.json(stats);
  } catch (error) {
    console.error('Worker pool stats error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
