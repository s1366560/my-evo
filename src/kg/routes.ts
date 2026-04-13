import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import * as kgService from './service';

export async function kgRoutes(app: FastifyInstance): Promise<void> {
  const prisma = app.prisma;

  app.post('/query', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
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

  app.post('/node', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      type: string;
      properties: Record<string, unknown>;
    };

    const result = await kgService.createNode(
      body.type,
      body.properties,
      auth.node_id,
    );

    return reply.status(201).send({ success: true, data: result });
  });

  app.post('/relationship', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
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
  });

  app.get('/node/:nodeId/neighbors', {
    schema: { tags: ['KnowledgeGraph'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const { type, direction } = request.query as Record<string, string | undefined>;

    const result = await kgService.getNeighbors(
      nodeId,
      type,
      (direction as 'incoming' | 'outgoing' | 'both') ?? 'both',
    );

    return reply.send({ success: true, data: result });
  });

  app.get('/path', {
    schema: { tags: ['KnowledgeGraph'] },
  }, async (request, reply) => {
    const { from, to } = request.query as Record<string, string | undefined>;

    if (!from || !to) {
      throw new ValidationError('Both "from" and "to" query parameters are required');
    }

    const result = await kgService.getShortestPath(from, to);

    return reply.send({ success: true, data: result });
  });

  // ─── KG Hub extensions ─────────────────────────────────────────────────────────

  // POST /api/hub/kg/ingest — ingest entities and relationships into the KG
  app.post('/ingest', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      entities?: Array<{ type: string; properties: Record<string, unknown> }>;
      relationships?: Array<{ from_id: string; to_id: string; type: string; properties?: Record<string, unknown> }>;
    };

    const entities = body.entities ?? [];
    const relationships = body.relationships ?? [];
    const results: Array<{ action: string; id?: string; error?: string }> = [];

    for (const entity of entities) {
      try {
        const node = await kgService.createNode(
          entity.type,
          entity.properties,
          auth.node_id,
        );
        results.push({ action: 'entity_created', id: node.id });
      } catch (err) {
        results.push({ action: 'entity_failed', error: (err as Error).message });
      }
    }

    for (const rel of relationships) {
      try {
        const relationship = await kgService.createRelationship(rel.from_id, rel.to_id, rel.type, rel.properties);
        results.push({ action: 'relationship_created', id: relationship.id });
      } catch (err) {
        results.push({ action: 'relationship_failed', error: (err as Error).message });
      }
    }

    return reply.status(201).send({
      success: true,
      data: {
        node_id: auth.node_id,
        ingested_at: new Date().toISOString(),
        entities_count: entities.length,
        relationships_count: relationships.length,
        results,
      },
    });
  });

  // GET /api/hub/kg/status — KG status for authenticated node
  app.get('/status', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;

    const [totalNodes, totalRelationships, myNodes] = await Promise.all([
      prisma.asset.count(),
      // Count relationships via assets with parent_id
      prisma.asset.count({ where: { parent_id: { not: null } } }),
      prisma.asset.count({ where: { author_id: auth.node_id } }),
    ]);

    return {
      success: true,
      data: {
        node_id: auth.node_id,
        total_nodes: totalNodes,
        total_edges: totalRelationships,
        my_nodes: myNodes,
        connected_peers: 0,
        last_sync_at: new Date().toISOString(),
        status: 'active',
      },
    };
  });

  // GET /api/hub/kg/my-graph — personal knowledge graph for authenticated node
  app.get('/my-graph', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const query = request.query as { type?: string; limit?: string; offset?: string };

    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    // Fetch all assets authored by this node
    const where: { author_id: string; asset_type?: string } = { author_id: auth.node_id };
    if (query.type) {
      where.asset_type = query.type;
    }

    const [nodes, total] = await Promise.all([
      prisma.asset.findMany({
        where: where as Record<string, unknown>,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.asset.count({ where: where as Record<string, unknown> }),
    ]);

    // Build relationships for these nodes (parent-child + signal-sharing)
    const nodeIds = new Set(nodes.map((n) => n.asset_id));
    const relationships = [];

    for (const node of nodes) {
      // Parent edge
      if (node.parent_id && nodeIds.has(node.parent_id)) {
        relationships.push({
          from_id: node.asset_id,
          to_id: node.parent_id,
          type: 'derived_from',
          properties: { generation: node.generation },
        });
      }
      // Child edges
      const children = await prisma.asset.findMany({
        where: { parent_id: node.asset_id },
        select: { asset_id: true, generation: true },
        take: 5,
      });
      for (const child of children) {
        relationships.push({
          from_id: child.asset_id,
          to_id: node.asset_id,
          type: 'derived_from',
          properties: { generation: child.generation },
        });
      }
    }

    const kgNodes = nodes.map((a) => ({
      id: a.asset_id,
      type: a.asset_type,
      properties: {
        name: a.name,
        description: a.description,
        signals: a.signals,
        tags: a.tags,
        gdi_score: a.gdi_score,
        author_id: a.author_id,
      },
      created_at: a.created_at.toISOString(),
    }));

    return {
      success: true,
      data: {
        node_id: auth.node_id,
        nodes: kgNodes,
        relationships,
        meta: { total_nodes: total, returned_nodes: nodes.length, returned_relationships: relationships.length },
      },
    };
  });
}
