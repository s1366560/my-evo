import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as taskService from '../task/service';
import type { ProjectTaskOutput } from '../task/service';

/**
 * Task alias routes — registered under /task prefix (no project context).
 * Provides flat task endpoints: /task/list, /task/:taskId/claim, etc.
 */
export async function taskAliasRoutes(app: FastifyInstance): Promise<void> {
  function hasMismatchedNodeId(
    providedNodeId: string | undefined,
    authenticatedNodeId: string,
  ): boolean {
    return providedNodeId !== undefined && providedNodeId !== authenticatedNodeId;
  }

  // GET /task/list — list all tasks (no project context)
  app.get('/list', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const tasks = await taskService.listTasks('__all__');
    return reply.send({ success: true, data: tasks });
  });

  // GET /task/my — tasks for the authenticated node
  app.get('/my', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { status, role, node_id } = request.query as { status?: string; role?: string; node_id?: string };
    if (role && role !== 'assignee') {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Unsupported role filter. Only role=assignee is currently supported.',
      });
    }
    if (hasMismatchedNodeId(node_id, auth.node_id)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'node_id must match authenticated node',
      });
    }
    const tasks = await taskService.listTasks('__all__');
    const filtered = tasks.filter((t) => {
      if (t.assignee_id !== auth.node_id) {
        return false;
      }
      if (status) {
        return t.status === status;
      }
      return true;
    });
    return reply.send({ success: true, data: filtered });
  });

  // GET /task/eligible-count — must be BEFORE /:taskId catch-all
  app.get('/eligible-count', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const query = request.query as { min_reputation?: string };
    const minReputation = query.min_reputation ? parseInt(query.min_reputation, 10) : undefined;
    const count = await taskService.getEligibleNodeCount(minReputation);
    return reply.send({ success: true, data: { count, min_reputation: minReputation ?? null } });
  });

  // POST /task/claim — claim a task (task_id in body, no URL path param)
  app.post('/claim', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id?: string; node_id?: string };
    if (hasMismatchedNodeId(body.node_id, auth.node_id)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'node_id must match authenticated node',
      });
    }
    if (!body.task_id) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'task_id is required in body. Usage: POST /task/claim with body { task_id: "projectId:taskId" }. Also requires Authorization: Bearer <token> header.',
      });
    }
    const parts = body.task_id.split(':');
    if (parts.length !== 2) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: `Invalid task_id format. Expected projectId:taskId (e.g., bounty-001:task-123). Got: '${body.task_id}'.`,
      });
    }
    const [projectId, tId] = parts as [string, string];
    const task = await taskService.claimTask(projectId, tId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  // POST /task/complete — complete a claimed task (task_id/asset_id in body)
  app.post('/complete', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id?: string; asset_id?: string; node_id?: string };
    if (hasMismatchedNodeId(body.node_id, auth.node_id)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'node_id must match authenticated node',
      });
    }
    if (!body.task_id) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'task_id is required in body. Usage: POST /task/complete with body { task_id: "projectId:taskId", asset_id?: "sha256:..." }. Also requires Authorization: Bearer <token> header.',
      });
    }
    const parts = body.task_id.split(':');
    if (parts.length !== 2) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: `Invalid task_id format. Expected projectId:taskId (e.g., bounty-001:task-123). Got: '${body.task_id}'.`,
      });
    }
    const [projectId, tId] = parts as [string, string];
    const task = await taskService.completeTask(projectId, tId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  // POST /task/release — release a claimed task back to open
  app.post('/release', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id?: string; node_id?: string };
    if (hasMismatchedNodeId(body.node_id, auth.node_id)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'node_id must match authenticated node',
      });
    }
    if (!body.task_id) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'task_id is required in body. Usage: POST /task/release with body { task_id: "projectId:taskId" }. Also requires Authorization: Bearer <token> header.',
      });
    }
    const parts = body.task_id.split(':');
    if (parts.length !== 2) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: `Invalid task_id format. Expected projectId:taskId (e.g., bounty-001:task-123). Got: '${body.task_id}'.`,
      });
    }
    const [projectId, taskId] = parts as [string, string];
    const task = await taskService.releaseTask(projectId, taskId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  // GET /task/:taskId — get single task (taskId format: projectId:taskId)
  app.get('/:taskId', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const parts = taskId.split(':');
    if (parts.length !== 2) {
      return reply.status(400).send({ success: false, error: 'Invalid taskId format, expected projectId:taskId' });
    }
    const [projectId, tId] = parts as [string, string];
    const task = await taskService.getTask(projectId, tId);
    if (!task) {
      return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Task not found' });
    }
    return reply.send({ success: true, data: task });
  });

  // POST /task/:taskId/claim
  app.post('/:taskId/claim', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = ((request.body as { node_id?: string } | undefined) ?? {}) as { node_id?: string };
    const { taskId } = request.params as { taskId: string };
    if (hasMismatchedNodeId(body.node_id, auth.node_id)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'node_id must match authenticated node',
      });
    }
    if (!taskId) {
      return reply.status(400).send({
        success: false,
        error: 'Missing taskId parameter. Usage: POST /task/{projectId}:{taskId}/claim with JSON body { node_id: \'...\' }. Also requires Authorization: Bearer <token> header.',
      });
    }
    const parts = taskId.split(':');
    if (parts.length !== 2) {
      return reply.status(400).send({
        success: false,
        error: `Invalid taskId format. Expected projectId:taskId (e.g., bounty-001:task-123). Got: '${taskId}'. Also requires Authorization: Bearer <token> header and JSON body { node_id: '...' }.`,
      });
    }
    const [projectId, tId] = parts as [string, string];
    const task = await taskService.claimTask(projectId, tId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  // POST /task/:taskId/complete
  app.post('/:taskId/complete', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = ((request.body as { node_id?: string } | undefined) ?? {}) as { node_id?: string };
    const { taskId } = request.params as { taskId: string };
    if (hasMismatchedNodeId(body.node_id, auth.node_id)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'node_id must match authenticated node',
      });
    }
    if (!taskId) {
      return reply.status(400).send({
        success: false,
        error: 'Missing taskId parameter. Usage: POST /task/{projectId}:{taskId}/complete with JSON body { node_id: \'...\' }. Also requires Authorization: Bearer <token> header.',
      });
    }
    const parts = taskId.split(':');
    if (parts.length !== 2) {
      return reply.status(400).send({
        success: false,
        error: `Invalid taskId format. Expected projectId:taskId (e.g., bounty-001:task-123). Got: '${taskId}'. Also requires Authorization: Bearer <token> header and JSON body { node_id: '...' }.`,
      });
    }
    const [projectId, tId] = parts as [string, string];
    const task = await taskService.completeTask(projectId, tId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  // POST /task/propose-decomposition
  app.post('/propose-decomposition', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      task_id: string;
      sender_id: string;
      subtasks: string[];
      estimated_parallelism?: number;
    };
    if (!body.task_id || !body.sender_id || !body.subtasks?.length) {
      return reply.status(400).send({ success: false, error: 'task_id, sender_id, and subtasks are required' });
    }
    if (body.sender_id !== auth.node_id) {
      return reply.status(403).send({ success: false, error: 'sender_id must match authenticated node' });
    }
    const decomposition = await taskService.proposeTaskDecomposition(
      body.task_id,
      auth.node_id,
      body.subtasks,
      body.estimated_parallelism,
    );
    return reply.status(201).send({ success: true, data: decomposition });
  });

  // GET /task/swarm/:id
  app.get('/swarm/:id', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const { getSwarm } = await import('../swarm/service');
    try {
      const swarm = await getSwarm(id);
      if (swarm.creator_id !== auth.node_id) {
        return reply.status(404).send({ success: false, error: 'Swarm not found' });
      }
      return reply.send({ success: true, data: swarm });
    } catch {
      return reply.status(404).send({ success: false, error: 'Swarm not found' });
    }
  });
}
