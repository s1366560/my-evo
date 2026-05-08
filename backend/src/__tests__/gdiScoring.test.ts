/**
 * GDI Scoring Service Tests
 */

import { GDIScoringService, AssetContent } from '../services/gdiScoringService';

describe('GDIScoringService', () => {
  let service: GDIScoringService;

  beforeEach(() => {
    service = new GDIScoringService();
  });

  describe('calculateScore', () => {
    it('should calculate GDI score for a gene asset', async () => {
      const gene: AssetContent = {
        type: 'gene',
        name: 'CodeReviewGene',
        description: 'AI-powered code review assistant that analyzes code quality and suggests improvements',
        content: {
          dna: 'function analyzeCode(input) { return process(input); }',
          tools: ['github-api', 'llm-client', 'json-parser'],
          model: 'gpt-4',
        },
        tags: ['code-review', 'ai', 'automation', 'quality'],
        license: 'MIT',
      };

      const result = await service.calculateScore(gene);

      expect(result.overall).toBeGreaterThan(0);
      expect(result.correctness).toBeGreaterThan(0);
      expect(result.diversity).toBeGreaterThan(0);
      expect(result.composability).toBeGreaterThan(0);
      expect(result.helpfulness).toBeGreaterThan(0);
    });

    it('should calculate GDI score for a capsule asset', async () => {
      const capsule: AssetContent = {
        type: 'capsule',
        name: 'ResearchAssistant',
        description: 'A helpful assistant for academic research and paper summarization with advanced NLP capabilities',
        content: {
          prompt: 'You are a research assistant. Help users find and summarize academic papers.',
          tools: ['arxiv-api', 'pdf-reader', 'llm-client'],
          model: 'claude-3',
        },
        tags: ['research', 'academic', 'papers', 'nlp', 'summarization'],
        license: 'Apache-2.0',
      };

      const result = await service.calculateScore(capsule);

      expect(result.overall).toBeGreaterThan(0);
      expect(result.correctness).toBeGreaterThan(0);
      expect(result.diversity).toBeGreaterThan(0);
    });

    it('should score higher for assets with good descriptions', async () => {
      const poorDesc: AssetContent = {
        type: 'gene',
        name: 'TestGene',
        content: { dna: 'function test() {}' },
        tags: ['test'],
      };

      const goodDesc: AssetContent = {
        type: 'gene',
        name: 'TestGene',
        description: 'A comprehensive test gene with extensive documentation and multiple use cases',
        content: { dna: 'function test() {}' },
        tags: ['test', 'testing', 'qa', 'automation'],
      };

      const poorResult = await service.calculateScore(poorDesc);
      const goodResult = await service.calculateScore(goodDesc);

      expect(goodResult.correctness).toBeGreaterThanOrEqual(poorResult.correctness);
    });

    it('should score higher for assets with diverse tags', async () => {
      const singleTag: AssetContent = {
        type: 'gene',
        name: 'TestGene',
        description: 'A test gene',
        content: { dna: 'function test() {}' },
        tags: ['ai'],
      };

      const multiTag: AssetContent = {
        type: 'gene',
        name: 'TestGene',
        description: 'A test gene',
        content: { dna: 'function test() {}' },
        tags: ['ai', 'ml', 'nlp', 'deep-learning', 'transformers'],
      };

      const singleResult = await service.calculateScore(singleTag);
      const multiResult = await service.calculateScore(multiTag);

      expect(multiResult.diversity).toBeGreaterThanOrEqual(singleResult.diversity);
    });

    it('should score higher for assets with proper tool definitions', async () => {
      const noTools: AssetContent = {
        type: 'capsule',
        name: 'TestCapsule',
        content: { prompt: 'A simple prompt' },
        tags: ['test'],
      };

      const withTools: AssetContent = {
        type: 'capsule',
        name: 'TestCapsule',
        content: {
          prompt: 'A comprehensive prompt',
          tools: ['http-client', 'json-parser', 'rest-api'],
        },
        tags: ['test'],
      };

      const noToolsResult = await service.calculateScore(noTools);
      const withToolsResult = await service.calculateScore(withTools);

      expect(withToolsResult.composability).toBeGreaterThanOrEqual(noToolsResult.composability);
    });

    it('should give bonus for open source licenses', async () => {
      const closed: AssetContent = {
        type: 'gene',
        name: 'TestGene',
        description: 'A test gene',
        content: { dna: 'function test() {}' },
        tags: ['test'],
        license: 'CLOSED',
      };

      const mit: AssetContent = {
        type: 'gene',
        name: 'TestGene',
        description: 'A test gene',
        content: { dna: 'function test() {}' },
        tags: ['test'],
        license: 'MIT',
      };

      const closedResult = await service.calculateScore(closed);
      const mitResult = await service.calculateScore(mit);

      expect(mitResult.correctness).toBeGreaterThanOrEqual(closedResult.correctness);
    });
  });

  describe('batchScore', () => {
    it('should score multiple assets', async () => {
      const assets: AssetContent[] = [
        {
          type: 'gene',
          name: 'Gene1',
          content: { dna: 'function one() {}' },
          tags: ['test'],
        },
        {
          type: 'capsule',
          name: 'Capsule1',
          content: { prompt: 'A capsule prompt' },
          tags: ['research'],
        },
      ];

      const results = await service.batchScore(assets);

      expect(results.size).toBe(2);
      expect(results.has('Gene1')).toBe(true);
      expect(results.has('Capsule1')).toBe(true);
    });
  });

  describe('recalculateWithMetrics', () => {
    it('should recalculate score with review ratings', () => {
      const baseScore = {
        overall: 0.7,
        correctness: 0.8,
        diversity: 0.7,
        composability: 0.6,
        helpfulness: 0.7,
      };

      const result = service.recalculateWithMetrics(baseScore, {
        avgRating: 4.5,
      });

      expect(result.helpfulness).toBeGreaterThan(baseScore.helpfulness);
    });

    it('should boost helpfulness for high call counts', () => {
      const baseScore = {
        overall: 0.7,
        correctness: 0.8,
        diversity: 0.7,
        composability: 0.6,
        helpfulness: 0.7,
      };

      const result = service.recalculateWithMetrics(baseScore, {
        callCount: 200,
      });

      expect(result.helpfulness).toBeGreaterThanOrEqual(baseScore.helpfulness);
    });
  });

  describe('score boundaries', () => {
    it('should return scores between 0 and 1', async () => {
      const asset: AssetContent = {
        type: 'gene',
        name: 'TestGene',
        description: 'A test gene with comprehensive features',
        content: {
          dna: 'function analyze(input) { return process(input); }',
          tools: ['api', 'http', 'json'],
          model: 'gpt-4',
        },
        tags: ['test', 'code', 'analysis', 'automation'],
        license: 'MIT',
      };

      const result = await service.calculateScore(asset);

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
      expect(result.correctness).toBeGreaterThanOrEqual(0);
      expect(result.correctness).toBeLessThanOrEqual(1);
      expect(result.diversity).toBeGreaterThanOrEqual(0);
      expect(result.diversity).toBeLessThanOrEqual(1);
      expect(result.composability).toBeGreaterThanOrEqual(0);
      expect(result.composability).toBeLessThanOrEqual(1);
      expect(result.helpfulness).toBeGreaterThanOrEqual(0);
      expect(result.helpfulness).toBeLessThanOrEqual(1);
    });
  });
});
