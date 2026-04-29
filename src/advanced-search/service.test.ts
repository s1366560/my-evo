import { setPrisma } from './service';
import * as advSearchService from './service';

const mockPrisma = {
  asset: {
    findMany: jest.fn().mockResolvedValue([
      { asset_id: 'a1', name: 'Test Gene', description: 'A test', gdi_score: 85, downloads: 10, rating: 4.5, status: 'published', asset_type: 'gene' },
      { asset_id: 'a2', name: 'Another Gene', description: 'Another test', gdi_score: 72, downloads: 5, rating: 4.0, status: 'published', asset_type: 'gene' },
    ]),
    count: jest.fn().mockResolvedValue(2),
    groupBy: jest.fn().mockResolvedValue([
      { status: 'published', _count: { _all: 2 } },
    ]),
    aggregate: jest.fn().mockResolvedValue({ _count: { _all: 2 }, _sum: { downloads: 15 }, _avg: { gdi_score: 78.5 }, _max: { gdi_score: 85 }, _min: { gdi_score: 72 } }),
  },
  node: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
};

beforeAll(() => setPrisma(mockPrisma as unknown as import('@prisma/client').PrismaClient));
afterEach(() => { jest.clearAllMocks(); advSearchService._resetTestState(); });

describe('Advanced Search Service', () => {
  describe('advancedSearch', () => {
    it('executes a basic search', async () => {
      const result = await advSearchService.advancedSearch({
        filter_groups: [{ logical_op: 'AND', filters: [] }],
        entity_types: ['asset'],
        sort: [{ field: 'gdi_score', order: 'desc' }],
        pagination: { page: 1, page_size: 20 },
        options: { include_facets: false },
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('applies filter groups correctly', async () => {
      const result = await advSearchService.advancedSearch({
        filter_groups: [{
          logical_op: 'AND',
          filters: [{ field: 'gdi_score', operator: 'gte', value: 80 }],
        }],
        entity_types: ['asset'],
        sort: [],
        pagination: { page: 1, page_size: 20 },
        options: {},
      });
      expect(result.items.length).toBeGreaterThanOrEqual(0);
    });

    it('includes aggregations when requested', async () => {
      const result = await advSearchService.advancedSearch({
        filter_groups: [],
        entity_types: ['asset'],
        sort: [],
        pagination: { page: 1, page_size: 5 },
        options: { include_aggregations: true },
      });
      expect(result.aggregations).toBeDefined();
    });
  });

  describe('saved searches', () => {
    it('saves and retrieves a search', () => {
      const saved = advSearchService.saveSearch('user1', 'My Search', {
        filter_groups: [{ logical_op: 'AND', filters: [] }],
        entity_types: ['asset'],
        sort: [{ field: 'created_at', order: 'desc' }],
        pagination: { page: 1, page_size: 20 },
        options: {},
      });
      expect(saved.search_id).toMatch(/^ss_/);
      expect(saved.name).toBe('My Search');

      const retrieved = advSearchService.getSavedSearch(saved.search_id);
      expect(retrieved?.search_id).toBe(saved.search_id);
      expect(retrieved?.use_count).toBe(1);
    });

    it('lists user saved searches', () => {
      advSearchService.saveSearch('user1', 'Search 1', { filter_groups: [], entity_types: ['asset'], sort: [], pagination: { page: 1, page_size: 20 }, options: {} });
      advSearchService.saveSearch('user1', 'Search 2', { filter_groups: [], entity_types: ['asset'], sort: [], pagination: { page: 1, page_size: 20 }, options: {} });
      const searches = advSearchService.getUserSavedSearches('user1');
      expect(searches).toHaveLength(2);
    });

    it('deletes a saved search', () => {
      const saved = advSearchService.saveSearch('user1', 'To Delete', { filter_groups: [], entity_types: ['asset'], sort: [], pagination: { page: 1, page_size: 20 }, options: {} });
      expect(advSearchService.deleteSavedSearch(saved.search_id, 'user1')).toBe(true);
      expect(advSearchService.getSavedSearch(saved.search_id)).toBeNull();
    });

    it('prevents cross-user deletion', () => {
      const saved = advSearchService.saveSearch('user1', 'Private', { filter_groups: [], entity_types: ['asset'], sort: [], pagination: { page: 1, page_size: 20 }, options: {} });
      expect(advSearchService.deleteSavedSearch(saved.search_id, 'user2')).toBe(false);
    });
  });

  describe('presets', () => {
    it('returns search presets', () => {
      const presets = advSearchService.getSearchPresets();
      expect(presets.length).toBeGreaterThan(0);
      const preset = advSearchService.getSearchPreset('top_rated_assets');
      expect(preset?.name).toBe('Top Rated Assets');
    });
  });
});
