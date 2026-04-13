import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError, ForbiddenError } from '../shared/errors';
import * as taskService from './service';

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  // List tasks
  app.get('/projects/:projectId/tasks', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const tasks = await taskService.listTasks(projectId);
    return reply.send({ success: true, data: tasks });
  });

  // Get task
  app.get('/projects/:projectId/tasks/:taskId', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string };
    const task = await taskService.getTask(projectId, taskId);
    if (!task) {
      return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Task not found' });
    }
    return reply.send({ success: true, data: task });
  });

  // Create task
  app.post('/projects/:projectId/tasks', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { projectId } = request.params as { projectId: string };
    const body = request.body as { title: string; description?: string };
    const task = await taskService.createTask(
      projectId,
      body.title,
      body.description ?? '',
      auth.node_id,
    );
    return reply.status(201).send({ success: true, data: task });
  });

  // Update task
  app.put('/projects/:projectId/tasks/:taskId', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { projectId, taskId } = request.params as { projectId: string; taskId: string };
    const body = request.body as {
      title?: string;
      description?: string;
      status?: string;
      assignee_id?: string | null;
    };
    const task = await taskService.updateTask(projectId, taskId, auth.node_id, body);
    return reply.send({ success: true, data: task });
  });

  // Claim task
  app.post('/projects/:projectId/tasks/:taskId/claim', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { projectId, taskId } = request.params as { projectId: string; taskId: string };
    const task = await taskService.claimTask(projectId, taskId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  // Complete task
  app.post('/projects/:projectId/tasks/:taskId/complete', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { projectId, taskId } = request.params as { projectId: string; taskId: string };
    const task = await taskService.completeTask(projectId, taskId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  // List contributions
  app.get('/projects/:projectId/contributions', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const contributions = await taskService.listContributions(projectId);
    return reply.send({ success: true, data: contributions });
  });

  // Submit contribution
  app.post('/projects/:projectId/contributions', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { projectId } = request.params as { projectId: string };
    const body = request.body as {
      files?: unknown[];
      commit_message: string;
    };
    const contribution = await taskService.submitContribution(
      projectId,
      auth.node_id,
      body.files ?? [],
      body.commit_message,
    );
    return reply.status(201).send({ success: true, data: contribution });
  });

  // ---------------------------------------------------------------------------
  // Flat task routes — /api/v2/task/list, /api/v2/task/:taskId/claim, etc.
  // ---------------------------------------------------------------------------

  // GET /api/v2/task/list
  app.get('/task/list', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { project_id } = request.query as { project_id?: string };
    if (!project_id) {
      return reply.status(400).send({ success: false, error: 'project_id is required' });
    }
    const tasks = await taskService.listTasks(project_id);
    return reply.send({ success: true, data: tasks });
  });

  // GET /api/v2/task/:taskId
  app.get('/task/:taskId', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    // taskId format: projectId:taskId
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

  // POST /api/v2/task/:taskId/claim
  app.post('/task/:taskId/claim', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { taskId } = request.params as { taskId: string };
    const parts = taskId.split(':');
    if (parts.length !== 2) {
      return reply.status(400).send({ success: false, error: 'Invalid taskId format, expected projectId:taskId' });
    }
    const [projectId, tId] = parts as [string, string];
    const task = await taskService.claimTask(projectId, tId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  // POST /api/v2/task/:taskId/complete
  app.post('/task/:taskId/complete', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { taskId } = request.params as { taskId: string };
    const parts = taskId.split(':');
    if (parts.length !== 2) {
      return reply.status(400).send({ success: false, error: 'Invalid taskId format, expected projectId:taskId' });
    }
    const [projectId, tId] = parts as [string, string];
    const task = await taskService.completeTask(projectId, tId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  // GET /api/v2/task/my — tasks claimed by the authenticated node
  app.get('/task/my', {
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
    if (node_id !== undefined && node_id !== auth.node_id) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'node_id must match authenticated node',
      });
    }
    const allTasks = await taskService.listTasks('__all__');
    const filtered = allTasks.filter((t) => {
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

  // POST /api/v2/task/propose-decomposition — propose swarm decomposition of a task
  app.post('/task/propose-decomposition', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      task_id: string;
      sub_task_titles: string[];
      estimated_parallelism?: number;
    };
    if (!body.task_id || !body.sub_task_titles?.length) {
      return reply.status(400).send({ success: false, error: 'task_id and sub_task_titles are required' });
    }
    const decomposition = await taskService.proposeTaskDecomposition(
      body.task_id,
      auth.node_id,
      body.sub_task_titles,
      body.estimated_parallelism,
    );
    return reply.status(201).send({ success: true, data: decomposition });
  });

  // GET /api/v2/task/swarm/:id — get swarm session status
  app.get('/task/swarm/:id', {
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

  // POST /api/v2/task/release — release a claimed task
  app.post('/task/release', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id: string; node_id?: string };
    if (!body.task_id) {
      throw new EvoMapError('task_id is required', 'VALIDATION_ERROR', 400);
    }
    if (body.node_id !== undefined && body.node_id !== auth.node_id) {
      throw new ForbiddenError('node_id must match authenticated node');
    }
    const parts = body.task_id.split(':');
    if (parts.length !== 2) {
      return reply.status(400).send({ success: false, error: 'Invalid task_id format, expected projectId:taskId' });
    }
    const [projectId, taskId] = parts as [string, string];
    const task = await taskService.releaseTask(projectId, taskId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  // POST /api/v2/task/submit — submit an answer to a task
  app.post('/task/submit', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id: string; asset_id?: string; node_id?: string };
    if (!body.task_id) {
      throw new EvoMapError('task_id is required', 'VALIDATION_ERROR', 400);
    }
    if (!body.asset_id && !body.node_id) {
      return reply.status(400).send({ success: false, error: 'asset_id or node_id is required' });
    }
    if (body.node_id !== undefined && body.node_id !== auth.node_id) {
      throw new ForbiddenError('node_id must match authenticated node');
    }
    if (body.asset_id) {
      const asset = await taskService.getAssetById(body.asset_id);
      if (!asset) {
        throw new EvoMapError('asset_id does not exist', 'NOT_FOUND', 404);
      }
    }
    const submission = await taskService.submitTaskAnswer(
      body.task_id,
      auth.node_id,
      body.asset_id,
      body.node_id,
    );
    return reply.status(201).send({ success: true, data: submission });
  });

  // POST /api/v2/task/accept-submission — accept a submission
  app.post('/task/accept-submission', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id: string; submission_id: string };
    if (!body.task_id || !body.submission_id) {
      throw new EvoMapError('task_id and submission_id are required', 'VALIDATION_ERROR', 400);
    }
    const submission = await taskService.acceptSubmission(body.task_id, body.submission_id, auth.node_id);
    return reply.send({ success: true, data: submission });
  });

  // POST /api/v2/task/reject-submission — reject a submission
  app.post('/task/reject-submission', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id: string; submission_id: string };
    if (!body.task_id || !body.submission_id) {
      throw new EvoMapError('task_id and submission_id are required', 'VALIDATION_ERROR', 400);
    }
    const submission = await taskService.rejectSubmission(body.task_id, body.submission_id, auth.node_id);
    return reply.send({ success: true, data: submission });
  });

  // POST /api/v2/task/:taskId/commitment — set commitment deadline
  app.post('/task/:taskId/commitment', {
    schema: { tags: ['Task'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { taskId } = request.params as { taskId: string };
    const body = request.body as { node_id: string; deadline: string };
    if (!body.node_id || !body.deadline) {
      throw new EvoMapError('node_id and deadline are required', 'VALIDATION_ERROR', 400);
    }
    if (body.node_id !== auth.node_id) {
      throw new ForbiddenError('node_id must match authenticated node');
    }
    const commitment = await taskService.setTaskCommitment(
      taskId,
      auth.node_id,
      body.deadline,
    );
    return reply.send({ success: true, data: commitment });
  });

  // GET /api/v2/task/eligible-count — count nodes meeting reputation threshold
  app.get('/task/eligible-count', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const query = request.query as { min_reputation?: string };
    const minReputation = query.min_reputation ? parseInt(query.min_reputation, 10) : undefined;
    const count = await taskService.getEligibleNodeCount(minReputation);
    return reply.send({ success: true, data: { count, min_reputation: minReputation ?? null } });
  });

  // GET /api/v2/task/:taskId/submissions — list submissions for a task
  app.get('/task/:taskId/submissions', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const submissions = await taskService.getSubmissions(taskId);
    return reply.send({ success: true, data: submissions });
  });
}
