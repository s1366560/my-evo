import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { NotFoundError, ValidationError } from '../shared/errors';

const {
  queryGraph,
  createNode,
  getNode,
  getNeighborhood,
  getGraphStats,
  listNodesByType,
  createRelationship,
  getNeighbors,
  getShortestPath,
  deleteNode,
  getShortestPathPostgres,
  shortestPathPostgres,
  findSimilarAssetsPostgres,
  findRelatedCapabilitiesPostgres,
} = service;

const makeAsset = (overrides: Record<string, unknown> = {}) => ({
  asset_id: 'asset-1',
  asset_type: 'gene',
  name: 'Test Asset',
  description: 'A test asset',
  signals: ['signal-a'],
  tags: ['tag-a'],
  gdi_score: 50,
  author_id: 'node-1',
  parent_id: null,
  generation: 1,
  created_at: new Date('2025-01-01'),
  status: 'published',
  ...overrides,
});

const mockPrisma = {
  asset: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  knowledgeGraphRelationship: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
} as any;

// Helper: fully reset mocks and re-establish default empty behavior
function resetMocks(): void {
  (mockPrisma.asset.findMany as any).mockReset();
  (mockPrisma.asset.findUnique as any).mockReset();
  (mockPrisma.asset.count as any).mockReset();
  (mockPrisma.asset.upsert as any).mockReset();
  (mockPrisma.asset.delete as any).mockReset();
  (mockPrisma.knowledgeGraphRelationship.findMany as any).mockReset();
  (mockPrisma.knowledgeGraphRelationship.upsert as any).mockReset();
  (mockPrisma.knowledgeGraphRelationship.deleteMany as any).mockReset();
  // Re-establish default that returns empty arrays/objects for simple cases
  mockPrisma.asset.findMany.mockResolvedValue([]);
  mockPrisma.asset.findUnique.mockResolvedValue(null);
  mockPrisma.asset.count.mockResolvedValue(0);
  mockPrisma.asset.upsert.mockResolvedValue({});
  mockPrisma.asset.delete.mockResolvedValue({});
  mockPrisma.knowledgeGraphRelationship.findMany.mockResolvedValue([]);
  mockPrisma.knowledgeGraphRelationship.upsert.mockResolvedValue({});
  mockPrisma.knowledgeGraphRelationship.deleteMany.mockResolvedValue({ count: 0 });
}

describe('Knowledge Graph Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
    mockPrisma.asset.count.mockResolvedValue(0);
  });

  describe('queryGraph', () => {
    it('should return matching nodes and relationships', async () => {
      const assets = [
        makeAsset({ asset_id: 'a1', signals: ['sig-a'], parent_id: 'a2' }),
        makeAsset({ asset_id: 'a2', signals: ['sig-a', 'sig-b'] }),
      ];

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(assets)
        .mockResolvedValue([]);

      const result = await queryGraph('test', 1);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0]!.id).toBe('a1');
      expect(result.nodes[0]!.type).toBe('gene');
      expect(result.nodes[0]!.properties.name).toBe('Test Asset');
    });

    it('should include derived_from relationships for parent-child', async () => {
      const assets = [
        makeAsset({ asset_id: 'child-1', parent_id: 'parent-1', signals: ['sig-a'] }),
        makeAsset({ asset_id: 'parent-1', signals: ['sig-a'] }),
      ];

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(assets)
        .mockResolvedValue([]);

      const result = await queryGraph('test', 1);

      const derived = result.relationships.find(
        (r) => r.type === 'derived_from',
      );
      expect(derived).toBeDefined();
      expect(derived!.from_id).toBe('child-1');
      expect(derived!.to_id).toBe('parent-1');
    });

    it('should include shares_signals relationships at depth > 1', async () => {
      const assets = [
        makeAsset({ asset_id: 'a1', signals: ['sig-a', 'sig-b'] }),
        makeAsset({ asset_id: 'a2', signals: ['sig-a', 'sig-c'] }),
      ];

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(assets)
        .mockResolvedValue([makeAsset({ asset_id: 'a2', signals: ['sig-a'] })]);

      const result = await queryGraph('test', 2);

      expect(result.nodes).toHaveLength(2);
    });

    it('should return empty result when no matches', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await queryGraph('nonexistent');

      expect(result.nodes).toEqual([]);
      expect(result.relationships).toEqual([]);
    });
  });

  describe('createNode', () => {
    it('should create a new node with default values', async () => {
      const created = makeAsset({
        asset_id: 'new-1',
        asset_type: 'gene',
        name: 'Test Node',
        description: 'Desc',
        signals: ['sig-1'],
        tags: [],
        author_id: 'node-1',
        status: 'published',
        gdi_score: 0,
      });

      mockPrisma.asset.upsert.mockResolvedValue(created);

      const result = await createNode('gene', {
        name: 'Test Node',
        description: 'Desc',
        signals: ['sig-1'],
        author_id: 'node-1',
      }, 'node-1');

      expect(result.id).toBe('new-1');
      expect(result.type).toBe('gene');
      expect(result.properties.name).toBe('Test Node');
      expect(result.properties.signals).toEqual(['sig-1']);
      expect(mockPrisma.asset.upsert).toHaveBeenCalledWith({
        where: { asset_id: expect.any(String) },
        update: expect.objectContaining({
          tags: ['kg:entity'],
          status: 'published',
        }),
        create: expect.objectContaining({
          tags: ['kg:entity'],
          status: 'published',
        }),
      });
    });

    it('should throw ValidationError when type is empty', async () => {
      await expect(createNode('', { name: 'Test' }, 'node-1')).rejects.toThrow(
        ValidationError,
      );
    });

    it('should use default values for missing properties', async () => {
      const created = makeAsset({
        asset_id: 'new-2',
        name: 'Untitled',
        description: '',
        signals: [],
        tags: ['kg:entity'],
        author_id: 'system',
      });

      mockPrisma.asset.upsert.mockResolvedValue(created);

      const result = await createNode('gene', {}, 'node-1');

      expect(result.properties.name).toBe('Untitled');
      expect(result.properties.description).toBe('');
    });

    it('should preserve provided tags and append the KG entity tag once', async () => {
      const created = makeAsset({
        asset_id: 'new-3',
        tags: ['custom', 'kg:entity'],
      });

      mockPrisma.asset.upsert.mockResolvedValue(created);

      await createNode('gene', {
        tags: ['custom', 'kg:entity'],
      }, 'node-1');

      expect(mockPrisma.asset.upsert).toHaveBeenCalledWith({
        where: { asset_id: expect.any(String) },
        update: expect.objectContaining({
          tags: ['custom', 'kg:entity'],
        }),
        create: expect.objectContaining({
          tags: ['custom', 'kg:entity'],
        }),
      });
    });

    it('should ignore spoofed author_id and use the authenticated author id', async () => {
      const created = makeAsset({
        asset_id: 'new-4',
        author_id: 'node-auth',
        tags: ['kg:entity'],
      });

      mockPrisma.asset.upsert.mockResolvedValue(created);

      await createNode('gene', {
        author_id: 'spoofed-node',
      }, 'node-auth');

      expect(mockPrisma.asset.upsert).toHaveBeenCalledWith({
        where: { asset_id: expect.any(String) },
        update: expect.any(Object),
        create: expect.objectContaining({
          author_id: 'node-auth',
        }),
      });
    });

    it('should preserve an explicit KG node id when one is provided', async () => {
      const created = makeAsset({
        asset_id: 'concept_sentiment_analysis',
        asset_type: 'concept',
        tags: ['kg:entity'],
        status: 'draft',
      });

      mockPrisma.asset.upsert.mockResolvedValue(created);

      const result = await createNode('concept', {
        id: 'concept_sentiment_analysis',
        name: 'Sentiment Analysis',
      }, 'node-1');

      expect(result.id).toBe('concept_sentiment_analysis');
      expect(mockPrisma.asset.upsert).toHaveBeenCalledWith({
        where: { asset_id: 'concept_sentiment_analysis' },
        update: expect.objectContaining({
          asset_type: 'concept',
        }),
        create: expect.objectContaining({
          asset_id: 'concept_sentiment_analysis',
          asset_type: 'concept',
        }),
      });
    });
  });

  describe('getNode', () => {
    it('should return a published node detail with incoming and outgoing relationships', async () => {
      mockPrisma.asset.findUnique.mockResolvedValueOnce(
        makeAsset({ asset_id: 'gene-1', asset_type: 'gene', parent_id: 'gene-base' }),
      );
      mockPrisma.asset.findMany.mockResolvedValueOnce([
        makeAsset({ asset_id: 'gene-child', parent_id: 'gene-1' }),
      ]);

      const result = await getNode('gene', 'gene-1');

      expect(result).toEqual({
        type: 'gene',
        id: 'gene-1',
        name: 'Test Asset',
        properties: expect.objectContaining({
          gdi_score: 50,
          author: 'node-1',
          signals: ['signal-a'],
        }),
        relationships: {
          outgoing: [{ type: 'derived_from', target: 'gene-base' }],
          incoming: [{ type: 'derived_from', source: 'gene-child' }],
        },
      });
    });

    it('should include persisted explicit relationships in node detail', async () => {
      mockPrisma.asset.findUnique.mockResolvedValueOnce(
        makeAsset({ asset_id: 'gene-1', asset_type: 'gene', parent_id: null }),
      );
      mockPrisma.asset.findMany.mockResolvedValueOnce([]);
      mockPrisma.knowledgeGraphRelationship.findMany
        .mockResolvedValueOnce([
          {
            relationship_id: 'rel-explicit-out',
            from_id: 'gene-1',
            to_id: 'topic-1',
            relationship_type: 'references',
            properties: {},
            created_at: new Date('2025-01-01'),
          },
        ])
        .mockResolvedValueOnce([
          {
            relationship_id: 'rel-explicit-in',
            from_id: 'topic-2',
            to_id: 'gene-1',
            relationship_type: 'depends_on',
            properties: {},
            created_at: new Date('2025-01-02'),
          },
        ]);

      const result = await getNode('gene', 'gene-1');

      expect(result.relationships.outgoing).toContainEqual({
        type: 'references',
        target: 'topic-1',
      });
      expect(result.relationships.incoming).toContainEqual({
        type: 'depends_on',
        source: 'topic-2',
      });
    });

    it('should hide nodes that are not published or do not match the requested type', async () => {
      mockPrisma.asset.findUnique.mockResolvedValueOnce(
        makeAsset({ asset_id: 'gene-1', asset_type: 'capsule', status: 'draft' }),
      );

      await expect(getNode('gene', 'gene-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getNeighborhood', () => {
    it('should walk derived_from neighbors up to the requested depth', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(
          makeAsset({ asset_id: 'gene-1', asset_type: 'gene', parent_id: 'gene-base' }),
        )
        .mockResolvedValueOnce(
          makeAsset({ asset_id: 'gene-base', asset_type: 'gene', parent_id: 'gene-root' }),
        )
        .mockResolvedValueOnce(
          makeAsset({ asset_id: 'gene-root', asset_type: 'gene', parent_id: null }),
        );
      mockPrisma.asset.findMany
        .mockResolvedValueOnce([]) // children of gene-1
        .mockResolvedValueOnce([]); // children of gene-base

      const result = await getNeighborhood('gene', 'gene-1', 2, 'derived_from');

      expect(result.center).toEqual({ type: 'gene', id: 'gene-1' });
      expect(result.neighbors).toEqual([
        { type: 'gene', id: 'gene-base', distance: 1, relationship: 'derived_from' },
        { type: 'gene', id: 'gene-root', distance: 2, relationship: 'derived_from' },
      ]);
    });
  });

  describe('getGraphStats', () => {
    it('should aggregate node types and inferred relationship counts', async () => {
      mockPrisma.asset.findMany.mockResolvedValueOnce([
        makeAsset({ asset_id: 'gene-1', asset_type: 'gene', parent_id: 'gene-base', signals: ['sig-a'] }),
        makeAsset({ asset_id: 'gene-2', asset_type: 'gene', signals: ['sig-a'] }),
        makeAsset({ asset_id: 'capsule-1', asset_type: 'capsule', signals: ['sig-b'], status: 'draft' }),
      ]);
      mockPrisma.knowledgeGraphRelationship.findMany.mockResolvedValueOnce([
        {
          relationship_id: 'rel-explicit',
          from_id: 'gene-1',
          to_id: 'capsule-1',
          relationship_type: 'references',
          properties: {},
          created_at: new Date('2025-01-01'),
        },
      ]);

      const result = await getGraphStats();

      expect(result).toEqual({
        total_nodes: 3,
        total_relationships: 3,
        node_types: { gene: 2, capsule: 1 },
        relationship_types: { derived_from: 1, shares_signals: 1, references: 1 },
      });
    });
  });

  describe('listNodesByType', () => {
    it('should return paginated published nodes for the requested type', async () => {
      mockPrisma.asset.findMany.mockResolvedValueOnce([
        { asset_id: 'gene-1', name: 'Gene One', gdi_score: 88 },
      ]);
      mockPrisma.asset.count.mockResolvedValueOnce(1);

      const result = await listNodesByType('gene', 10, 5);

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith({
        where: {
          asset_type: 'gene',
          status: 'published',
        },
        select: {
          asset_id: true,
          name: true,
          gdi_score: true,
        },
        orderBy: [
          { gdi_score: 'desc' },
          { created_at: 'desc' },
        ],
        take: 10,
        skip: 5,
      });
      expect(result).toEqual({
        type: 'gene',
        nodes: [{ id: 'gene-1', name: 'Gene One', gdi_score: 88 }],
        total: 1,
      });
    });
  });

  describe('createRelationship', () => {
    it('should create a relationship between two existing nodes', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'from-1' }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'to-1' }));
      mockPrisma.knowledgeGraphRelationship.upsert.mockResolvedValue({
        relationship_id: 'rel-persisted-1',
        from_id: 'from-1',
        to_id: 'to-1',
        relationship_type: 'depends_on',
        properties: {},
        created_at: new Date('2025-01-01'),
      });

      const result = await createRelationship('from-1', 'to-1', 'depends_on');

      expect(result.from_id).toBe('from-1');
      expect(result.to_id).toBe('to-1');
      expect(result.type).toBe('depends_on');
      expect(result.properties).toEqual({});
      expect(result.created_at).toBeDefined();
      expect(mockPrisma.knowledgeGraphRelationship.upsert).toHaveBeenCalledWith({
        where: { relationship_id: expect.any(String) },
        update: { properties: {} },
        create: expect.objectContaining({
          from_id: 'from-1',
          to_id: 'to-1',
          relationship_type: 'depends_on',
        }),
      });
    });

    it('should include properties when provided', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'from-1' }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'to-1' }));
      mockPrisma.knowledgeGraphRelationship.upsert.mockResolvedValue({
        relationship_id: 'rel-persisted-2',
        from_id: 'from-1',
        to_id: 'to-1',
        relationship_type: 'depends_on',
        properties: { weight: 0.8 },
        created_at: new Date('2025-01-01'),
      });

      const result = await createRelationship('from-1', 'to-1', 'depends_on', {
        weight: 0.8,
      });

      expect(result.properties).toEqual({ weight: 0.8 });
    });

    it('should throw NotFoundError when source node not found', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeAsset({ asset_id: 'to-1' }));

      await expect(
        createRelationship('missing', 'to-1', 'depends_on'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when target node not found', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'from-1' }))
        .mockResolvedValueOnce(null);

      await expect(
        createRelationship('from-1', 'missing', 'depends_on'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getNeighbors', () => {
    it('should return outgoing neighbors (children)', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'node-1', parent_id: null }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'child-1', parent_id: 'node-1', generation: 2 }),
      ]);

      const result = await getNeighbors('node-1', undefined, 'outgoing');

      expect(result).toHaveLength(1);
      expect(result[0]!.direction).toBe('outgoing');
      expect(result[0]!.node.id).toBe('child-1');
      expect(result[0]!.relationship.type).toBe('derived_from');
    });

    it('should return incoming neighbors (parent + signal neighbors)', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(
          makeAsset({ asset_id: 'node-1', parent_id: 'parent-1', signals: ['sig-a'] }),
        )
        .mockResolvedValueOnce(
          makeAsset({ asset_id: 'parent-1', asset_type: 'gene' }),
        );
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await getNeighbors('node-1', undefined, 'incoming');

      expect(result.length).toBeGreaterThanOrEqual(1);
      const parentResult = result.find(
        (r) => r.node.id === 'parent-1',
      );
      expect(parentResult).toBeDefined();
      expect(parentResult!.direction).toBe('incoming');
    });

    it('should return both directions when direction is "both"', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(
          makeAsset({ asset_id: 'node-1', parent_id: 'parent-1', signals: ['sig-a'] }),
        )
        .mockResolvedValueOnce(
          makeAsset({ asset_id: 'parent-1', asset_type: 'gene' }),
        );
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await getNeighbors('node-1', undefined, 'both');

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by asset type when provided', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'node-1', parent_id: null }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await getNeighbors('node-1', 'gene', 'outgoing');

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            asset_type: 'gene',
          }),
        }),
      );
    });

    it('should throw NotFoundError when node not found', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(getNeighbors('missing')).rejects.toThrow(NotFoundError);
    });

    it('should return signal neighbors for incoming direction', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(
          makeAsset({ asset_id: 'node-1', parent_id: null, signals: ['sig-a', 'sig-b'] }),
        );
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'neighbor-1', signals: ['sig-a'] }),
      ]);

      const result = await getNeighbors('node-1', undefined, 'incoming');

      const sigNeighbor = result.find(
        (r) => r.relationship.type === 'shares_signals',
      );
      expect(sigNeighbor).toBeDefined();
      expect(sigNeighbor!.relationship.properties.shared_signals).toContain('sig-a');
    });
  });

  describe('getShortestPath', () => {
    it('should return path of length 0 for same node', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'a1' }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'a1' }));

      const result = await getShortestPath('a1', 'a1');

      expect(result.found).toBe(true);
      expect(result.path).toEqual(['a1']);
      expect(result.length).toBe(0);
    });

    it('should return not found when either node does not exist', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await getShortestPath('missing-1', 'missing-2');

      expect(result.found).toBe(false);
      expect(result.path).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('should find direct parent-child path', async () => {
      mockPrisma.asset.findUnique.mockImplementation((args: any) => {
        const id = args?.where?.asset_id;
        if (id === 'child') {
          return Promise.resolve(makeAsset({ asset_id: 'child', parent_id: 'parent' }));
        }
        if (id === 'parent') {
          return Promise.resolve(makeAsset({ asset_id: 'parent', parent_id: null }));
        }
        return Promise.resolve(null);
      });
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await getShortestPath('child', 'parent');

      expect(result.found).toBe(true);
      expect(result.path).toContain('parent');
      expect(result.length).toBe(1);
    });

    it('should return not found when no path exists', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'a1' }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'a2' }));

      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.findUnique.mockResolvedValue({ parent_id: null });

      const result = await getShortestPath('a1', 'a2');

      expect(result.found).toBe(false);
      expect(result.path).toEqual([]);
    });
  });

  describe('deleteNode', () => {
    it('should delete an existing node', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'node-1' }),
      );
      mockPrisma.asset.delete.mockResolvedValue({});

      await expect(deleteNode('node-1')).resolves.toBeUndefined();
      expect(mockPrisma.knowledgeGraphRelationship.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { from_id: 'node-1' },
            { to_id: 'node-1' },
          ],
        },
      });
      expect(mockPrisma.asset.delete).toHaveBeenCalledWith({
        where: { asset_id: 'node-1' },
      });
    });

    it('should throw NotFoundError when node does not exist', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(deleteNode('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('queryGraph - depth edge cases', () => {
    it('should not query related assets when depth is 1', async () => {
      const assets = [makeAsset({ asset_id: 'a1', signals: ['sig-a'] })];

      mockPrisma.asset.findMany.mockResolvedValueOnce(assets);

      const result = await queryGraph('test', 1);

      // Should have exactly 1 findMany call (the initial query), no related query
      expect(mockPrisma.asset.findMany).toHaveBeenCalledTimes(1);
      expect(result.nodes).toHaveLength(1);
      expect(result.relationships).toEqual([]);
    });

    it('should not query related assets when depth is 0', async () => {
      mockPrisma.asset.findMany.mockResolvedValueOnce([]);

      const result = await queryGraph('test', 0);

      expect(mockPrisma.asset.findMany).toHaveBeenCalledTimes(1);
      expect(result.nodes).toEqual([]);
      expect(result.relationships).toEqual([]);
    });

    it('should not add shares_signals relationship when related asset not in nodeIds', async () => {
      const assets = [makeAsset({ asset_id: 'a1', signals: ['sig-a', 'sig-b'] })];

      // Related asset has matching signal but is NOT in the query result
      mockPrisma.asset.findMany
        .mockResolvedValueOnce(assets)
        .mockResolvedValueOnce([makeAsset({ asset_id: 'external-1', signals: ['sig-a'] })]);

      const result = await queryGraph('test', 2);

      // Shares_signals should NOT be added because external-1 is not in nodeIds
      const sharesSigRels = result.relationships.filter(
        (r) => r.type === 'shares_signals',
      );
      expect(sharesSigRels).toHaveLength(0);
    });
  });

  describe('getNeighbors - additional coverage', () => {
    it('should return incoming neighbors when node has no parent but has signal neighbors', async () => {
      mockPrisma.asset.findUnique.mockResolvedValueOnce(
        makeAsset({ asset_id: 'node-1', parent_id: null, signals: ['sig-a'] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'sig-neighbor', signals: ['sig-a', 'sig-b'] }),
      ]);

      const result = await getNeighbors('node-1', undefined, 'incoming');

      const sigNeighbor = result.find(
        (r) => r.relationship.type === 'shares_signals',
      );
      expect(sigNeighbor).toBeDefined();
      expect(sigNeighbor!.node.id).toBe('sig-neighbor');
    });

    it('should filter signal neighbors by type when type filter is provided', async () => {
      mockPrisma.asset.findUnique.mockResolvedValueOnce(
        makeAsset({ asset_id: 'node-1', parent_id: null, signals: ['sig-a'] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'neighbor-capsule', asset_type: 'capsule', signals: ['sig-a'] }),
      ]);

      await getNeighbors('node-1', 'capsule', 'incoming');

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ asset_type: 'capsule' }),
        }),
      );
    });

    it('should not add parent relationship when type filter does not match', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(
          makeAsset({ asset_id: 'node-1', parent_id: 'parent-gene', signals: ['sig-a'] }),
        )
        .mockResolvedValueOnce(
          makeAsset({ asset_id: 'parent-gene', asset_type: 'gene' }),
        );
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await getNeighbors('node-1', 'capsule', 'incoming');

      const parentRel = result.find(
        (r) => r.node.id === 'parent-gene',
      );
      expect(parentRel).toBeUndefined();
    });
  });

  describe('getShortestPath - BFS multi-hop coverage', () => {
    it('should find multi-hop path through child chain', async () => {
      // child -> grandchild -> ancestor
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'child' }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'ancestor' }))
        // BFS: child has no parent, has child grandchild
        .mockResolvedValueOnce({ parent_id: null })
        // BFS: grandchild has no parent, has child ancestor
        .mockResolvedValueOnce({ parent_id: null })
        // BFS: ancestor has no parent
        .mockResolvedValueOnce({ parent_id: null });

      mockPrisma.asset.findMany
        .mockResolvedValueOnce([makeAsset({ asset_id: 'grandchild', parent_id: 'child' })])
        .mockResolvedValueOnce([makeAsset({ asset_id: 'ancestor', parent_id: 'grandchild' })])
        .mockResolvedValueOnce([]);

      const result = await getShortestPath('child', 'ancestor');

      expect(result.found).toBe(true);
      expect(result.path).toContain('ancestor');
      expect(result.length).toBeGreaterThan(1);
    });

    it('should traverse BFS queue and find target through children', async () => {
      // start -> child-1 -> target (2 hops)
      // Must reset mocks first to clear persistent mockResolvedValue from previous tests
      resetMocks();
      mockPrisma.asset.findUnique.mockImplementation((args: any) => {
        const id = args?.where?.asset_id;
        if (id === 'start') return Promise.resolve(makeAsset({ asset_id: 'start' }));
        if (id === 'target') return Promise.resolve(makeAsset({ asset_id: 'target' }));
        if (id === 'child-1') return Promise.resolve({ parent_id: null });
        return Promise.resolve(null);
      });
      mockPrisma.asset.findMany.mockImplementation((args: any) => {
        const where = args?.where ?? {};
        if (where.parent_id === 'start') {
          return Promise.resolve([makeAsset({ asset_id: 'child-1', parent_id: 'start' })]);
        }
        if (where.parent_id === 'child-1') {
          return Promise.resolve([makeAsset({ asset_id: 'target', parent_id: 'child-1' })]);
        }
        return Promise.resolve([]);
      });

      const result = await getShortestPath('start', 'target');

      expect(result.found).toBe(true);
      expect(result.path).toContain('target');
    });

    it('should find target through parent chain', async () => {
      // a -> b (parent) -> c (target)
      resetMocks();
      mockPrisma.asset.findUnique.mockImplementation((args: any) => {
        const id = args?.where?.asset_id;
        if (id === 'a') return Promise.resolve(makeAsset({ asset_id: 'a', parent_id: 'b' }));
        if (id === 'b') return Promise.resolve(makeAsset({ asset_id: 'b', parent_id: 'c' }));
        if (id === 'c') return Promise.resolve(makeAsset({ asset_id: 'c', parent_id: null }));
        return Promise.resolve(null);
      });
      mockPrisma.asset.findMany.mockImplementation(() => Promise.resolve([]));

      const result = await getShortestPath('a', 'c');

      expect(result.found).toBe(true);
      expect(result.path).toContain('c');
      expect(result.path).toContain('b');
    });
  });

  describe('getShortestPathPostgres', () => {
    it('should return simple result when fromId equals toId', async () => {
      const result = await getShortestPathPostgres('node-x', 'node-x');

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]!.id).toBe('node-x');
      expect(result.relationships).toEqual([]);
    });

    it('should return empty result when either node does not exist', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await getShortestPathPostgres('missing-1', 'missing-2');

      expect(result.nodes).toEqual([]);
      expect(result.relationships).toEqual([]);
    });

    it('should return empty when only one node exists', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'exists' }))
        .mockResolvedValueOnce(null);

      const result = await getShortestPathPostgres('exists', 'missing');

      expect(result.nodes).toEqual([]);
      expect(result.relationships).toEqual([]);
    });

    it('should find path and return nodes with relationships', async () => {
      // child -> parent (direct path)
      resetMocks();
      mockPrisma.asset.findUnique.mockImplementation((args: any) => {
        const id = args?.where?.asset_id;
        const sel = args?.select;
        if (id === 'child') return Promise.resolve(makeAsset({ asset_id: 'child' }));
        if (id === 'parent') {
          if (sel?.parent_id !== undefined) return Promise.resolve({ parent_id: null });
          return Promise.resolve(makeAsset({ asset_id: 'parent' }));
        }
        return Promise.resolve(null);
      });
      mockPrisma.asset.findMany.mockImplementation((args: any) => {
        if (args?.where?.parent_id === 'child') {
          return Promise.resolve([makeAsset({ asset_id: 'parent', parent_id: 'child' })]);
        }
        return Promise.resolve([]);
      });

      const result = await getShortestPathPostgres('child', 'parent');

      expect(result.nodes).toHaveLength(2);
      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0]!.type).toBe('derived_from');
    });

    it('should skip BFS when path exceeds maxHops', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'a' }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'b' }))
        // BFS a: path length 1, not > maxHops(3), has children
        .mockResolvedValueOnce({ parent_id: null })
        // BFS child: path length 2, not > maxHops, has children
        .mockResolvedValueOnce({ parent_id: null })
        // BFS grandchild: path length 3, not > maxHops, has children
        .mockResolvedValueOnce({ parent_id: null })
        // BFS great-grandchild: path length 4 > maxHops, skip
        .mockResolvedValueOnce({ parent_id: null })
        // BFS great-grandchild: path length 4 > maxHops, skip
        .mockResolvedValueOnce({ parent_id: null });

      mockPrisma.asset.findMany
        .mockResolvedValueOnce([makeAsset({ asset_id: 'level-1', parent_id: 'a' })])
        .mockResolvedValueOnce([makeAsset({ asset_id: 'level-2', parent_id: 'level-1' })])
        .mockResolvedValueOnce([makeAsset({ asset_id: 'level-3', parent_id: 'level-2' })])
        .mockResolvedValueOnce([makeAsset({ asset_id: 'level-4', parent_id: 'level-3' })])
        .mockResolvedValueOnce([]);

      const result = await getShortestPathPostgres('a', 'b', 3);

      expect(result.nodes).toEqual([]);
      expect(result.relationships).toEqual([]);
    });

    it('should return empty when no path found within maxHops', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'start' }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'end' }))
        .mockResolvedValueOnce({ parent_id: null })
        .mockResolvedValueOnce({ parent_id: null })
        .mockResolvedValueOnce({ parent_id: null });

      mockPrisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getShortestPathPostgres('start', 'end', 3);

      expect(result.nodes).toEqual([]);
      expect(result.relationships).toEqual([]);
    });
  });

  describe('shortestPathPostgres', () => {
    it('should return empty array when from equals to', async () => {
      const result = await shortestPathPostgres('x', 'x');

      expect(result).toEqual([]);
    });
  });

  describe('findSimilarAssetsPostgres', () => {
    it('should return empty array when asset does not exist', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      const result = await findSimilarAssetsPostgres('missing');

      expect(result).toEqual([]);
    });

    it('should return empty array when no similar assets found', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'asset-1', signals: ['sig-a'] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await findSimilarAssetsPostgres('asset-1');

      expect(result).toEqual([]);
    });

    it('should return similar assets with correct similarity score', async () => {
      resetMocks();
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'asset-1', signals: ['sig-a', 'sig-b'] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'similar-1', signals: ['sig-a', 'sig-c'] }),
        makeAsset({ asset_id: 'similar-2', signals: ['sig-a', 'sig-b'] }),
      ]);

      const result = await findSimilarAssetsPostgres('asset-1');

      expect(result).toHaveLength(2);
      // similar-1 shares 1 signal out of 2 -> 0.5
      const s1 = result.find((r) => r.node.id === 'similar-1')!;
      expect(s1.similarity).toBe(0.5);
      expect(s1.sharedSignals).toContain('sig-a');
      expect(s1.relationshipType).toBe('shares_signals');
      // similar-2 shares 2 signals out of 2 -> 1.0
      const s2 = result.find((r) => r.node.id === 'similar-2')!;
      expect(s2.similarity).toBe(1);
    });

    it('should respect limit parameter', async () => {
      resetMocks();
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'asset-1', signals: ['sig-a'] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await findSimilarAssetsPostgres('asset-1', 5);

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('should handle asset with empty signals array', async () => {
      resetMocks();
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'empty-sig', signals: [] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'some-asset', signals: ['sig-x'] }),
      ]);

      const result = await findSimilarAssetsPostgres('empty-sig');

      // Empty signals -> similarity = 0/1 = 0, but sharedSignals should be []
      expect(result).toHaveLength(1);
      expect(result[0]!.sharedSignals).toEqual([]);
    });
  });

  describe('findRelatedCapabilitiesPostgres', () => {
    it('should return empty result for nonexistent node', async () => {
      resetMocks();
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      const result = await findRelatedCapabilitiesPostgres('missing');

      expect(result.nodes).toEqual([]);
      expect(result.relationships).toEqual([]);
    });

    it('should traverse BFS and stop at maxDepth', async () => {
      // BFS: node-1(depth 0) -> child-1(depth 1)
      // At depth 1 < maxDepth 2, continue is NOT hit, so findMany is called
      // At depth 2 >= maxDepth 2, continue IS hit BEFORE findMany
      resetMocks();
      mockPrisma.asset.findUnique.mockImplementation((args: any) => {
        const id = args?.where?.asset_id;
        if (id === 'node-1') {
          return Promise.resolve(makeAsset({ asset_id: 'node-1', signals: [] }));
        }
        if (id === 'child-1') {
          return Promise.resolve(makeAsset({ asset_id: 'child-1', parent_id: 'node-1', signals: [] }));
        }
        return Promise.resolve(null);
      });

      mockPrisma.asset.findMany
        .mockResolvedValueOnce([makeAsset({ asset_id: 'child-1', parent_id: 'node-1' })])
        .mockResolvedValueOnce([]);

      const result = await findRelatedCapabilitiesPostgres('node-1', 2, 20);

      expect(result.nodes).toHaveLength(2);
    });

    it('should stop adding nodes when node limit is reached', async () => {
      resetMocks();
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'node-1', signals: [] }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'child-1', signals: [] }));

      mockPrisma.asset.findMany
        .mockResolvedValueOnce([makeAsset({ asset_id: 'child-1', parent_id: 'node-1' })])
        .mockResolvedValueOnce([]);

      const result = await findRelatedCapabilitiesPostgres('node-1', 5, 1);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]!.id).toBe('node-1');
    });

    it('should add signal-based relationships when asset has signals', async () => {
      // node-1 has signals, finds signal neighbor at depth 1
      resetMocks();
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'node-1', signals: ['sig-a'] }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'signal-neighbor', signals: ['sig-a'] }));

      mockPrisma.asset.findMany
        .mockResolvedValueOnce([]) // no children
        .mockResolvedValueOnce([makeAsset({ asset_id: 'signal-neighbor', signals: ['sig-a'] })]) // signal neighbors for node-1

      const result = await findRelatedCapabilitiesPostgres('node-1', 2, 20);

      const sigRel = result.relationships.find(
        (r) => r.type === 'shares_signals',
      );
      expect(sigRel).toBeDefined();
      expect(sigRel!.from_id).toBe('node-1');
      expect(sigRel!.to_id).toBe('signal-neighbor');
    });

    it('should stop exploring BFS depth when maxDepth is reached', async () => {
      // maxDepth=1: only root(depth 0) and level1(depth 1) are explored
      resetMocks();
      mockPrisma.asset.findUnique.mockImplementation((args: any) => {
        const id = args?.where?.asset_id;
        if (id === 'root') {
          return Promise.resolve(makeAsset({ asset_id: 'root', signals: [] }));
        }
        if (id === 'level1') {
          return Promise.resolve(makeAsset({ asset_id: 'level1', parent_id: 'root', signals: [] }));
        }
        return Promise.resolve(null);
      });

      mockPrisma.asset.findMany
        .mockResolvedValueOnce([makeAsset({ asset_id: 'level1', parent_id: 'root' })])
        .mockResolvedValueOnce([]);

      const result = await findRelatedCapabilitiesPostgres('root', 1, 20);

      expect(result.nodes).toHaveLength(2);
    });
  });
});
