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
  ConflictError,
} from '../shared/errors';
import {
  CARBON_COST_GENE,
  CARBON_COST_CAPSULE,
  CARBON_COST_RECIPE,
  SIMILARITY_THRESHOLD,
  INITIAL_GDI_SCORE,
  PROMOTION_GDI_THRESHOLD,
  GDI_PROMOTION_THRESHOLD,
} from '../shared/constants';
import type { AssetType } from '../shared/types';

// Mock PrismaClient
const mockPrisma = {
  asset: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  node: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
  },
  evolutionEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  similarityRecord: {
    create: jest.fn(),
  },
  reputationEvent: {
    create: jest.fn(),
  },
  gDIScoreRecord: {
    create: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  dispute: {
    findMany: jest.fn(),
  },
  assetDownload: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  assetVote: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(async (operation: unknown) => {
    if (typeof operation === 'function') {
      return operation(mockPrisma);
    }
    return operation;
  }),
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

      mockPrisma.node.findUnique
        .mockResolvedValueOnce(mockNode)
        .mockResolvedValueOnce({ ...mockNode, credit_balance: 495 });
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.create.mockResolvedValue(mockAsset);
      mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.evolutionEvent.create.mockResolvedValue({});

      const result = await publishAsset('node-1', validPayload);

      expect(result.status).toBe('ok');
      expect(result.asset_type).toBe('gene');
      expect(result.gdi_score).toBe(INITIAL_GDI_SCORE);
      expect(result.carbon_cost).toBe(CARBON_COST_GENE);
      expect(mockPrisma.node.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { credit_balance: { decrement: CARBON_COST_GENE }, gene_count: { increment: 1 } },
        }),
      );
    });

    it('should increment gene_count when publishing a gene', async () => {
      const mockNode = { node_id: 'node-1', credit_balance: 500, reputation: 50 };
      const mockAsset = { asset_id: 'asset-1', asset_type: 'gene', name: 'Gene', description: '', gdi_score: 60, carbon_cost: 5 };
      mockPrisma.node.findUnique
        .mockResolvedValueOnce(mockNode)
        .mockResolvedValueOnce({ ...mockNode, credit_balance: 495 });
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.create.mockResolvedValue(mockAsset);
      mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.evolutionEvent.create.mockResolvedValue({});

      await publishAsset('node-1', { ...validPayload, asset_type: 'gene' });

      expect(mockPrisma.node.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gene_count: { increment: 1 } }),
        }),
      );
    });

    it('should increment capsule_count when publishing a capsule', async () => {
      const mockNode = { node_id: 'node-1', credit_balance: 500, reputation: 50 };
      const mockAsset = { asset_id: 'asset-1', asset_type: 'capsule', name: 'Capsule', description: '', gdi_score: 60, carbon_cost: 10 };
      mockPrisma.node.findUnique
        .mockResolvedValueOnce(mockNode)
        .mockResolvedValueOnce({ ...mockNode, credit_balance: 490 });
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.create.mockResolvedValue(mockAsset);
      mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.evolutionEvent.create.mockResolvedValue({});

      await publishAsset('node-1', { ...validPayload, asset_type: 'capsule' });

      expect(mockPrisma.node.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ capsule_count: { increment: 1 } }),
        }),
      );
    });

    it('should deduplicate repeated publishes by source message id', async () => {
      mockPrisma.asset.findUnique.mockResolvedValueOnce({
        asset_id: 'deduped-asset',
        asset_type: 'gene',
        name: 'Test Gene',
        description: 'A test gene',
        content: 'function test() {}',
        signals: ['test'],
        tags: [],
        author_id: 'node-1',
        gdi_score: 61,
        carbon_cost: 5,
        parent_id: null,
        gene_ids: null,
        config: null,
      });

      const result = await publishAsset('node-1', {
        ...validPayload,
        source_message_id: 'msg-1',
      });

      expect(result.asset_id).toBe('deduped-asset');
      expect(mockPrisma.asset.create).not.toHaveBeenCalled();
      expect(mockPrisma.node.updateMany).not.toHaveBeenCalled();
    });

    it('should reject publishes when the transactional debit loses the balance race', async () => {
      mockPrisma.node.findUnique
        .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 500, reputation: 50 })
        .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 2, reputation: 50 });
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.node.updateMany.mockResolvedValue({ count: 0 });

      await expect(publishAsset('node-1', validPayload)).rejects.toThrow(InsufficientCreditsError);
      expect(mockPrisma.asset.create).not.toHaveBeenCalled();
    });

    it('should fail if the charged node record disappears inside the transaction', async () => {
      mockPrisma.node.findUnique
        .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 500, reputation: 50 })
        .mockResolvedValueOnce(null);
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });

      await expect(publishAsset('node-1', validPayload)).rejects.toThrow(NotFoundError);
      expect(mockPrisma.asset.create).not.toHaveBeenCalled();
    });

    it('should return the existing asset when a concurrent duplicate publish hits a unique constraint', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-1', credit_balance: 500, reputation: 50 });
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          asset_id: 'deduped-asset',
          asset_type: 'gene',
          name: 'Test Gene',
          description: 'A test gene',
          content: 'function test() {}',
          signals: ['test'],
          tags: [],
          author_id: 'node-1',
          gdi_score: 61,
          carbon_cost: 5,
          parent_id: null,
          gene_ids: null,
          config: null,
        });
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.asset.create.mockRejectedValue({ code: 'P2002' });

      const result = await publishAsset('node-1', {
        ...validPayload,
        source_message_id: 'msg-duplicate',
      });

      expect(result.asset_id).toBe('deduped-asset');
    });

    it('should reject reusing a message id for a different payload', async () => {
      mockPrisma.asset.findUnique.mockResolvedValueOnce({
        asset_id: 'deduped-asset',
        asset_type: 'gene',
        name: 'Old Gene',
        description: 'A different gene',
        content: 'different content',
        signals: ['old'],
        tags: [],
        author_id: 'node-1',
        gdi_score: 61,
        carbon_cost: 5,
        parent_id: null,
        gene_ids: null,
        config: null,
      });

      await expect(publishAsset('node-1', {
        ...validPayload,
        source_message_id: 'msg-conflict',
      })).rejects.toThrow(ConflictError);
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
      expect(mockPrisma.similarityRecord.create).not.toHaveBeenCalled();
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

      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(mockAsset)
        .mockResolvedValueOnce({ ...mockAsset, downloads: 11 });
      mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.asset.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.assetDownload.create.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = (await fetchAsset('node-1', 'asset-1')) as Record<string, unknown>;

      expect(result.downloads).toBe(11);
      expect(mockPrisma.asset.updateMany).toHaveBeenCalledWith({
        where: {
          asset_id: 'asset-1',
          OR: [
            { status: { in: ['published', 'promoted'] } },
            { author_id: 'node-1' },
          ],
        },
        data: { downloads: { increment: 1 } },
      });
      expect(mockPrisma.node.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { node_id: 'node-1', credit_balance: { gte: 1 } },
          data: { credit_balance: { decrement: 1 } },
        }),
      );
      expect(mockPrisma.assetDownload.create).toHaveBeenCalledWith({
        data: { asset_id: 'asset-1', node_id: 'node-1' },
      });
    });

    it('should throw NotFoundError for unknown asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);
      await expect(fetchAsset('node-1', 'unknown')).rejects.toThrow(NotFoundError);
    });

    it('should throw InsufficientCreditsError when balance is 0', async () => {
      const mockAsset = { asset_id: 'asset-1', downloads: 5, author_id: 'node-2', status: 'published' };
      const mockNode = { node_id: 'node-1', credit_balance: 0 };

      mockPrisma.asset.findUnique.mockResolvedValue(mockAsset);
      mockPrisma.node.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);

      await expect(fetchAsset('node-1', 'asset-1')).rejects.toThrow(InsufficientCreditsError);
    });

    it('should hide non-public assets from non-authors', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'node-2',
        status: 'draft',
      });

      await expect(fetchAsset('node-1', 'asset-1')).rejects.toThrow(NotFoundError);
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
    const baseAsset = {
      asset_id: 'asset-1',
      author_id: 'node-1',
      status: 'published',
      confidence: 0.8,
      version: 1,
    };

    const goodNode = { node_id: 'node-1', reputation: 50, credit_balance: 100 };

    const goodGdiRecord = {
      asset_id: 'asset-1',
      overall: 45,
      gdiLower: 30,
      gdiMean: 45,
      intrinsic: 0.6,
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockPrisma.asset.update.mockResolvedValue({});
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.evolutionEvent.create.mockResolvedValue({});
    });

    it('should promote when all 5 conditions are met', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(baseAsset);
      mockPrisma.gDIScoreRecord.findUnique.mockResolvedValue(goodGdiRecord);
      mockPrisma.node.findUnique.mockResolvedValue(goodNode);
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await promoteAsset('asset-1');

      expect(result.promoted).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(mockPrisma.asset.update).toHaveBeenCalledWith({
        where: { asset_id: 'asset-1' },
        data: { status: 'promoted' },
      });
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'ASSET_PROMOTED', amount: 100 }),
      });
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        data: { credit_balance: { increment: 100 } },
      });
    });

    it('should reject when gdi_lower < 25', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(baseAsset);
      mockPrisma.gDIScoreRecord.findUnique.mockResolvedValue({ ...goodGdiRecord, gdiLower: 20 });
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await promoteAsset('asset-1');

      expect(result.promoted).toBe(false);
      expect(result.reason).toMatch(/gdi_lower_/);
      expect(mockPrisma.asset.update).not.toHaveBeenCalled();
    });

    it('should reject when intrinsic < 0.4', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(baseAsset);
      mockPrisma.gDIScoreRecord.findUnique.mockResolvedValue({ ...goodGdiRecord, intrinsic: 0.3 });
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await promoteAsset('asset-1');

      expect(result.promoted).toBe(false);
      expect(result.reason).toMatch(/intrinsic_/);
    });

    it('should reject when confidence < 0.5', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({ ...baseAsset, confidence: 0.3 });
      mockPrisma.gDIScoreRecord.findUnique.mockResolvedValue(goodGdiRecord);
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await promoteAsset('asset-1');

      expect(result.promoted).toBe(false);
      expect(result.reason).toMatch(/confidence_/);
    });

    it('should reject when node reputation < 30', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(baseAsset);
      mockPrisma.gDIScoreRecord.findUnique.mockResolvedValue(goodGdiRecord);
      mockPrisma.node.findUnique.mockResolvedValue({ ...goodNode, reputation: 20 });
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await promoteAsset('asset-1');

      expect(result.promoted).toBe(false);
      expect(result.reason).toMatch(/node_reputation_/);
    });

    it('should reject when validation majority-failed', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(baseAsset);
      mockPrisma.gDIScoreRecord.findUnique.mockResolvedValue(goodGdiRecord);
      mockPrisma.node.findUnique.mockResolvedValue(goodNode);
      mockPrisma.dispute.findMany.mockResolvedValue([
        { status: 'resolved', notes: ['fail'] },
        { status: 'resolved', notes: ['fail'] },
        { status: 'resolved', notes: ['pass'] },
      ]);

      const result = await promoteAsset('asset-1');

      expect(result.promoted).toBe(false);
      expect(result.reason).toBe('validation_majority_failed');
    });

    it('should allow promotion when disputes exist but no majority failure', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(baseAsset);
      mockPrisma.gDIScoreRecord.findUnique.mockResolvedValue(goodGdiRecord);
      mockPrisma.node.findUnique.mockResolvedValue(goodNode);
      mockPrisma.dispute.findMany.mockResolvedValue([
        { status: 'resolved', notes: ['pass'] },
        { status: 'resolved', notes: ['fail'] },
      ]);

      const result = await promoteAsset('asset-1');

      expect(result.promoted).toBe(true);
    });

    it('should recalculate GDI when record is stale (older than 30 days)', async () => {
      const staleRecord = { ...goodGdiRecord, updatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) };
      const assetWithSignals = { ...baseAsset, description: 'A good description for testing purposes here', signals: ['sig1', 'sig2'], config: {}, updated_at: new Date(), created_at: new Date(), last_verified_at: null };
      mockPrisma.asset.findUnique.mockResolvedValue(assetWithSignals);
      mockPrisma.gDIScoreRecord.findUnique.mockResolvedValue(staleRecord);
      mockPrisma.gDIScoreRecord.upsert.mockResolvedValue({});
      mockPrisma.node.findUnique.mockResolvedValue(goodNode);
      mockPrisma.dispute.findMany.mockResolvedValue([]);
      mockPrisma.assetDownload.findMany.mockResolvedValue([]);
      mockPrisma.assetVote.findMany.mockResolvedValue([]);
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([]);
      mockPrisma.gDIScoreRecord.create.mockResolvedValue({ calculated_at: new Date() });
      mockPrisma.asset.update.mockResolvedValue({});

      const result = await promoteAsset('asset-1');

      expect(mockPrisma.gDIScoreRecord.upsert).toHaveBeenCalled();
      expect(result.promoted).toBe(true);
    });

    it('should return already_promoted for promoted assets', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({ ...baseAsset, status: 'promoted' });

      const result = await promoteAsset('asset-1');

      expect(result.promoted).toBe(false);
      expect(result.reason).toBe('already_promoted');
    });

    it('should return already_rejected for rejected assets', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({ ...baseAsset, status: 'rejected' });

      const result = await promoteAsset('asset-1');

      expect(result.promoted).toBe(false);
      expect(result.reason).toBe('already_rejected');
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
        confidence: 0.9,
        execution_count: 5,
        description: 'A comprehensive description that exceeds two hundred characters for the quality metric test',
        signals: ['signal1', 'signal2', 'signal3'],
        config: {},
        author_id: 'node-1',
        updated_at: new Date(),
        created_at: new Date(),
        last_verified_at: null,
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
      mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-1', reputation: 60 });
      mockPrisma.assetDownload.findMany.mockResolvedValue([{ node_id: 'node-1' }]);
      mockPrisma.assetVote.findMany.mockResolvedValue([{ vote_type: 'up' }]);
      mockPrisma.dispute.findMany.mockResolvedValue([]);
      mockPrisma.evolutionEvent.findMany.mockResolvedValue([]);
      mockPrisma.gDIScoreRecord.create.mockResolvedValue(mockGdiRecord);
      mockPrisma.asset.update.mockResolvedValue({});

      const result = await calculateGDI('asset-1');

      expect(result.asset_id).toBe('asset-1');
      expect(result.dimensions).toHaveProperty('intrinsic');
      expect(result.dimensions).toHaveProperty('usage_mean');
      expect(result.dimensions).toHaveProperty('social_mean');
      expect(result.dimensions).toHaveProperty('freshness');
      expect(mockPrisma.asset.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError for unknown asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);
      await expect(calculateGDI('unknown')).rejects.toThrow(NotFoundError);
    });
  });
});
