import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
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
    const { projectId, taskId } = request.params as { projectId: string; taskId: string };
    const body = request.body as {
      title?: string;
      description?: string;
      status?: string;
      assignee_id?: string | null;
    };
    const task = await taskService.updateTask(projectId, taskId, body);
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
}
