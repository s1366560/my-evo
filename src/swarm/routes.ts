/**
 * Swarm Module Routes
 * Multi-agent swarm coordination — task creation, subtask management, and result aggregation.
 *
 * Route Prefix: /api/v2/swarm
 * Frontend contract (see frontend/src/lib/api/client.ts):
 *   GET  /api/v2/swarm/tasks                         → list swarm tasks
 *   GET  /api/v2/swarm/tasks/:swarmId                 → task details
 *   POST /api/v2/swarm/tasks                          → create task
 *   POST /api/v2/swarm/tasks/:swarmId/subtasks        → create subtask
 *   POST /api/v2/swarm/tasks/:swarmId/subtasks/:id/complete → complete subtask
 *   POST /api/v2/swarm/tasks/:swarmId/complete        → complete task
 *   POST /api/v2/swarm/tasks/:swarmId/fail            → mark task failed
 *   POST /api/v2/swarm/tasks/:swarmId/cancel          → cancel task
 */

import type { FastifyInstance } from 'fastify';
import { requireNodeSecretAuth } from '../shared/auth';
import { ValidationError, NotFoundError } from '../shared/errors';
import * as swarmService from './service';
import type { SwarmTaskStatus } from './types';

// ============================================================
// Helpers
// ============================================================

function ensureNodeSecretAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ValidationError('Node secret credentials are required');
  }
  if (!auth.node_id) {
    throw new ValidationError('Node ID not found in authentication context');
  }
}

const VALID_STATUSES: SwarmTaskStatus[] = [
  'pending', 'recruiting', 'running', 'in_progress',
  'aggregating', 'completed', 'failed',
];

// ============================================================
// Routes
// ============================================================

export async function swarmRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /api/v2/swarm/tasks ────────────────────────────
  app.get<{
    Querystring: { status?: string; limit?: string; offset?: string };
  }>('/tasks', {
    schema: {
      tags: ['Swarm'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { status, limit, offset } = request.query;
    const statusFilter = status && VALID_STATUSES.includes(status as SwarmTaskStatus)
      ? (status as SwarmTaskStatus)
      : undefined;

    const result = await swarmService.listSwarmTasks(app.prisma, {
      status: statusFilter,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    void reply.send({
      success: true,
      swarms: result.tasks,
      meta: {
        total: result.total,
        limit: parseInt(limit ?? '50', 10),
        offset: parseInt(offset ?? '0', 10),
      },
    });
  });

  // ── GET /api/v2/swarm/tasks/:swarmId ───────────────────
  app.get<{ Params: { swarmId: string } }>(
    '/tasks/:swarmId',
    {
      schema: {
        tags: ['Swarm'],
        params: {
          type: 'object',
          properties: { swarmId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { swarmId } = request.params;
      const task = await swarmService.getSwarmTask(app.prisma, swarmId);

      if (!task) {
        void reply.status(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: `Swarm task '${swarmId}' not found`,
        });
        return;
      }

      void reply.send({
        success: true,
        swarm: task,
        subtasks: task.subtasks,
      });
    },
  );

  // ── POST /api/v2/swarm/tasks ────────────────────────────
  app.post('/tasks', {
    schema: {
      tags: ['Swarm'],
      body: {
        type: 'object',
        required: ['title', 'description'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', minLength: 5, maxLength: 5000 },
          timeout_ms: { type: 'number' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);

    const body = request.body as {
      title: string;
      description: string;
      timeout_ms?: number;
    };

    try {
      const task = await swarmService.createSwarmTask(app.prisma, {
        creator_id: auth.node_id!,
        title: body.title,
        description: body.description,
        timeout_ms: body.timeout_ms,
      });

      void reply.status(201).send({
        success: true,
        swarm: task,
        message: 'Swarm task created',
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        void reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  // ── POST /api/v2/swarm/tasks/:swarmId/subtasks ──────────
  app.post<{ Params: { swarmId: string } }>(
    '/tasks/:swarmId/subtasks',
    {
      schema: {
        tags: ['Swarm'],
        params: {
          type: 'object',
          properties: { swarmId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['title', 'description'],
          properties: {
            title: { type: 'string', minLength: 2, maxLength: 200 },
            description: { type: 'string', minLength: 1, maxLength: 2000 },
            assigned_to: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { swarmId } = request.params;
      const body = request.body as {
        title: string;
        description: string;
        assigned_to?: string;
      };

      try {
        const subtask = await swarmService.createSubtask(app.prisma, {
          swarm_id: swarmId,
          title: body.title,
          description: body.description,
          assigned_to: body.assigned_to,
        });

        void reply.status(201).send({
          success: true,
          subtask,
          message: 'Subtask created',
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
          void reply.status(error.statusCode).send({
            success: false,
            error: error.code,
            message: error.message,
          });
          return;
        }
        throw error;
      }
    },
  );

  // ── POST /api/v2/swarm/tasks/:swarmId/subtasks/:subtaskId/complete ──
  app.post<{ Params: { swarmId: string; subtaskId: string } }>(
    '/tasks/:swarmId/subtasks/:subtaskId/complete',
    {
      schema: {
        tags: ['Swarm'],
        params: {
          type: 'object',
          properties: {
            swarmId: { type: 'string' },
            subtaskId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['result'],
          properties: {
            result: { type: 'string' },
          },
        },
      },
      preHandler: requireNodeSecretAuth(),
    },
    async (request, reply) => {
      const auth = request.auth!;
      ensureNodeSecretAuth(auth);

      const { subtaskId } = request.params;
      const body = request.body as { result: string };

      try {
        const { subtask, swarmStatus } = await swarmService.completeSubtask(
          app.prisma,
          {
            subtask_id: subtaskId,
            result: body.result,
            worker_id: auth.node_id!,
          }
        );

        void reply.send({
          success: true,
          subtask,
          swarm_status: swarmStatus,
          message: 'Subtask completed',
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
          void reply.status(error.statusCode).send({
            success: false,
            error: error.code,
            message: error.message,
          });
          return;
        }
        throw error;
      }
    },
  );

  // ── POST /api/v2/swarm/tasks/:swarmId/complete ───────────
  app.post<{ Params: { swarmId: string } }>(
    '/tasks/:swarmId/complete',
    {
      schema: {
        tags: ['Swarm'],
        params: {
          type: 'object',
          properties: { swarmId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['aggregated_output'],
          properties: {
            aggregated_output: { type: 'string' },
            quality_score: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { swarmId } = request.params;
      const body = request.body as {
        aggregated_output: string;
        quality_score?: number;
      };

      try {
        const task = await swarmService.completeSwarmTask(app.prisma, {
          swarm_id: swarmId,
          aggregated_output: body.aggregated_output,
          quality_score: body.quality_score,
        });

        void reply.send({
          success: true,
          swarm: task,
          message: 'Swarm task completed',
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
          void reply.status(error.statusCode).send({
            success: false,
            error: error.code,
            message: error.message,
          });
          return;
        }
        throw error;
      }
    },
  );

  // ── POST /api/v2/swarm/tasks/:swarmId/fail ──────────────
  app.post<{ Params: { swarmId: string } }>(
    '/tasks/:swarmId/fail',
    {
      schema: {
        tags: ['Swarm'],
        params: {
          type: 'object',
          properties: { swarmId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { swarmId } = request.params;
      const body = request.body as { reason: string };

      try {
        const task = await swarmService.failSwarmTask(
          app.prisma,
          swarmId,
          body.reason
        );

        void reply.send({
          success: true,
          swarm: task,
          message: 'Swarm task marked as failed',
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
          void reply.status(error.statusCode).send({
            success: false,
            error: error.code,
            message: error.message,
          });
          return;
        }
        throw error;
      }
    },
  );

  // ── POST /api/v2/swarm/tasks/:swarmId/cancel ────────────
  app.post<{ Params: { swarmId: string } }>(
    '/tasks/:swarmId/cancel',
    {
      schema: {
        tags: ['Swarm'],
        params: {
          type: 'object',
          properties: { swarmId: { type: 'string' } },
        },
      },
      preHandler: requireNodeSecretAuth(),
    },
    async (request, reply) => {
      const auth = request.auth!;
      ensureNodeSecretAuth(auth);

      const { swarmId } = request.params;

      try {
        const result = await swarmService.cancelSwarmTask(
          app.prisma,
          swarmId,
          auth.node_id!
        );

        void reply.send({
          ...result,
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
          void reply.status(error.statusCode).send({
            success: false,
            error: error.code,
            message: error.message,
          });
          return;
        }
        throw error;
      }
    },
  );
}
