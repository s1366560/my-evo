import { PrismaClient } from '@prisma/client';
import * as service from './service';
import {
  publishAsset,
  fetchAsset,
  revokeAsset,
  promoteAsset,
  searchAssets,
  calculateSimilarity,
  calculateGDI,
  getCarbonCost,
} from './service';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  SimilarityViolationError,
} from '../shared/errors';
import {
  CARBON_COST_GENE,
  CARBON_COST_CAPSULE,
  CARBON_COST_RECIPE,
  SIMILARITY_THRESHOLD,
  INITIAL_GDI_SCORE,
  PROMOTION_GDI_THRESHOLD,
} from '../shared/constants';
import type { AssetType } from '../shared/types';

// Mock PrismaClient
const mockPrisma = {
  asset: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  node: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
  },
  evolutionEvent: {
    create: jest.fn(),
  },
  similarityRecord: {
    create: jest.fn(),
  },
  reputationEvent: {
    create: jest.fn(),
  },
  gDIScoreRecord: {
    create: jest.fn(),
  },
} as any;

describe('Assets Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCarbonCost', () => {
    it('should return correct cost for gene', () => {
      expect(getCarbonCost('gene')).toBe(CARBON_COST_GENE);
    });

    it('should return correct cost for capsule', () => {
      expect(getCarbonCost('capsule')).toBe(CARBON_COST_CAPSULE);
    });

    it('should return correct cost for recipe', () => {
      expect(getCarbonCost('recipe')).toBe(CARBON_COST_RECIPE);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical content', () => {
      const result = calculateSimilarity('hello world test', 'hello world test');
      expect(result).toBe(1.0);
    });

    it('should return 0.0 for completely different content', () => {
      const result = calculateSimilarity('aaa bbb ccc', 'ddd eee fff');
      expect(result).toBe(0.0);
    });

    it('should return 0.0 for empty vs non-empty', () => {
      expect(calculateSimilarity('', 'hello')).toBe(0.0);
      expect(calculateSimilarity('hello', '')).toBe(0.0);
    });

    it('should return 1.0 for both empty', () => {
      expect(calculateSimilarity('', '')).toBe(1.0);
    });

    it('should compute partial overlap', () => {
      const result = calculateSimilarity('hello world', 'hello there');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should be case insensitive', () => {
      const result = calculateSimilarity('Hello World', 'hello world');
      expect(result).toBe(1.0);
    });
  });

  describe('publishAsset', () => {
    const validPayload = {
      sender_id: 'node-1',
      asset_type: 'gene' as AssetType,
      name: 'Test Gene',
      description: 'A test gene',
      content: 'function test() {}',
      signals: ['test'],
    };

    it('should publish a gene asset successfully', async () => {
      const mockNode = {
        node_id: 'node-1',
        credit_balance: 500,
        reputation: 50,
      };

      const mockAsset = {
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Test Gene',
        description: 'A test gene',
        gdi_score: INITIAL_GDI_SCORE,
        carbon_cost: CARBON_COST_GENE,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.create.mockResolvedValue(mockAsset);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.evolutionEvent.create.mockResolvedValue({});

      const result = await publishAsset('node-1', validPayload);

      expect(result.status).toBe('ok');
      expect(result.asset_type).toBe('gene');
      expect(result.gdi_score).toBe(INITIAL_GDI_SCORE);
      expect(result.carbon_cost).toBe(CARBON_COST_GENE);
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { credit_balance: 500 - CARBON_COST_GENE },
        }),
      );
    });

    it('should throw ValidationError for missing name', async () => {
      const payload = { ...validPayload, name: '' };
      await expect(publishAsset('node-1', payload)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing description', async () => {
      const payload = { ...validPayload, description: '' };
      await expect(publishAsset('node-1', payload)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(publishAsset('unknown', validPayload)).rejects.toThrow(NotFoundError);
    });

    it('should throw InsufficientCreditsError when balance too low', async () => {
      const mockNode = { node_id: 'node-1', credit_balance: 2, reputation: 50 };
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);

      await expect(publishAsset('node-1', validPayload)).rejects.toThrow(InsufficientCreditsError);
    });

    it('should throw SimilarityViolationError for high similarity', async () => {
      const mockNode = { node_id: 'node-1', credit_balance: 500, reputation: 50 };
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.asset.findMany.mockResolvedValue([
        { asset_id: 'existing-1', content: 'function test() {}' },
      ]);

      await expect(publishAsset('node-1', validPayload)).rejects.toThrow(SimilarityViolationError);
    });
  });

  describe('fetchAsset', () => {
    it('should increment downloads and deduct 1 credit', async () => {
      const mockAsset = {
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Test',
        description: 'Test',
        content: 'code',
        signals: [],
        tags: [],
        author_id: 'node-2',
        status: 'published',
        gdi_score: 60,
        downloads: 10,
        rating: 0,
        version: 1,
        carbon_cost: 5,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockNode = { node_id: 'node-1', credit_balance: 100 };

      mockPrisma.asset.findUnique.mockResolvedValue(mockAsset);
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.asset.update.mockResolvedValue({ ...mockAsset, downloads: 11 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = (await fetchAsset('node-1', 'asset-1')) as Record<string, unknown>;

      expect(result.downloads).toBe(11);
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { credit_balance: 99 },
        }),
      );
    });

    it('should throw NotFoundError for unknown asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);
      await expect(fetchAsset('node-1', 'unknown')).rejects.toThrow(NotFoundError);
    });

    it('should throw InsufficientCreditsError when balance is 0', async () => {
      const mockAsset = { asset_id: 'asset-1', downloads: 5 };
      const mockNode = { node_id: 'node-1', credit_balance: 0 };

      mockPrisma.asset.findUnique.mockResolvedValue(mockAsset);
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);

      await expect(fetchAsset('node-1', 'asset-1')).rejects.toThrow(InsufficientCreditsError);
    });
  });

  describe('revokeAsset', () => {
    it('should revoke asset and apply -100 reputation', async () => {
      const mockAsset = {
        asset_id: 'asset-1',
        author_id: 'node-1',
        version: 1,
      };

      mockPrisma.asset.findUnique.mockResolvedValue(mockAsset);
      mockPrisma.asset.update.mockResolvedValue({});
      mockPrisma.evolutionEvent.create.mockResolvedValue({});

      const mockNode = { node_id: 'node-1', reputation: 60 };
      mockPrisma.node.findUnique.mockResolvedValueOnce(null);
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      const result = await revokeAsset('node-1', 'asset-1');

      expect(result.status).toBe('revoked');
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reputation: 0 },
        }),
      );
    });

    it('should throw ValidationError when revoking others asset', async () => {
      const mockAsset = { asset_id: 'asset-1', author_id: 'node-2', version: 1 };
      mockPrisma.asset.findUnique.mockResolvedValue(mockAsset);

      await expect(revokeAsset('node-1', 'asset-1')).rejects.toThrow(ValidationError);
    });

    it('should clamp reputation to 0 minimum', async () => {
      const mockAsset = { asset_id: 'asset-1', author_id: 'node-1', version: 1 };
      const mockNode = { node_id: 'node-1', reputation: 30 };

      mockPrisma.asset.findUnique.mockResolvedValue(mockAsset);
      mockPrisma.asset.update.mockResolvedValue({});
      mockPrisma.evolutionEvent.create.mockResolvedValue({});
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      await revokeAsset('node-1', 'asset-1');

      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reputation: 0 },
        }),
      );
    });
  });

  describe('promoteAsset', () => {
    it('should promote asset when GDI >= 70', async () => {
      const mockAsset = {
        asset_id: 'asset-1',
        author_id: 'node-1',
        gdi_score: 80,
        version: 1,
      };

      const mockNode = { node_id: 'node-1', reputation: 50, credit_balance: 100 };

      mockPrisma.asset.findUnique.mockResolvedValue(mockAsset);
      mockPrisma.asset.update.mockResolvedValue({});
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});
      mockPrisma.evolutionEvent.create.mockResolvedValue({});

      const result = await promoteAsset('asset-1');

      expect(result.status).toBe('promoted');
      expect(result.gdi_score).toBe(80);
    });

    it('should throw ValidationError when GDI < 70', async () => {
      const mockAsset = { asset_id: 'asset-1', gdi_score: 50, version: 1 };
      mockPrisma.asset.findUnique.mockResolvedValue(mockAsset);

      await expect(promoteAsset('asset-1')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for unknown asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);
      await expect(promoteAsset('unknown')).rejects.toThrow(NotFoundError);
    });
  });

  describe('searchAssets', () => {
    it('should return matching assets', async () => {
      const mockAssets = [
        {
          asset_id: 'asset-1',
          asset_type: 'gene',
          name: 'Test Gene',
          description: 'A test gene',
          gdi_score: 70,
          downloads: 10,
          author_id: 'node-1',
          signals: ['test'],
          tags: ['unit'],
        },
      ];

      mockPrisma.asset.findMany.mockResolvedValue(mockAssets);

      const result = await searchAssets('Test');

      expect(result).toHaveLength(1);
      expect(result[0]!.asset_id).toBe('asset-1');
    });
  });

  describe('calculateGDI', () => {
    it('should calculate and store GDI score', async () => {
      const mockAsset = {
        asset_id: 'asset-1',
        downloads: 10,
        rating: 4.5,
        fork_count: 2,
        gdi_score: 60,
      };

      const mockGdiRecord = {
        asset_id: 'asset-1',
        overall: 55.5,
        usefulness: 65,
        novelty: 80,
        rigor: 60,
        reuse: 30,
        calculated_at: new Date(),
      };

      mockPrisma.asset.findUnique.mockResolvedValue(mockAsset);
      mockPrisma.gDIScoreRecord.create.mockResolvedValue(mockGdiRecord);
      mockPrisma.asset.update.mockResolvedValue({});

      const result = await calculateGDI('asset-1');

      expect(result.asset_id).toBe('asset-1');
      expect(result.dimensions).toHaveProperty('usefulness');
      expect(result.dimensions).toHaveProperty('novelty');
      expect(result.dimensions).toHaveProperty('rigor');
      expect(result.dimensions).toHaveProperty('reuse');
      expect(mockPrisma.asset.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError for unknown asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);
      await expect(calculateGDI('unknown')).rejects.toThrow(NotFoundError);
    });
  });
});
