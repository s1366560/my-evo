import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { NotFoundError, ValidationError } from '../shared/errors';

const {
  queryGraph,
  createNode,
  createRelationship,
  getNeighbors,
  getShortestPath,
  deleteNode,
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
    create: jest.fn(),
    delete: jest.fn(),
  },
} as any;

describe('Knowledge Graph Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
        status: 'draft',
        gdi_score: 0,
      });

      mockPrisma.asset.create.mockResolvedValue(created);

      const result = await createNode('gene', {
        name: 'Test Node',
        description: 'Desc',
        signals: ['sig-1'],
        author_id: 'node-1',
      });

      expect(result.id).toBe('new-1');
      expect(result.type).toBe('gene');
      expect(result.properties.name).toBe('Test Node');
      expect(result.properties.signals).toEqual(['sig-1']);
    });

    it('should throw ValidationError when type is empty', async () => {
      await expect(createNode('', { name: 'Test' })).rejects.toThrow(
        ValidationError,
      );
    });

    it('should use default values for missing properties', async () => {
      const created = makeAsset({
        asset_id: 'new-2',
        name: 'Untitled',
        description: '',
        signals: [],
        author_id: 'system',
      });

      mockPrisma.asset.create.mockResolvedValue(created);

      const result = await createNode('gene', {});

      expect(result.properties.name).toBe('Untitled');
      expect(result.properties.description).toBe('');
    });
  });

  describe('createRelationship', () => {
    it('should create a relationship between two existing nodes', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'from-1' }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'to-1' }));

      const result = await createRelationship('from-1', 'to-1', 'depends_on');

      expect(result.from_id).toBe('from-1');
      expect(result.to_id).toBe('to-1');
      expect(result.type).toBe('depends_on');
      expect(result.properties).toEqual({});
      expect(result.created_at).toBeDefined();
    });

    it('should include properties when provided', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'from-1' }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'to-1' }));

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
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(makeAsset({ asset_id: 'child' }))
        .mockResolvedValueOnce(makeAsset({ asset_id: 'parent' }));

      mockPrisma.asset.findMany.mockResolvedValue([
        { asset_id: 'parent' },
      ]);
      mockPrisma.asset.findUnique.mockResolvedValue({
        parent_id: null,
      });

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
      expect(mockPrisma.asset.delete).toHaveBeenCalledWith({
        where: { asset_id: 'node-1' },
      });
    });

    it('should throw NotFoundError when node does not exist', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(deleteNode('missing')).rejects.toThrow(NotFoundError);
    });
  });
});
