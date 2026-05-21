/**
 * A2A Protocol Routes
 * Agent-to-agent communication endpoints
 */

import type { FastifyInstance } from 'fastify';
import { requireNodeSecretAuth } from '../shared/auth';
import * as a2aService from './service';
import type {
  HelloRequest,
  HeartbeatRequest,
  PublishRequest,
  FetchRequest,
  SearchRequest,
  ReportRequest,
} from './types';

export async function a2aRoutes(app: FastifyInstance): Promise<void> {
  // ===== Public Endpoints =====

  /**
   * POST /a2a/hello - Node handshake
   */
  app.post('/hello', {
    schema: {
      tags: ['A2A'],
      body: {
        type: 'object',
        required: ['node_id', 'model'],
        properties: {
          node_id: { type: 'string' },
          model: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
          endpoint: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const req = request.body as HelloRequest;
    const result = await a2aService.processHello(app.prisma, req);
    return reply.send(result);
  });

  /**
   * POST /a2a/heartbeat - Heartbeat
   */
  app.post('/heartbeat', {
    schema: {
      tags: ['A2A'],
      body: {
        type: 'object',
        required: ['node_id'],
        properties: {
          node_id: { type: 'string' },
          timestamp: { type: 'string' },
          load_metrics: {
            type: 'object',
            properties: {
              cpu_usage: { type: 'number' },
              memory_usage: { type: 'number' },
              active_tasks: { type: 'number' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const req = request.body as HeartbeatRequest;
    const result = await a2aService.processHeartbeat(app.prisma, req);
    return reply.send(result);
  });

  /**
   * POST /a2a/fetch - Fetch node/asset
   */
  app.post('/fetch', {
    schema: {
      tags: ['A2A'],
      body: {
        type: 'object',
        required: ['node_id', 'target_id', 'resource_type'],
        properties: {
          node_id: { type: 'string' },
          target_id: { type: 'string' },
          resource_type: { type: 'string', enum: ['node', 'asset'] },
        },
      },
    },
  }, async (request, reply) => {
    const req = request.body as FetchRequest;
    const result = await a2aService.processFetch(app.prisma, req);
    if (!result.success) {
      return reply.status(404).send(result);
    }
    return reply.send(result);
  });

  /**
   * POST /a2a/search - Search directory
   */
  app.post('/search', {
    schema: {
      tags: ['A2A'],
      body: {
        type: 'object',
        required: ['node_id', 'query'],
        properties: {
          node_id: { type: 'string' },
          query: { type: 'string' },
          filters: {
            type: 'object',
            properties: {
              capability: { type: 'string' },
              trust_level_min: { type: 'number' },
              status: { type: 'string' },
            },
          },
          limit: { type: 'number', default: 10 },
        },
      },
    },
  }, async (request, reply) => {
    const req = request.body as SearchRequest;
    const result = await a2aService.processSearch(app.prisma, req);
    return reply.send(result);
  });

  /**
   * GET /a2a/directory - List nodes
   */
  app.get('/directory', {
    schema: {
      tags: ['A2A'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 100 },
        },
      },
    },
  }, async (request, reply) => {
    const { limit } = request.query as { limit?: number };
    const result = await a2aService.getDirectory(app.prisma, limit);
    return reply.send(result);
  });

  /**
   * GET /a2a/nodes/:nodeId - Get specific node
   */
  app.get<{ Params: { nodeId: string } }>('/nodes/:nodeId', {
    schema: {
      tags: ['A2A'],
      params: {
        type: 'object',
        required: ['nodeId'],
        properties: {
          nodeId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { nodeId } = request.params;
    const result = await a2aService.getNodeDetail(app.prisma, nodeId);
    if (!result) {
      return reply.status(404).send({ success: false, error: 'Node not found' });
    }
    return reply.send(result);
  });

  /**
   * GET /a2a/help - Help info
   */
  app.get('/help', {
    schema: { tags: ['A2A'] },
  }, async (_request, reply) => {
    return reply.send(a2aService.getHelp());
  });

  // ===== Authenticated Endpoints =====

  /**
   * POST /a2a/publish - Publish capability (auth required)
   */
  app.post('/publish', {
    schema: {
      tags: ['A2A'],
      body: {
        type: 'object',
        required: ['node_id', 'capabilities'],
        properties: {
          node_id: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const req = request.body as PublishRequest;
    const auth = request.auth!;
    if (req.node_id !== auth.node_id) {
      return reply.status(403).send({
        success: false,
        error: 'Forbidden',
        message: 'Node ID mismatch',
      });
    }
    const result = await a2aService.processPublish(app.prisma, req);
    return reply.send(result);
  });

  /**
   * POST /a2a/report - Report status (auth required)
   */
  app.post('/report', {
    schema: {
      tags: ['A2A'],
      body: {
        type: 'object',
        required: ['node_id', 'report_type', 'data'],
        properties: {
          node_id: { type: 'string' },
          report_type: { type: 'string', enum: ['status', 'metrics', 'reputation'] },
          data: { type: 'object' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const req = request.body as ReportRequest;
    const auth = request.auth!;
    if (req.node_id !== auth.node_id) {
      return reply.status(403).send({
        success: false,
        error: 'Forbidden',
        message: 'Node ID mismatch',
      });
    }
    const result = await a2aService.processReport(app.prisma, req);
    return reply.send(result);
  });

  /**
   * GET /a2a/billing/earnings - Earnings (auth required)
   */
  app.get('/billing/earnings', {
    schema: {
      tags: ['A2A'],
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', default: 'month' },
        },
      },
    },
    preHandler: requireNodeSecretAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { period } = request.query as { period?: string };
    const result = await a2aService.getEarnings(app.prisma, auth.node_id!, period);
    return reply.send(result);
  });
}
