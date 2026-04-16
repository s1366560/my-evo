import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { UnauthorizedError, ValidationError } from '../shared/errors';
import * as kgService from './service';

function requireNodeSecretAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
  action: string,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new UnauthorizedError(`${action} requires node secret authentication`);
  }
}

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

    return reply.send({
      success: true,
      entities: result.nodes,
      relationships: result.relationships,
      total: result.nodes.length,
      data: result,
    });
  });

  app.post('/node', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    requireNodeSecretAuth(auth, 'KG node creation');
    const body = request.body as {
      type: string;
      id?: string;
      name?: string;
      properties?: Record<string, unknown>;
    };
    const properties = { ...(body.properties ?? {}) };
    if (body.id !== undefined) {
      properties.id = body.id;
    }
    if (body.name !== undefined) {
      properties.name = body.name;
    }

    const result = await kgService.createNode(
      body.type,
      properties,
      auth.node_id,
    );

    return reply.status(201).send({
      success: true,
      entity: {
        ...result,
        status: 'ok',
      },
      data: {
        ...result,
        status: 'ok',
      },
    });
  });

  app.post('/relationship', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    requireNodeSecretAuth(auth, 'KG relationship creation');
    const body = request.body as {
      from_id?: string;
      to_id?: string;
      source_id?: string;
      target_id?: string;
      source_type?: string;
      target_type?: string;
      type?: string;
      relationship_type?: string;
      properties?: Record<string, unknown>;
    };
    const fromId = body.from_id ?? body.source_id;
    const toId = body.to_id ?? body.target_id;
    const relationshipType = body.type ?? body.relationship_type;

    if (!fromId || !toId || !relationshipType) {
      throw new ValidationError('from_id/source_id, to_id/target_id, and type/relationship_type are required');
    }

    const result = await kgService.createRelationship(
      fromId,
      toId,
      relationshipType,
      body.properties,
    );

    return reply.status(201).send({
      success: true,
      relationship: {
        status: 'ok',
        relationship_id: result.id,
        ...result,
      },
      data: {
        status: 'ok',
        relationship_id: result.id,
        ...result,
      },
    });
  });

  app.get('/node/:type/:id', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { type, id } = request.params as { type: string; id: string };
    const result = await kgService.getNode(type, id);
    return reply.send({ success: true, entity: result, data: result });
  });

  app.get('/node/:type/:id/neighbors', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { type, id } = request.params as { type: string; id: string };
    const query = request.query as { depth?: string; relationship_type?: string };
    const depth = query.depth === undefined ? 1 : parseInt(query.depth, 10);

    if (!Number.isInteger(depth) || depth < 1 || depth > 5) {
      throw new ValidationError('depth must be an integer between 1 and 5');
    }

    const result = await kgService.getNeighborhood(type, id, depth, query.relationship_type);
    return reply.send({ success: true, neighborhood: result, data: result });
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

    return reply.send({ success: true, neighbors: result, total: result.length, data: result });
  });

  app.get('/stats', {
    schema: { tags: ['KnowledgeGraph'] },
  }, async (_request, reply) => {
    const result = await kgService.getGraphStats();
    return reply.send({ success: true, ...result, data: result });
  });

  app.get('/types/:type', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { type } = request.params as { type: string };
    const query = request.query as { limit?: string; offset?: string };
    const limit = query.limit === undefined ? 50 : parseInt(query.limit, 10);
    const offset = query.offset === undefined ? 0 : parseInt(query.offset, 10);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ValidationError('limit must be an integer between 1 and 100');
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ValidationError('offset must be a non-negative integer');
    }

    const result = await kgService.listNodesByType(type, limit, offset);
    return reply.send({ success: true, type, nodes: result.nodes, total: result.total, data: result });
  });

  app.get('/path', {
    schema: { tags: ['KnowledgeGraph'] },
  }, async (request, reply) => {
    const { from, to } = request.query as Record<string, string | undefined>;

    if (!from || !to) {
      throw new ValidationError('Both "from" and "to" query parameters are required');
    }

    const result = await kgService.getShortestPath(from, to);

    return reply.send({ success: true, path: result.path, length: result.length, found: result.found, data: result });
  });

  // ─── KG Hub extensions ─────────────────────────────────────────────────────────

  // POST /api/hub/kg/ingest — ingest entities and relationships into the KG
  app.post('/ingest', {
    schema: { tags: ['KnowledgeGraph'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    requireNodeSecretAuth(auth, 'KG ingest');
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

    const ingestedAt = new Date().toISOString();
    return reply.status(201).send({
      success: true,
      node_id: auth.node_id,
      ingested_at: ingestedAt,
      entities_count: entities.length,
      relationships_count: relationships.length,
      results,
      data: {
        node_id: auth.node_id,
        ingested_at: ingestedAt,
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
    const lastSyncAt = new Date().toISOString();

    const [totalNodes, derivedRelationships, explicitRelationships, myNodes] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.count({ where: { parent_id: { not: null } } }),
      prisma.knowledgeGraphRelationship.count(),
      prisma.asset.count({ where: { author_id: auth.node_id } }),
    ]);

    return {
      success: true,
      node_id: auth.node_id,
      total_nodes: totalNodes,
      total_edges: derivedRelationships + explicitRelationships,
      my_nodes: myNodes,
      connected_peers: 0,
      last_sync_at: lastSyncAt,
      status: 'active',
      data: {
        node_id: auth.node_id,
        total_nodes: totalNodes,
        total_edges: derivedRelationships + explicitRelationships,
        my_nodes: myNodes,
        connected_peers: 0,
        last_sync_at: lastSyncAt,
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

    // Build relationships for these nodes (parent-child + persisted KG relationships)
    const nodeIds = new Set(nodes.map((n) => n.asset_id));
    const relationships = [];
    const explicitRelationships = nodeIds.size > 0
      ? await prisma.knowledgeGraphRelationship.findMany({
        where: {
          from_id: { in: [...nodeIds] },
          to_id: { in: [...nodeIds] },
        },
        select: {
          relationship_id: true,
          from_id: true,
          to_id: true,
          relationship_type: true,
          properties: true,
        },
        orderBy: { created_at: 'desc' },
      })
      : [];

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

    for (const relationship of explicitRelationships) {
      relationships.push({
        from_id: relationship.from_id,
        to_id: relationship.to_id,
        type: relationship.relationship_type,
        properties: relationship.properties ?? {},
        relationship_id: relationship.relationship_id,
      });
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
      node_id: auth.node_id,
      nodes: kgNodes,
      relationships,
      total_nodes: total,
      returned_nodes: nodes.length,
      returned_relationships: relationships.length,
      data: {
        node_id: auth.node_id,
        nodes: kgNodes,
        relationships,
        meta: { total_nodes: total, returned_nodes: nodes.length, returned_relationships: relationships.length },
      },
    };
  });
}
