import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import * as kgService from './service';

export async function kgRoutes(app: FastifyInstance): Promise<void> {
  app.post('/query', { preHandler: [requireAuth()] }, async (request, reply) => {
    const body = request.body as {
      query: string;
      depth?: number;
    };

    const result = await kgService.queryGraph(
      body.query,
      body.depth ?? 2,
    );

    return reply.send({ success: true, data: result });
  });

  app.post('/node', { preHandler: [requireAuth()] }, async (request, reply) => {
    const body = request.body as {
      type: string;
      properties: Record<string, unknown>;
    };

    const result = await kgService.createNode(
      body.type,
      body.properties,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.post(
    '/relationship',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const body = request.body as {
        from_id: string;
        to_id: string;
        type: string;
        properties?: Record<string, unknown>;
      };

      const result = await kgService.createRelationship(
        body.from_id,
        body.to_id,
        body.type,
        body.properties,
      );

      return reply.status(201).send({ success: true, data: result });
    },
  );

  app.get('/node/:nodeId/neighbors', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const { type, direction } = request.query as Record<string, string | undefined>;

    const result = await kgService.getNeighbors(
      nodeId,
      type,
      (direction as 'incoming' | 'outgoing' | 'both') ?? 'both',
    );

    return reply.send({ success: true, data: result });
  });

  app.get('/path', async (request, reply) => {
    const { from, to } = request.query as Record<string, string | undefined>;

    if (!from || !to) {
      return reply.status(400).send({
        success: false,
        error: 'Both "from" and "to" query parameters are required',
      });
    }

    const result = await kgService.getShortestPath(from, to);

    return reply.send({ success: true, data: result });
  });
}
