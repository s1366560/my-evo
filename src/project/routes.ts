import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { EvoMapError } from '../shared/errors';
import * as service from './service';
import type { ProjectFile } from './types';

export async function projectRoutes(app: FastifyInstance) {
  // POST /a2a/project/propose — propose a new project
  app.post('/project/propose', {
    schema: { tags: ['Project'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      title: string;
      description: string;
      repo_name?: string;
      plan?: string;
    };

    if (!body.title || !body.description) {
      throw new EvoMapError('title and description are required', 'VALIDATION_ERROR', 400);
    }

    const project = await service.proposeProject(
      auth.node_id,
      body.title,
      body.description,
      body.repo_name,
      body.plan,
    );

    void reply.status(201);
    return { success: true, data: project };
  });

  // GET /a2a/project/list — list projects
  app.get('/project/list', {
    schema: { tags: ['Project'] },
  }, async (request) => {
    const query = request.query as {
      status?: string;
      limit?: string;
      offset?: string;
    };

    const result = await service.listProjects({
      status: query.status as 'proposed' | 'active' | 'completed' | 'archived' | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });

    return {
      success: true,
      data: result.projects,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    };
  });

  // GET /a2a/project/:id — get project details
  app.get('/project/:id', {
    schema: { tags: ['Project'] },
  }, async (request) => {
    const params = request.params as { id: string };
    const project = await service.getProject(params.id);
    return { success: true, data: project };
  });

  // GET /a2a/project/:id/tasks — get project tasks
  app.get('/project/:id/tasks', {
    schema: { tags: ['Project'] },
  }, async (request) => {
    const params = request.params as { id: string };
    const tasks = await service.getProjectTasks(params.id);
    return { success: true, data: tasks };
  });

  // GET /a2a/project/:id/contributions — get project contributions
  app.get('/project/:id/contributions', {
    schema: { tags: ['Project'] },
  }, async (request) => {
    const params = request.params as { id: string };
    const contributions = await service.getProjectContributions(params.id);
    return { success: true, data: contributions };
  });

  // POST /a2a/project/:id/contribute — submit a contribution
  app.post('/project/:id/contribute', {
    schema: { tags: ['Project'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const params = request.params as { id: string };
    const body = request.body as {
      sender_id: string;
      task_id?: string;
      files: ProjectFile[];
      commit_message?: string;
    };

    if (!body.files || body.files.length === 0) {
      throw new EvoMapError('at least one file is required', 'VALIDATION_ERROR', 400);
    }

    for (const file of body.files) {
      if (!file.path || !file.content || !file.action) {
        throw new EvoMapError('each file must have path, content, and action', 'VALIDATION_ERROR', 400);
      }
      if (!['create', 'update', 'delete'].includes(file.action)) {
        throw new EvoMapError('file action must be create, update, or delete', 'VALIDATION_ERROR', 400);
      }
    }

    const contribution = await service.submitContribution(
      params.id,
      auth.node_id,
      body.files,
      body.task_id,
      body.commit_message,
    );

    void reply.status(201);
    return { success: true, data: contribution };
  });

  // POST /a2a/project/:id/pr — create a pull request
  app.post('/project/:id/pr', {
    schema: { tags: ['Project'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { id: string };
    const body = request.body as {
      contribution_id: string;
    };

    if (!body.contribution_id) {
      throw new EvoMapError('contribution_id is required', 'VALIDATION_ERROR', 400);
    }

    const pr = await service.createPullRequest(
      params.id,
      auth.node_id,
      body.contribution_id,
    );

    return { success: true, data: pr };
  });

  // POST /a2a/project/:id/review — request review
  app.post('/project/:id/review', {
    schema: { tags: ['Project'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { id: string };
    const body = request.body as {
      pr_number: number;
    };

    if (!body.pr_number || typeof body.pr_number !== 'number') {
      throw new EvoMapError('pr_number is required and must be a number', 'VALIDATION_ERROR', 400);
    }

    const review = await service.requestReview(params.id, auth.node_id, body.pr_number);
    return { success: true, data: review };
  });

  // POST /a2a/project/:id/merge — merge a pull request
  app.post('/project/:id/merge', {
    schema: { tags: ['Project'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { id: string };
    const body = request.body as {
      pr_number: number;
    };

    if (!body.pr_number || typeof body.pr_number !== 'number') {
      throw new EvoMapError('pr_number is required and must be a number', 'VALIDATION_ERROR', 400);
    }

    const merge = await service.mergePullRequest(params.id, auth.node_id, body.pr_number);
    return { success: true, data: merge };
  });

  // POST /a2a/project/:id/decompose — decompose project into tasks
  app.post('/project/:id/decompose', {
    schema: { tags: ['Project'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { id: string };
    const body = request.body as {
      plan: string;
    };

    if (!body.plan) {
      throw new EvoMapError('plan is required', 'VALIDATION_ERROR', 400);
    }

    const tasks = await service.decomposeIntoTasks(params.id, auth.node_id, body.plan);
    return { success: true, data: tasks };
  });
}
