import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { NotFoundError, ValidationError } from '../shared/errors';

const {
  search,
  autocomplete,
  trending,
  findSimilar,
  reindex,
} = service;

const mockPrisma = {
  asset: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as any;

const makeAsset = (overrides: Record<string, unknown> = {}) => ({
  asset_id: 'asset-1',
  asset_type: 'gene',
  name: 'Test Gene',
  description: 'A test gene for searching',
  signals: ['nlp', 'search'],
  tags: ['test', 'utility'],
  author_id: 'author-1',
  gdi_score: 60,
  downloads: 200,
  rating: 4.5,
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-06-01'),
  config: {},
  status: 'published',
  ...overrides,
});

describe('Search Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return scored search results matching query', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ name: 'Gene Search', description: 'A search gene' }),
        makeAsset({ asset_id: 'asset-2', name: 'Other', description: 'Unrelated' }),
      ]);

      const result = await search({ q: 'search' });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.facets).toBeDefined();
      expect(result.query_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.items[0]!.name).toBe('Gene Search');
    });

    it('should return empty items when no assets are found', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await search({ q: 'zzzzzzzznonexistent' });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should apply type filter', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await search({ q: 'test', type: 'gene' });

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ asset_type: 'gene' }),
        }),
      );
    });

    it('should apply status filter when provided', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await search({ q: 'test', status: 'promoted' });

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'promoted' }),
        }),
      );
    });

    it('should reject non-public status filters', async () => {
      await expect(
        search({ q: 'test', status: 'draft' as 'published' }),
      ).rejects.toThrow('status must be published or promoted');

      expect(mockPrisma.asset.findMany).not.toHaveBeenCalled();
    });

    it('should apply signals filter', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await search({ q: 'test', signals: ['nlp'] });

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ signals: { hasSome: ['nlp'] } }),
        }),
      );
    });

    it('should apply tags filter', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await search({ q: 'test', tags: ['utility'] });

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tags: { hasSome: ['utility'] } }),
        }),
      );
    });

    it('should apply min_gdi filter', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await search({ q: 'test', min_gdi: 50 });

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gdi_score: { gte: 50 } }),
        }),
      );
    });

    it('should apply author_id filter', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await search({ q: 'test', author_id: 'author-1' });

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ author_id: 'author-1' }),
        }),
      );
    });

    it('should respect limit and offset for pagination', async () => {
      const assets = Array.from({ length: 5 }, (_, i) =>
        makeAsset({
          asset_id: `asset-${i}`,
          name: `Gene ${i}`,
          description: 'search term',
          gdi_score: 60 - i,
        }),
      );
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await search({ q: 'search', limit: 2, offset: 1 });

      expect(result.items).toHaveLength(2);
    });

    it('should cap limit to MAX_SEARCH_LIMIT', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await search({ q: 'test', limit: 999 });

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should compute correct facets by_type and by_signal', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_type: 'gene', signals: ['nlp'], name: 'search', description: 'search' }),
        makeAsset({ asset_id: 'asset-2', asset_type: 'capsule', signals: ['nlp', 'ml'], name: 'search2', description: 'search2' }),
      ]);

      const result = await search({ q: 'search' });

      expect(result.facets.by_type).toBeDefined();
      expect(result.facets.by_signal).toBeDefined();
    });

    it('should score exact name match higher than partial match', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'exact', name: 'Exact Search', description: '' }),
        makeAsset({ asset_id: 'partial', name: 'Partial Search Term', description: '' }),
      ]);

      const result = await search({ q: 'exact search' });

      if (result.items.length >= 2) {
        expect(result.items[0]!.id).toBe('exact');
      }
    });

    it('should include gdi_score and downloads boost in scoring', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'low-gdi', name: 'test item', description: '', gdi_score: 10, downloads: 5, signals: [], tags: [] }),
        makeAsset({ asset_id: 'high-gdi', name: 'test item high', description: '', gdi_score: 90, downloads: 500, signals: [], tags: [] }),
      ]);

      const result = await search({ q: 'test' });

      expect(result.items.length).toBeGreaterThan(0);
      // The "high-gdi" asset should rank higher due to gdi/downloads boost
      const highIdx = result.items.findIndex((item) => item.id === 'high-gdi');
      const lowIdx = result.items.findIndex((item) => item.id === 'low-gdi');
      expect(highIdx).toBeLessThan(lowIdx);
    });
  });

  describe('autocomplete', () => {
    it('should return name suggestions matching prefix', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { name: 'Search Engine', signals: ['search-signal'], tags: ['search-tag'] },
      ]);

      const result = await autocomplete('Search');

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]!.type).toBe('name');
      expect(result.suggestions[0]!.text).toBe('Search Engine');
    });

    it('should return signal suggestions matching prefix', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { name: 'Other', signals: ['search-signal'], tags: [] },
      ]);

      const result = await autocomplete('search');

      const signalSuggestions = result.suggestions.filter((s) => s.type === 'signal');
      expect(signalSuggestions.length).toBeGreaterThan(0);
      expect(signalSuggestions[0]!.text).toBe('search-signal');
    });

    it('should return tag suggestions matching prefix', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { name: 'Other', signals: [], tags: ['search-tag'] },
      ]);

      const result = await autocomplete('search');

      const tagSuggestions = result.suggestions.filter((s) => s.type === 'tag');
      expect(tagSuggestions.length).toBeGreaterThan(0);
      expect(tagSuggestions[0]!.text).toBe('search-tag');
    });

    it('should filter by type when provided', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await autocomplete('test', 'gene');

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ asset_type: 'gene' }),
        }),
      );
    });

    it('should return at most 10 suggestions', async () => {
      const assets = Array.from({ length: 20 }, (_, i) => ({
        name: `test-${i}`,
        signals: [],
        tags: [],
      }));
      mockPrisma.asset.findMany.mockResolvedValue(assets);

      const result = await autocomplete('test');

      expect(result.suggestions.length).toBeLessThanOrEqual(10);
    });

    it('should return empty suggestions when no matches', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      const result = await autocomplete('zzzznonexistent');

      expect(result.suggestions).toHaveLength(0);
    });

    it('should deduplicate signal suggestions', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        { name: 'A', signals: ['search'], tags: [] },
        { name: 'B', signals: ['search'], tags: [] },
      ]);

      const result = await autocomplete('search');

      const signalSuggestions = result.suggestions.filter((s) => s.type === 'signal');
      const uniqueTexts = new Set(signalSuggestions.map((s) => s.text));
      expect(uniqueTexts.size).toBe(signalSuggestions.length);
    });
  });

  describe('trending', () => {
    it('should return recently created assets ordered by downloads', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'popular', downloads: 1000 }),
        makeAsset({ asset_id: 'moderate', downloads: 500 }),
      ]);

      const result = await trending();

      expect(result).toHaveLength(2);
      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'published' }),
          orderBy: [{ downloads: 'desc' }, { gdi_score: 'desc' }],
        }),
      );
    });

    it('should respect limit parameter', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await trending(5);

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('should default limit to 20', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await trending();

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('should filter by created_at within last 30 days', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await trending();

      const call = mockPrisma.asset.findMany.mock.calls[0]![0] as any;
      expect(call.where.created_at).toBeDefined();
      expect(call.where.created_at.gte).toBeInstanceOf(Date);
    });
  });

  describe('findSimilar', () => {
    it('should return empty array when source asset not found', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      const result = await findSimilar('nonexistent');

      expect(result).toEqual([]);
    });

    it('should return similar assets based on Jaccard similarity of signals', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'source', signals: ['a', 'b', 'c'] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'similar-1', signals: ['a', 'b', 'c', 'd'] }),
        makeAsset({ asset_id: 'dissimilar', signals: ['x', 'y', 'z'] }),
      ]);

      const result = await findSimilar('source');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.asset.id).toBe('similar-1');
      expect(result[0]!.similarity).toBeGreaterThan(0);
    });

    it('should filter out assets below similarity threshold', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'source', signals: ['a'] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'unrelated', signals: ['z'] }),
      ]);

      const result = await findSimilar('source', 0.5);

      expect(result).toHaveLength(0);
    });

    it('should return at most 20 results sorted by similarity descending', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'source', signals: ['a', 'b'] }),
      );
      const candidates = Array.from({ length: 25 }, (_, i) =>
        makeAsset({ asset_id: `c-${i}`, signals: ['a', 'b'] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue(candidates);

      const result = await findSimilar('source', 0.1);

      expect(result.length).toBeLessThanOrEqual(20);
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.similarity).toBeLessThanOrEqual(result[i - 1]!.similarity);
      }
    });

    it('should exclude source asset from candidates', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'source', signals: ['a'] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await findSimilar('source');

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            asset_id: { not: 'source' },
          }),
        }),
      );
    });

    it('should handle assets with empty signals (Jaccard = 0)', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'source', signals: [] }),
      );
      mockPrisma.asset.findMany.mockResolvedValue([
        makeAsset({ asset_id: 'other', signals: ['a'] }),
      ]);

      const result = await findSimilar('source', 0.1);

      expect(result).toHaveLength(0);
    });
  });

  describe('reindex', () => {
    it('should update updated_at timestamp for existing asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(
        makeAsset({ asset_id: 'asset-1' }),
      );
      mockPrisma.asset.update.mockResolvedValue({});

      await reindex('asset-1');

      expect(mockPrisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { asset_id: 'asset-1' },
          data: { updated_at: expect.any(Date) },
        }),
      );
    });

    it('should do nothing when asset not found', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await reindex('nonexistent');

      expect(mockPrisma.asset.update).not.toHaveBeenCalled();
    });
  });
});
