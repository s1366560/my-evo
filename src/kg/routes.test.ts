import fastify, { type FastifyInstance } from 'fastify';
import { kgRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'node_secret',
};

const mockCreateNode = jest.fn();
const mockCreateRelationship = jest.fn();
const mockGetNode = jest.fn();
const mockGetNeighborhood = jest.fn();
const mockGetGraphStats = jest.fn();
const mockListNodesByType = jest.fn();

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (
    request: {
      auth?: {
        node_id: string;
        auth_type?: string;
      };
    },
  ) => {
    request.auth = mockAuth;
  },
}));

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  createNode: (...args: unknown[]) => mockCreateNode(...args),
  createRelationship: (...args: unknown[]) => mockCreateRelationship(...args),
  getNode: (...args: unknown[]) => mockGetNode(...args),
  getNeighborhood: (...args: unknown[]) => mockGetNeighborhood(...args),
  getGraphStats: (...args: unknown[]) => mockGetGraphStats(...args),
  listNodesByType: (...args: unknown[]) => mockListNodesByType(...args),
}));

function buildApp(): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', {
    asset: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    knowledgeGraphRelationship: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  } as any);
  return app;
}

describe('KG routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'node_secret',
    };
    app = buildApp();
    await app.register(kgRoutes, { prefix: '/api/v2/kg' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('supports the spec node creation shape with top-level id and name aliases', async () => {
    mockCreateNode.mockResolvedValue({
      id: 'concept_sentiment_analysis',
      type: 'concept',
      properties: {},
      created_at: '2025-01-01T00:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/kg/node',
      payload: {
        type: 'concept',
        id: 'concept_sentiment_analysis',
        name: 'Sentiment Analysis',
        properties: { domain: 'nlp' },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreateNode).toHaveBeenCalledWith(
      'concept',
      {
        id: 'concept_sentiment_analysis',
        name: 'Sentiment Analysis',
        domain: 'nlp',
      },
      'node-1',
    );
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      entity: {
        id: 'concept_sentiment_analysis',
        type: 'concept',
        properties: {},
        created_at: '2025-01-01T00:00:00.000Z',
        status: 'ok',
      },
      data: {
        id: 'concept_sentiment_analysis',
        type: 'concept',
        properties: {},
        created_at: '2025-01-01T00:00:00.000Z',
        status: 'ok',
      },
    });
  });

  it('rejects KG node creation when the caller is not using node_secret authentication', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/kg/node',
      payload: {
        type: 'concept',
        id: 'concept_sentiment_analysis',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(mockCreateNode).not.toHaveBeenCalled();
  });

  it('supports relationship alias fields from the architecture spec', async () => {
    mockCreateRelationship.mockResolvedValue({
      id: 'rel-1',
      from_id: 'gene_xxx',
      to_id: 'concept_sentiment_analysis',
      type: 'implements',
      properties: {},
      created_at: '2025-01-01T00:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/kg/relationship',
      payload: {
        source_type: 'gene',
        source_id: 'gene_xxx',
        target_type: 'concept',
        target_id: 'concept_sentiment_analysis',
        relationship_type: 'implements',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreateRelationship).toHaveBeenCalledWith(
      'gene_xxx',
      'concept_sentiment_analysis',
      'implements',
      undefined,
    );
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      relationship: {
        status: 'ok',
        relationship_id: 'rel-1',
        id: 'rel-1',
        from_id: 'gene_xxx',
        to_id: 'concept_sentiment_analysis',
        type: 'implements',
        properties: {},
        created_at: '2025-01-01T00:00:00.000Z',
      },
      data: {
        status: 'ok',
        relationship_id: 'rel-1',
        id: 'rel-1',
        from_id: 'gene_xxx',
        to_id: 'concept_sentiment_analysis',
        type: 'implements',
        properties: {},
        created_at: '2025-01-01T00:00:00.000Z',
      },
    });
  });

  it('exposes the architecture node detail route', async () => {
    mockGetNode.mockResolvedValue({
      type: 'gene',
      id: 'gene-1',
      name: 'Gene One',
      properties: { gdi_score: 88 },
      relationships: { outgoing: [], incoming: [] },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/kg/node/gene/gene-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetNode).toHaveBeenCalledWith('gene', 'gene-1');
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      entity: {
        type: 'gene',
        id: 'gene-1',
        name: 'Gene One',
        properties: { gdi_score: 88 },
        relationships: { outgoing: [], incoming: [] },
      },
      data: {
        type: 'gene',
        id: 'gene-1',
        name: 'Gene One',
        properties: { gdi_score: 88 },
        relationships: { outgoing: [], incoming: [] },
      },
    });
  });

  it('exposes the architecture neighborhood route with depth and relationship filters', async () => {
    mockGetNeighborhood.mockResolvedValue({
      center: { type: 'gene', id: 'gene-1' },
      neighbors: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/kg/node/gene/gene-1/neighbors?depth=2&relationship_type=derived_from',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetNeighborhood).toHaveBeenCalledWith('gene', 'gene-1', 2, 'derived_from');
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      neighborhood: {
        center: { type: 'gene', id: 'gene-1' },
        neighbors: [],
      },
      data: {
        center: { type: 'gene', id: 'gene-1' },
        neighbors: [],
      },
    });
  });

  it('exposes aggregate graph stats without authentication requirements', async () => {
    mockGetGraphStats.mockResolvedValue({
      total_nodes: 10,
      total_relationships: 5,
      node_types: { gene: 4 },
      relationship_types: { derived_from: 5 },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/kg/stats',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetGraphStats).toHaveBeenCalledWith();
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      total_nodes: 10,
      total_relationships: 5,
      node_types: { gene: 4 },
      relationship_types: { derived_from: 5 },
      data: {
        total_nodes: 10,
        total_relationships: 5,
        node_types: { gene: 4 },
        relationship_types: { derived_from: 5 },
      },
    });
  });

  it('lists published nodes by type with validated pagination', async () => {
    mockListNodesByType.mockResolvedValue({
      type: 'gene',
      nodes: [],
      total: 0,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/kg/types/gene?limit=10&offset=5',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListNodesByType).toHaveBeenCalledWith('gene', 10, 5);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      type: 'gene',
      nodes: [],
      total: 0,
      data: {
        type: 'gene',
        nodes: [],
        total: 0,
      },
    });
  });

  it('rejects invalid neighborhood depth values before calling the service', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/kg/node/gene/gene-1/neighbors?depth=0',
    });

    expect(response.statusCode).toBe(400);
    expect(mockGetNeighborhood).not.toHaveBeenCalled();
  });

  it('reports KG status with persisted edge counts included', async () => {
    (app as any).prisma.asset.count
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    (app as any).prisma.knowledgeGraphRelationship.count.mockResolvedValueOnce(4);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/kg/status',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).data).toEqual(expect.objectContaining({
      node_id: 'node-1',
      total_nodes: 6,
      total_edges: 6,
      my_nodes: 3,
      status: 'active',
    }));
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({
      success: true,
      node_id: 'node-1',
      total_nodes: 6,
      total_edges: 6,
      my_nodes: 3,
      connected_peers: 0,
      last_sync_at: expect.any(String),
      status: 'active',
    }));
  });

  it('includes explicit persisted relationships in my-graph responses', async () => {
    (app as any).prisma.asset.findMany
      .mockResolvedValueOnce([
        {
          asset_id: 'reading-1',
          asset_type: 'topic',
          name: 'Reading One',
          description: 'summary',
          signals: ['nlp'],
          tags: ['reading'],
          gdi_score: 0,
          author_id: 'node-1',
          parent_id: null,
          generation: 0,
          created_at: new Date('2025-01-01T00:00:00.000Z'),
        },
        {
          asset_id: 'topic-entity-1',
          asset_type: 'topic',
          name: 'NLP',
          description: 'entity',
          signals: ['nlp'],
          tags: ['reading-entity'],
          gdi_score: 0,
          author_id: 'node-1',
          parent_id: null,
          generation: 0,
          created_at: new Date('2025-01-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    (app as any).prisma.asset.count.mockResolvedValueOnce(2);
    (app as any).prisma.knowledgeGraphRelationship.findMany.mockResolvedValueOnce([
      {
        relationship_id: 'rel-1',
        from_id: 'reading-1',
        to_id: 'topic-entity-1',
        relationship_type: 'references',
        properties: { mentions: 2 },
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/kg/my-graph',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).data.relationships).toContainEqual({
      from_id: 'reading-1',
      to_id: 'topic-entity-1',
      type: 'references',
      properties: { mentions: 2 },
      relationship_id: 'rel-1',
    });
    expect(JSON.parse(response.payload)).toEqual(expect.objectContaining({
      success: true,
      node_id: 'node-1',
      nodes: expect.any(Array),
      relationships: expect.any(Array),
      total_nodes: 2,
      returned_nodes: 2,
      returned_relationships: 1,
    }));
  });
});
