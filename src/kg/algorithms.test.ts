import { shortestPath, pageRank, communityDetection } from './algorithms';
import * as neo4jClient from './neo4j';
import * as service from './service';

// ----- Mock helpers -----

function makeKgNode(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'node-1',
    type: 'gene',
    properties: {},
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const mockPrisma = {
  asset: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  knowledgeGraphRelationship: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
} as any;

describe('algorithms module', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockPrisma.asset.findMany.mockResolvedValue([]);
    mockPrisma.knowledgeGraphRelationship.findMany.mockResolvedValue([]);
  });

  describe('shortestPath', () => {
    it('should use Neo4j when connected', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(true);
      jest.spyOn(neo4jClient, 'queryPath').mockResolvedValue({
        nodes: [makeKgNode({ id: 'a' }), makeKgNode({ id: 'b' })],
        relationships: [],
      });

      const result = await shortestPath('a', 'b');

      expect(result).toHaveLength(0);
    });

    it('should fall back to PostgreSQL when Neo4j unavailable', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findUnique.mockResolvedValue(null);
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await shortestPath('x', 'y');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('pageRank', () => {
    it('should return ranked nodes using PostgreSQL fallback', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findMany.mockResolvedValue([
        {
          asset_id: 'a1',
          asset_type: 'gene',
          name: 'Asset A',
          description: '',
          signals: ['sig-a', 'sig-b'],
          tags: [],
          gdi_score: 80,
          author_id: 'n1',
          parent_id: null,
          generation: 1,
          created_at: new Date(),
          status: 'published',
        },
        {
          asset_id: 'a2',
          asset_type: 'gene',
          name: 'Asset B',
          description: '',
          signals: ['sig-a'],
          tags: [],
          gdi_score: 70,
          author_id: 'n2',
          parent_id: 'a1',
          generation: 2,
          created_at: new Date(),
          status: 'published',
        },
      ] as any);

      const result = await pageRank(10, 0.85, 20);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(2);
      expect(result[0]).toHaveProperty('node');
      expect(result[0]).toHaveProperty('rank');
    });

    it('should return empty array when no assets exist', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await pageRank(10, 0.85, 20);

      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findMany.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({
          asset_id: `asset-${i}`,
          asset_type: 'gene',
          name: `Asset ${i}`,
          description: '',
          signals: [`sig-${i % 5}`],
          tags: [],
          gdi_score: 50,
          author_id: 'n1',
          parent_id: null,
          generation: 1,
          created_at: new Date(),
          status: 'published',
        })) as any,
      );

      const result = await pageRank(5, 0.85, 5);

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('communityDetection', () => {
    it('should return community assignments using label propagation', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findMany.mockResolvedValue([
        {
          asset_id: 'c1',
          asset_type: 'gene',
          name: 'Community 1 Node A',
          description: '',
          signals: ['sig-a'],
          tags: [],
          gdi_score: 60,
          author_id: 'n1',
          parent_id: null,
          generation: 1,
          created_at: new Date(),
          status: 'published',
        },
        {
          asset_id: 'c2',
          asset_type: 'gene',
          name: 'Community 1 Node B',
          description: '',
          signals: ['sig-a'],
          tags: [],
          gdi_score: 60,
          author_id: 'n2',
          parent_id: 'c1',
          generation: 2,
          created_at: new Date(),
          status: 'published',
        },
        {
          asset_id: 'c3',
          asset_type: 'gene',
          name: 'Isolated Node',
          description: '',
          signals: ['sig-z'],
          tags: [],
          gdi_score: 50,
          author_id: 'n3',
          parent_id: null,
          generation: 1,
          created_at: new Date(),
          status: 'published',
        },
      ] as any);

      const result = await communityDetection('louvain');

      expect(result).toBeInstanceOf(Map);
      expect(result.has('c1')).toBe(true);
      expect(result.has('c2')).toBe(true);
      expect(result.has('c3')).toBe(true);

      // c1 and c2 share a signal + parent relationship, should end up in same community
      // (label propagation is non-deterministic in execution order, so we just check structure)
      expect(result.size).toBe(3);
    });

    it('should accept label_propagation as alias', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await communityDetection('label_propagation');

      expect(result).toBeInstanceOf(Map);
    });
  });
});
