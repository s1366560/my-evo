import { PrismaClient } from '@prisma/client';
import * as assetsService from './assets_service';
import { NotFoundError, ValidationError } from '../shared/errors';

const mockPrisma = {
  asset: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  evolutionEvent: {
    findMany: jest.fn(),
  },
  creditTransaction: {
    findMany: jest.fn(),
  },
  gDIScoreRecord: {
    findMany: jest.fn(),
  },
  assetDownload: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  assetVote: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  question: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  node: {
    findUnique: jest.fn(),
    groupBy: jest.fn(),
  },
  hallucinationCheck: {
    findMany: jest.fn(),
  },
  capabilityChain: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((ops: unknown) => {
    if (typeof ops === 'function') {
      return ops(mockPrisma as unknown as PrismaClient);
    }
    return Promise.resolve(ops);
  }),
} as unknown as PrismaClient;

describe('A2A assets service', () => {
  beforeAll(() => {
    assetsService.setPrisma(mockPrisma);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.$transaction as jest.Mock).mockImplementation((ops: unknown) => {
      if (typeof ops === 'function') {
        return ops(mockPrisma as unknown as PrismaClient);
      }
      return Promise.resolve(ops);
    });
  });

  it('should verify real evolution history instead of returning a placeholder failure', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      asset_type: 'gene',
      name: 'Asset One',
      description: 'content asset',
      status: 'published',
      content: 'content',
      signals: ['sig-1'],
      tags: ['memory'],
      gdi_score: 80,
      downloads: 0,
      rating: 0,
      author_id: 'node-1',
      version: 1,
      fork_count: 0,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    });
    (mockPrisma.evolutionEvent.findMany as jest.Mock).mockResolvedValue([
      { event_type: 'published' },
    ]);

    const result = await assetsService.verifyAsset('asset-1');
    const historyCheck = result.checks.find((check) => check.name === 'has_history');

    expect(result.valid).toBe(true);
    expect(historyCheck).toEqual(
      expect.objectContaining({
        passed: true,
        detail: 'Latest event: published',
      }),
    );
  });

  it('should calculate my usage from downloads, votes, and reviews', async () => {
    (mockPrisma.node.findUnique as jest.Mock).mockResolvedValue({ node_id: 'node-1' });
    (mockPrisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([
      { amount: -3 },
      { amount: -2 },
    ]);
    (mockPrisma.assetDownload.findMany as jest.Mock).mockResolvedValue([
      { asset_id: 'asset-1' },
      { asset_id: 'asset-1' },
      { asset_id: 'asset-2' },
    ]);
    (mockPrisma.assetVote.findMany as jest.Mock).mockResolvedValue([
      { asset_id: 'asset-3' },
    ]);
    (mockPrisma.question.findMany as jest.Mock).mockResolvedValue([
      { tags: ['review', 'asset:asset-2', 'rating:5'] },
    ]);

    const result = await assetsService.getMyUsage('node-1');

    expect(result).toEqual({
      assets_used: 2,
      credits_spent: 5,
      downloads: 3,
      rated_assets: 2,
    });
  });

  it('should require an asset to be fetched before review submission', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      name: 'Asset One',
      status: 'published',
    });
    (mockPrisma.assetDownload.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      assetsService.submitReview('node-1', 'asset-1', 5, 'Great asset'),
    ).rejects.toThrow(ValidationError);
  });

  it('should submit a review and update aggregate rating', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      name: 'Asset One',
      author_id: 'node-9',
      status: 'published',
    });
    (mockPrisma.assetDownload.findFirst as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      node_id: 'node-1',
    });
    (mockPrisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.question.create as jest.Mock).mockResolvedValue({});
    (mockPrisma.question.findMany as jest.Mock).mockResolvedValue([
      { tags: ['review', 'asset:asset-1', 'rating:5'] },
    ]);
    (mockPrisma.assetVote.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.asset.update as jest.Mock).mockResolvedValue({});

    const result = await assetsService.submitReview('node-1', 'asset-1', 5, 'Great asset');

    expect(result.review_id).toBeDefined();
    expect(mockPrisma.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          question_id: 'review:asset-1:node-1',
          tags: ['review', 'asset:asset-1', 'rating:5'],
          body: 'Great asset',
        }),
      }),
    );
    expect(mockPrisma.asset.update).toHaveBeenCalledWith({
      where: { asset_id: 'asset-1' },
      data: { rating: 5 },
    });
  });

  it('should reject self-reviews by the asset author', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      name: 'Asset One',
      author_id: 'node-1',
      status: 'published',
    });

    await expect(
      assetsService.submitReview('node-1', 'asset-1', 5, 'Great asset'),
    ).rejects.toThrow('Authors cannot rate their own assets');
  });

  it('should translate duplicate concurrent review creation into a validation error', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      name: 'Asset One',
      status: 'published',
    });
    (mockPrisma.assetDownload.findFirst as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      node_id: 'node-1',
    });
    (mockPrisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.question.create as jest.Mock).mockRejectedValue({ code: 'P2002' });

    await expect(
      assetsService.submitReview('node-1', 'asset-1', 5, 'Great asset'),
    ).rejects.toThrow(ValidationError);
  });

  it('should perform semantic search in Prisma instead of filtering in memory', async () => {
    (mockPrisma.asset.findMany as jest.Mock).mockResolvedValue([
      {
        asset_id: 'asset-1',
        asset_type: 'Gene',
        name: 'Agent Memory',
        description: 'desc',
        status: 'published',
        author_id: 'node-1',
        gdi_score: 90,
        downloads: 1,
        rating: 4.5,
        signals: ['agent', 'memory'],
        tags: ['agent'],
        version: 1,
        fork_count: 0,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
        content: 'secret',
        config: { hidden: true },
      },
    ]);
    (mockPrisma.asset.count as jest.Mock).mockResolvedValue(1);

    const result = await assetsService.semanticSearch({
      q: 'Agent Memory',
      type: 'Gene',
      outcome: 'promoted',
      limit: 5,
      offset: 10,
    });

    expect(result.total).toBe(1);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toEqual(expect.objectContaining({
      asset_id: 'asset-1',
      name: 'Agent Memory',
      status: 'published',
    }));
    expect((result.assets[0] as Record<string, unknown>).content).toBeUndefined();
    expect((result.assets[0] as Record<string, unknown>).config).toBeUndefined();
    expect(mockPrisma.asset.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { in: ['published', 'promoted'] },
        asset_type: 'Gene',
        AND: [
          {
            OR: expect.arrayContaining([
              { name: { contains: 'Agent Memory', mode: 'insensitive' } },
              { description: { contains: 'Agent Memory', mode: 'insensitive' } },
              { signals: { hasSome: expect.arrayContaining(['Agent Memory', 'agent', 'memory']) } },
              { tags: { hasSome: expect.arrayContaining(['Agent Memory', 'agent', 'memory']) } },
            ]),
          },
          {
            OR: expect.arrayContaining([
              { name: { contains: 'promoted', mode: 'insensitive' } },
              { description: { contains: 'promoted', mode: 'insensitive' } },
            ]),
          },
        ],
      }),
      skip: 10,
      take: 5,
      orderBy: { gdi_score: 'desc' },
    });
    expect(mockPrisma.asset.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { in: ['published', 'promoted'] },
        asset_type: 'Gene',
      }),
    });
  });

  it('should return the documented model tier catalog with grouped model counts', async () => {
    (mockPrisma.node.groupBy as jest.Mock).mockResolvedValue([
      { model: 'gpt-5', _count: { node_id: 2 } },
      { model: 'claude-haiku', _count: { node_id: 3 } },
      { model: 'mystery-model', _count: { node_id: 1 } },
    ]);

    const result = await assetsService.getModelTiers();

    expect(result.tiers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tier: 1,
        label: 'basic',
        node_count: 3,
        models: [
          expect.objectContaining({
            model: 'claude-haiku',
            tier: 1,
            label: 'basic',
            node_count: 3,
          }),
        ],
      }),
      expect.objectContaining({
        tier: 4,
        label: 'frontier',
        node_count: 2,
        models: [
          expect.objectContaining({
            model: 'gpt-5',
            tier: 4,
            label: 'frontier',
            node_count: 2,
          }),
        ],
      }),
      expect.objectContaining({
        tier: 0,
        label: 'unclassified',
        node_count: 1,
        models: [
          expect.objectContaining({
            model: 'mystery-model',
            tier: 0,
            label: 'unclassified',
            node_count: 1,
          }),
        ],
      }),
    ]));
  });

  it('should support single-model tier lookup for policy clients', async () => {
    (mockPrisma.node.groupBy as jest.Mock).mockResolvedValue([
      { model: 'gpt-5', _count: { node_id: 2 } },
    ]);

    const result = await assetsService.getModelTiers('gpt-5');

    expect(result.lookup).toEqual(expect.objectContaining({
      model: 'gpt-5',
      tier: 4,
      label: 'frontier',
      matched_by: 'exact',
      node_count: 2,
    }));
  });

  it('should reject blank semantic search queries', async () => {
    await expect(
      assetsService.semanticSearch({
        q: '   ',
      }),
    ).rejects.toThrow(ValidationError);

    expect(mockPrisma.asset.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.asset.count).not.toHaveBeenCalled();
  });

  it('should redact related assets for public discovery helpers', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      asset_type: 'gene',
      name: 'Root Asset',
      description: 'desc',
      status: 'published',
      author_id: 'node-1',
      gdi_score: 80,
      downloads: 0,
      rating: 0,
      signals: ['memory'],
      tags: ['memory'],
      version: 1,
      fork_count: 0,
      parent_id: 'parent-1',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    });
    (mockPrisma.asset.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          asset_id: 'parent-1',
          asset_type: 'gene',
          name: 'Parent Asset',
          description: 'desc',
          status: 'published',
          author_id: 'node-2',
          gdi_score: 70,
          downloads: 0,
          rating: 0,
          signals: ['memory'],
          tags: [],
          version: 1,
          fork_count: 0,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          updated_at: new Date('2026-01-02T00:00:00.000Z'),
          content: 'secret parent',
          config: { hidden: true },
        },
      ])
      .mockResolvedValueOnce([
        {
          asset_id: 'related-1',
          asset_type: 'gene',
          name: 'Related Asset',
          description: 'desc',
          status: 'published',
          author_id: 'node-3',
          gdi_score: 60,
          downloads: 0,
          rating: 0,
          signals: ['memory'],
          tags: [],
          version: 1,
          fork_count: 0,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          updated_at: new Date('2026-01-02T00:00:00.000Z'),
          content: 'secret related',
          config: { hidden: true },
        },
      ]);

    const result = await assetsService.getRelatedAssets('asset-1');
    const firstAsset = result.assets[0] as Record<string, unknown>;

    expect(firstAsset.asset_id).toBe('parent-1');
    expect(firstAsset.content).toBeUndefined();
    expect(firstAsset.config).toBeUndefined();
  });

  it('should hide private assets from timeline helpers', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      asset_type: 'gene',
      name: 'Draft Asset',
      description: 'desc',
      status: 'draft',
      author_id: 'node-1',
      gdi_score: 50,
      downloads: 0,
      rating: 0,
      signals: [],
      tags: [],
      version: 1,
      fork_count: 0,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    });

    await expect(assetsService.getAssetTimeline('asset-1')).rejects.toThrow(NotFoundError);
    expect(mockPrisma.evolutionEvent.findMany).not.toHaveBeenCalled();
  });

  it('should persist votes via AssetVote and recompute rating', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      rating: 0,
      author_id: 'node-9',
      status: 'published',
    });
    (mockPrisma.assetVote.upsert as jest.Mock).mockResolvedValue({});
    (mockPrisma.question.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.assetVote.findMany as jest.Mock).mockResolvedValue([
      { vote_type: 'up' },
    ]);
    (mockPrisma.asset.update as jest.Mock).mockResolvedValue({});

    const result = await assetsService.voteAsset('node-1', 'asset-1', 'up');

    expect(result).toEqual({
      asset_id: 'asset-1',
      new_rating: 5,
    });
    expect(mockPrisma.assetVote.upsert).toHaveBeenCalledWith({
      where: {
        asset_id_node_id: {
          asset_id: 'asset-1',
          node_id: 'node-1',
        },
      },
      update: { vote_type: 'up' },
      create: {
        asset_id: 'asset-1',
        node_id: 'node-1',
        vote_type: 'up',
      },
    });
  });

  it('should retry vote updates after a serialization failure', async () => {
    (mockPrisma.$transaction as jest.Mock)
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementation((ops: unknown) => {
        if (typeof ops === 'function') {
          return ops(mockPrisma as unknown as PrismaClient);
        }
        return Promise.resolve(ops);
      });
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      rating: 0,
      author_id: 'node-9',
      status: 'published',
    });
    (mockPrisma.assetVote.upsert as jest.Mock).mockResolvedValue({});
    (mockPrisma.question.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.assetVote.findMany as jest.Mock).mockResolvedValue([
      { vote_type: 'up' },
    ]);
    (mockPrisma.asset.update as jest.Mock).mockResolvedValue({});

    await expect(assetsService.voteAsset('node-1', 'asset-1', 'up')).resolves.toEqual({
      asset_id: 'asset-1',
      new_rating: 5,
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('should reject self-votes by the asset author', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      rating: 0,
      author_id: 'node-1',
      status: 'published',
    });

    await expect(
      assetsService.voteAsset('node-1', 'asset-1', 'up'),
    ).rejects.toThrow('Authors cannot rate their own assets');
  });

  it('should list parsed reviews for an asset', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      status: 'published',
    });
    (mockPrisma.question.findMany as jest.Mock).mockResolvedValue([
      {
        question_id: 'review-1',
        author: 'node-2',
        body: 'Helpful review',
        tags: ['review', 'asset:asset-1', 'rating:4'],
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
    (mockPrisma.question.count as jest.Mock).mockResolvedValue(1);

    const result = await assetsService.listReviews('asset-1', 20, 0);

    expect(result.total).toBe(1);
    expect(result.reviews).toEqual([
      {
        review_id: 'review-1',
        asset_id: 'asset-1',
        node_id: 'node-2',
        rating: 4,
        comment: 'Helpful review',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);
  });

  it('should not expose private fields on public detailed asset reads', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      asset_type: 'gene',
      name: 'Public Asset',
      description: 'desc',
      status: 'published',
      author_id: 'node-9',
      gdi_score: 88,
      downloads: 12,
      rating: 4.5,
      signals: ['retry'],
      tags: ['network'],
      version: 1,
      fork_count: 0,
      content: 'secret body',
      config: { hidden: true },
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    });

    const result = await assetsService.getAssetDetail('asset-1', true);

    expect(result).toEqual(
      expect.objectContaining({
        asset_id: 'asset-1',
        status: 'published',
      }),
    );
    expect(result).not.toHaveProperty('content');
    expect(result).not.toHaveProperty('config');
  });

  it('should allow the author to read private detailed asset fields', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      asset_type: 'gene',
      name: 'Draft Asset',
      description: 'desc',
      status: 'draft',
      author_id: 'node-1',
      gdi_score: 50,
      downloads: 0,
      rating: 0,
      signals: [],
      tags: [],
      version: 1,
      fork_count: 0,
      content: 'secret body',
      config: { hidden: true },
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    });

    const result = await assetsService.getAssetDetail('asset-1', true, 'node-1') as Record<string, unknown>;

    expect(result.content).toBe('secret body');
    expect(result.config).toEqual({ hidden: true });
  });

  it('should hide private asset details from non-authors', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      asset_type: 'gene',
      name: 'Draft Asset',
      description: 'desc',
      status: 'draft',
      author_id: 'node-9',
      gdi_score: 50,
      downloads: 0,
      rating: 0,
      signals: [],
      tags: [],
      version: 1,
      fork_count: 0,
      content: 'secret body',
      config: { hidden: true },
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    });

    await expect(
      assetsService.getAssetDetail('asset-1', true),
    ).rejects.toThrow(NotFoundError);
  });

  it('should hide non-public assets from votes', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      rating: 0,
      author_id: 'node-9',
      status: 'draft',
    });

    await expect(
      assetsService.voteAsset('node-1', 'asset-1', 'up'),
    ).rejects.toThrow(NotFoundError);
  });

  it('should hide non-public assets from review submission', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      name: 'Asset One',
      author_id: 'node-9',
      status: 'draft',
    });

    await expect(
      assetsService.submitReview('node-1', 'asset-1', 5, 'Great asset'),
    ).rejects.toThrow(NotFoundError);
  });

  it('should hide reviews for non-public assets', async () => {
    (mockPrisma.asset.findUnique as jest.Mock).mockResolvedValue({
      asset_id: 'asset-1',
      status: 'draft',
    });

    await expect(
      assetsService.listReviews('asset-1', 20, 0),
    ).rejects.toThrow(NotFoundError);
  });

  it('should not reveal hidden review existence through updateReview', async () => {
    (mockPrisma.question.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      assetsService.updateReview('node-1', 'asset-1', 'review:asset-1:node-2', 'edited'),
    ).rejects.toThrow(NotFoundError);
  });

  it('should not reveal hidden review existence through deleteReview', async () => {
    (mockPrisma.question.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      assetsService.deleteReview('node-1', 'asset-1', 'review:asset-1:node-2'),
    ).rejects.toThrow(NotFoundError);
  });
});
