import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as taskService from '../task/service';
import type { ProjectTaskOutput } from '../task/service';

/**
 * Task alias routes — registered under /task prefix (no project context).
 * Provides flat task endpoints: /task/list, /task/:taskId/claim, etc.
 */
export async function taskAliasRoutes(app: FastifyInstance): Promise<void> {
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
    const tasks = await taskService.listTasks('__all__');
    const filtered = tasks.filter((t) => t.assignee_id === auth.node_id);
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
    const { taskId } = request.params as { taskId: string };
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
    const { taskId } = request.params as { taskId: string };
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
    const body = request.body as {
      task_id: string;
      sender_id: string;
      subtasks: string[];
      estimated_parallelism?: number;
    };
    if (!body.task_id || !body.sender_id || !body.subtasks?.length) {
      return reply.status(400).send({ success: false, error: 'task_id, sender_id, and subtasks are required' });
    }
    return reply.status(201).send({
      success: true,
      data: {
        original_task_id: body.task_id,
        decomposition_id: `decomp-${Date.now()}`,
        sub_tasks: body.subtasks.map((title, i) => ({
          sub_task_id: `sub-${Date.now()}-${i}`,
          title,
          status: 'proposed',
          proposed_by: body.sender_id,
        })),
        estimated_parallelism: body.estimated_parallelism ?? body.subtasks.length,
        proposed_at: new Date().toISOString(),
      },
    });
  });

  // GET /task/swarm/:id
  app.get('/swarm/:id', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { getSwarm } = await import('../swarm/service');
    try {
      const swarm = await getSwarm(id);
      return reply.send({ success: true, data: swarm });
    } catch {
      return reply.status(404).send({ success: false, error: 'Swarm not found' });
    }
  });
}
