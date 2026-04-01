// Recipe/Organism Tests

import { RecipeEngine } from '../src/recipe/engine';
import { RecipeStatus, OrganismStatus } from '../src/recipe/types';

describe('RecipeEngine', () => {
  let engine: RecipeEngine;

  beforeEach(() => {
    engine = new RecipeEngine();
  });

  describe('create', () => {
    it('creates a recipe in DRAFT status', () => {
      const recipe = engine.create({
        sender_id: 'node-1',
        title: 'Bug Fix Pipeline',
        description: 'Standardized bug fix flow',
        genes: [
          { gene_asset_id: 'sha256:gene1', position: 1, optional: false },
          { gene_asset_id: 'sha256:gene2', position: 2, optional: true },
        ],
        price_per_execution: 10,
      });

      expect(recipe.id).toMatch(/^rec_/);
      expect(recipe.status).toBe(RecipeStatus.DRAFT);
      expect(recipe.title).toBe('Bug Fix Pipeline');
      expect(recipe.genes).toHaveLength(2);
    });
  });

  describe('publish', () => {
    it('publishes a recipe', () => {
      const recipe = engine.create({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        genes: [{ gene_asset_id: 'sha256:gene1', position: 1, optional: false }],
        price_per_execution: 10,
      });

      const published = engine.publish(recipe.id, 'node-1');
      expect(published!.status).toBe(RecipeStatus.PUBLISHED);
    });

    it('rejects unauthorized publish', () => {
      const recipe = engine.create({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        genes: [{ gene_asset_id: 'sha256:gene1', position: 1, optional: false }],
        price_per_execution: 10,
      });

      const published = engine.publish(recipe.id, 'node-2');
      expect(published).toBeNull();
    });
  });

  describe('express', () => {
    it('expresses a published recipe into organism', () => {
      const recipe = engine.create({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        genes: [{ gene_asset_id: 'sha256:gene1', position: 1, optional: false }],
        price_per_execution: 10,
      });
      engine.publish(recipe.id, 'node-1');

      const organism = engine.express(recipe.id);
      expect(organism).not.toBeNull();
      expect(organism!.status).toBe(OrganismStatus.ALIVE);
      expect(organism!.genes_total_count).toBe(1);
      expect(organism!.genes_expressed).toBe(0);
    });

    it('cannot express unpublished recipe', () => {
      const recipe = engine.create({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        genes: [{ gene_asset_id: 'sha256:gene1', position: 1, optional: false }],
        price_per_execution: 10,
      });

      const organism = engine.express(recipe.id);
      expect(organism).toBeNull();
    });
  });

  describe('expressGene', () => {
    it('expresses genes and tracks progress', () => {
      const recipe = engine.create({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        genes: [
          { gene_asset_id: 'sha256:gene1', position: 1, optional: false },
          { gene_asset_id: 'sha256:gene2', position: 2, optional: false },
        ],
        price_per_execution: 10,
      });
      engine.publish(recipe.id, 'node-1');
      const organism = engine.express(recipe.id);

      const result1 = engine.expressGene(organism!.id, 'sha256:gene1', 1, 'success');
      expect(result1!.genes_expressed).toBe(1);
      expect(result1!.current_position).toBe(2);

      const result2 = engine.expressGene(organism!.id, 'sha256:gene2', 2, 'success');
      expect(result2!.status).toBe(OrganismStatus.COMPLETED);
    });

    it('fails organism on required gene failure', () => {
      const recipe = engine.create({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        genes: [
          { gene_asset_id: 'sha256:gene1', position: 1, optional: false },
          { gene_asset_id: 'sha256:gene2', position: 2, optional: false },
        ],
        price_per_execution: 10,
      });
      engine.publish(recipe.id, 'node-1');
      const organism = engine.express(recipe.id);

      const result = engine.expressGene(organism!.id, 'sha256:gene1', 1, 'failed');
      expect(result!.status).toBe(OrganismStatus.FAILED);
    });

    it('skips optional genes without failing', () => {
      const recipe = engine.create({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        genes: [
          { gene_asset_id: 'sha256:gene1', position: 1, optional: false },
          { gene_asset_id: 'sha256:gene2', position: 2, optional: true },
        ],
        price_per_execution: 10,
      });
      engine.publish(recipe.id, 'node-1');
      const organism = engine.express(recipe.id);

      const result = engine.expressGene(organism!.id, 'sha256:gene1', 1, 'success');
      expect(result!.genes_expressed).toBe(1);

      // Skip optional gene and complete
      const result2 = engine.complete(organism!.id);
      expect(result2!.status).toBe(OrganismStatus.COMPLETED);
    });
  });

  describe('fork', () => {
    it('forks a recipe', () => {
      const original = engine.create({
        sender_id: 'node-1',
        title: 'Original',
        description: 'Original desc',
        genes: [{ gene_asset_id: 'sha256:gene1', position: 1, optional: false }],
        price_per_execution: 10,
      });

      const forked = engine.fork(original.id, 'node-2', { title: 'Forked' });
      expect(forked).not.toBeNull();
      expect(forked!.title).toBe('Forked');
      expect(forked!.author_id).toBe('node-2');
      expect(forked!.id).not.toBe(original.id);
    });
  });

  describe('archive', () => {
    it('archives a recipe', () => {
      const recipe = engine.create({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        genes: [{ gene_asset_id: 'sha256:gene1', position: 1, optional: false }],
        price_per_execution: 10,
      });

      const archived = engine.archive(recipe.id, 'node-1');
      expect(archived!.status).toBe(RecipeStatus.ARCHIVED);
    });
  });

  describe('checkTimeouts', () => {
    it('expires organisms after TTL', () => {
      const recipe = engine.create({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        genes: [{ gene_asset_id: 'sha256:gene1', position: 1, optional: false }],
        price_per_execution: 10,
      });
      engine.publish(recipe.id, 'node-1');

      // Express with 1ms TTL
      const organism = engine.express(recipe.id, 0); // 0 seconds = immediate expiry

      // Check timeouts - the organism should expire
      const timedOut = engine.checkTimeouts();
      expect(timedOut).toContain(organism!.id);
    });
  });
});
