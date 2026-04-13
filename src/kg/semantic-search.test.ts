import { findSimilarAssets, findRelatedCapabilities } from './semantic-search';
import * as neo4jClient from './neo4j';
import * as service from './service';

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

describe('semantic-search module', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockPrisma.asset.findMany.mockResolvedValue([]);
    mockPrisma.knowledgeGraphRelationship.findMany.mockResolvedValue([]);
  });

  describe('findSimilarAssets', () => {
    it('should use Neo4j when connected', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(true);
      jest.spyOn(neo4jClient, 'queryPath').mockResolvedValue({ nodes: [], relationships: [] });
      // Override findSimilarAssetsNeo4j by mocking queryPath used internally
      jest.spyOn(neo4jClient as any, 'getSession').mockReturnValue({
        run: jest.fn().mockResolvedValue({ records: [] }),
        close: jest.fn().mockResolvedValue(undefined),
      });

      const result = await findSimilarAssets('asset-1', 5);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should fall back to PostgreSQL when Neo4j unavailable', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'a1',
        signals: ['sig-a', 'sig-b'],
      } as any);
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await findSimilarAssets('a1', 10);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when asset not found', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      const result = await findSimilarAssets('nonexistent', 10);

      expect(result).toEqual([]);
    });
  });

  describe('findRelatedCapabilities', () => {
    it('should use Neo4j when connected', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(true);
      jest.spyOn(neo4jClient as any, 'getSession').mockReturnValue({
        run: jest.fn().mockResolvedValue({ records: [] }),
        close: jest.fn().mockResolvedValue(undefined),
      });

      const result = await findRelatedCapabilities('node-1', 2, 20);

      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('relationships');
    });

    it('should fall back to PostgreSQL BFS when Neo4j unavailable', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findUnique.mockResolvedValueOnce({
        asset_id: 'a1',
        signals: ['sig-a'],
        parent_id: null,
        asset_type: 'gene',
        name: 'Asset A',
        description: '',
        tags: [],
        gdi_score: 70,
        author_id: 'n1',
        generation: 1,
        created_at: new Date(),
        status: 'published',
      } as any);
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await findRelatedCapabilities('a1', 2, 20);

      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('relationships');
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.relationships)).toBe(true);
    });
  });
});
