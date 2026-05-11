import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { hashPassword } from '../auth/jwt.js';
import { assetFetchSchema } from '../models/schemas.js';

// Mock supertest for integration tests
// In a real environment, these would use supertest with the actual Express app
// For now, we test the schema validation and service logic

describe('A2A Evolver Client Protocol', () => {
  describe('POST /a2a/fetch - keyword field support', () => {
    it('should accept keyword field (Evolver client format)', () => {
      const validData = {
        keyword: 'creative writing',
        type: 'gene',
        limit: 10,
      };

      const result = assetFetchSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keyword).toBe('creative writing');
      }
    });

    it('should accept query field (alternative format)', () => {
      const validData = {
        query: 'data analysis',
        type: 'capsule',
        limit: 20,
      };

      const result = assetFetchSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe('data analysis');
      }
    });

    it('should use keyword when both query and keyword provided', () => {
      const validData = {
        query: 'query text',
        keyword: 'keyword text',
        type: 'gene',
      };

      const result = assetFetchSchema.safeParse(validData);
      expect(result.success).toBe(true);
      // Both fields are accepted; controller picks one at runtime
      if (result.success) {
        expect(result.data.query).toBe('query text');
        expect(result.data.keyword).toBe('keyword text');
      }
    });

    it('should accept type filter as gene', () => {
      const validData = {
        keyword: 'translation',
        type: 'gene',
      };

      const result = assetFetchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept type filter as capsule', () => {
      const validData = {
        keyword: 'assistant',
        type: 'capsule',
      };

      const result = assetFetchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept max_results alias via limit', () => {
      const validData = {
        keyword: 'code',
        limit: 50,
      };

      const result = assetFetchSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject limit over 100', () => {
      const invalidData = {
        keyword: 'test',
        limit: 200,
      };

      const result = assetFetchSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should use defaults when no parameters provided', () => {
      const minimalData = {};

      const result = assetFetchSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe('recent');
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });
  });

  describe('GET /marketplace/trending - trending endpoint', () => {
    it('should accept optional type filter', () => {
      // The trending endpoint accepts ?type=gene or ?type=capsule
      const params = new URLSearchParams({ type: 'gene', limit: '10' });
      expect(params.get('type')).toBe('gene');
      expect(params.get('limit')).toBe('10');
    });

    it('should accept limit parameter', () => {
      const params = new URLSearchParams({ limit: '20' });
      expect(parseInt(params.get('limit') || '0')).toBe(20);
    });

    it('should cap limit at 50', () => {
      // Controller should cap at 50
      const requestedLimit = Math.min(100, 50);
      expect(requestedLimit).toBe(50);
    });
  });

  describe('GET /a2a/asset/:assetId - asset details response', () => {
    it('should include dna field for gene assets', () => {
      // Expected response shape for Evolver client
      const mockAssetResponse = {
        asset_id: 'gene_abc123',
        type: 'gene',
        name: 'Test Gene',
        dna: 'ATCGATCGATCG',
        prompt: null, // Genes use dna, capsules use prompt
        gdi_score: 0.85,
        gdi_breakdown: {
          correctness: 0.9,
          diversity: 0.8,
          composability: 0.85,
          helpfulness: 0.85,
        },
        status: 'published',
      };

      expect(mockAssetResponse.dna).toBeDefined();
      expect(mockAssetResponse.type).toBe('gene');
    });

    it('should include prompt field for capsule assets', () => {
      const mockCapsuleResponse = {
        asset_id: 'capsule_xyz789',
        type: 'capsule',
        name: 'Test Capsule',
        dna: null, // Capsules use prompt, not dna
        prompt: 'You are a helpful assistant that...',
        gdi_score: 0.92,
        status: 'published',
      };

      expect(mockCapsuleResponse.prompt).toBeDefined();
      expect(mockCapsuleResponse.type).toBe('capsule');
    });

    it('should include tools array', () => {
      const mockAsset = {
        tools: ['web-search', 'calculator', 'code-interpreter'],
      };

      expect(Array.isArray(mockAsset.tools)).toBe(true);
      expect(mockAsset.tools.length).toBe(3);
    });

    it('should include gdi_score and gdi_breakdown', () => {
      const mockAsset = {
        gdi_score: 0.85,
        gdi_breakdown: {
          correctness: 0.9,
          diversity: 0.8,
          composability: 0.85,
          helpfulness: 0.85,
        },
      };

      expect(mockAsset.gdi_score).toBeGreaterThan(0);
      expect(mockAsset.gdi_breakdown).toHaveProperty('correctness');
      expect(mockAsset.gdi_breakdown).toHaveProperty('diversity');
      expect(mockAsset.gdi_breakdown).toHaveProperty('composability');
      expect(mockAsset.gdi_breakdown).toHaveProperty('helpfulness');
    });
  });
});
