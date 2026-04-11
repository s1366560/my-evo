/* eslint-disable @typescript-eslint/no-explicit-any */
import * as service from './service';
import * as expressionEngine from './expression-engine';
import * as organismModule from './organism';
import * as versioningModule from './versioning';
import * as ttlModule from './ttl';
import * as schedulerModule from './scheduler';
import { NotFoundError, ForbiddenError, ValidationError } from '../shared/errors';

// ===== Mock Prisma =====

function mk(): any {
  return {
    recipe: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    organism: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    asset: {
      findUnique: jest.fn(),
    },
    evolutionEvent: {
      create: jest.fn(),
    },
    recipeVersion: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    gDIScoreRecord: {
      findFirst: jest.fn(),
    },
  };
}

const mockPrisma = mk();

beforeAll(() => {
  service.setPrisma(mockPrisma);
  expressionEngine.setPrisma(mockPrisma);
  organismModule.setPrisma(mockPrisma);
  versioningModule.setPrisma(mockPrisma);
  ttlModule.setPrisma(mockPrisma);
  schedulerModule.setPrisma(mockPrisma);
});

beforeEach(() => {
  jest.clearAllMocks();
  // Restore recipeVersion after tests that delete it
  mockPrisma.recipeVersion = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  };
});

// ===== Helpers =====

const mockRecipe = (overrides: Record<string, unknown> = {}) => ({
  recipe_id: 'recipe-1',
  title: 'Test Recipe',
  description: 'A test recipe',
  genes: [
    { gene_asset_id: 'gene-1', position: 1, optional: false },
    { gene_asset_id: 'gene-2', position: 2, optional: true, condition: 'if step 1 finds issues' },
    { gene_asset_id: 'gene-3', position: 3, optional: false },
  ],
  price_per_execution: 5,
  max_concurrent: 3,
  status: 'published',
  author_id: 'node-1',
  created_at: new Date(),
  updated_at: new Date(),
  organisms: [],
  ...overrides,
});

const mockOrganism = (overrides: Record<string, unknown> = {}) => ({
  organism_id: 'org-1',
  recipe_id: 'recipe-1',
  status: 'alive',
  genes_expressed: 1,
  genes_total_count: 3,
  current_position: 1,
  ttl_seconds: 3600,
  created_at: new Date(),
  updated_at: new Date(),
  recipe: mockRecipe(),
  ...overrides,
});

const mockGene = (id = 'gene-1') => ({
  asset_id: id,
  name: `Gene ${id}`,
  type: 'gene',
  owner_id: 'node-1',
});

// ============================================================
// EXPRESSION ENGINE TESTS
// ============================================================

describe('Expression Engine', () => {
  describe('resolveDependencies', () => {
    it('should resolve and sort genes by position', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe());

      const steps = await expressionEngine.resolveDependencies('recipe-1');

      expect(steps).toHaveLength(3);
      expect(steps[0]!.gene_asset_id).toBe('gene-1');
      expect(steps[0]!.position).toBe(1);
      expect(steps[1]!.position).toBe(2);
      expect(steps[2]!.position).toBe(3);
    });

    it('should throw NotFoundError for unknown recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(expressionEngine.resolveDependencies('unknown')).rejects.toThrow(NotFoundError);
    });

    it('should return empty array for recipe with no genes', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe({ genes: [] }));

      const steps = await expressionEngine.resolveDependencies('recipe-1');
      expect(steps).toHaveLength(0);
    });

    it('should preserve optional and condition fields', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe());

      const steps = await expressionEngine.resolveDependencies('recipe-1');

      const step2 = steps.find((s) => s.position === 2);
      expect(step2?.optional).toBe(true);
      expect(step2?.condition).toBe('if step 1 finds issues');
    });
  });

  describe('expressRecipe', () => {
    it('should throw NotFoundError for unknown recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(expressionEngine.expressRecipe('unknown')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for unpublished recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe({ status: 'draft' }));

      await expect(expressionEngine.expressRecipe('recipe-1')).rejects.toThrow('Recipe must be published');
    });

    it('should create organism and execute expression plan', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe());
      mockPrisma.organism.create.mockResolvedValue(mockOrganism());
      mockPrisma.organism.update.mockResolvedValue(mockOrganism({ status: 'completed' }));
      mockPrisma.asset.findUnique.mockResolvedValue(mockGene());

      const result = await expressionEngine.expressRecipe('recipe-1');

      expect(result.organism_id).toBeDefined();
      expect(result.recipe_id).toBe('recipe-1');
      expect(mockPrisma.organism.create).toHaveBeenCalled();
    });

    it('should throw ValidationError for recipe with no genes', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe({ genes: [] }));

      await expect(expressionEngine.expressRecipe('recipe-1')).rejects.toThrow('no genes to express');
    });
  });

  describe('validateExpressionResult', () => {
    it('should return valid for successful expression', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism());

      const result = await expressionEngine.validateExpressionResult({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        steps: [
          { gene_asset_id: 'gene-1', position: 1, optional: false, status: 'success', output: {} },
        ],
        success: true,
        errors: [],
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid with errors for failed required steps', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism());

      const result = await expressionEngine.validateExpressionResult({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        steps: [
          { gene_asset_id: 'gene-1', position: 1, optional: false, status: 'failed', error: 'Out of memory' },
        ],
        success: false,
        errors: ['Gene gene-1 at position 1: Out of memory'],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return invalid when organism not found', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(null);

      const result = await expressionEngine.validateExpressionResult({
        organism_id: 'unknown-org',
        recipe_id: 'recipe-1',
        steps: [],
        success: true,
        errors: [],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Organism unknown-org not found');
    });
  });
});

// ============================================================
// ORGANISM LIFECYCLE TESTS
// ============================================================

describe('Organism Lifecycle', () => {
  describe('spawnOrganism', () => {
    it('should spawn organism from published recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe());
      mockPrisma.organism.count.mockResolvedValue(0);
      mockPrisma.organism.create.mockResolvedValue(mockOrganism());

      const progress = await organismModule.spawnOrganism('recipe-1', 'node-1');

      expect(progress.organism_id).toBe('org-1');
      expect(progress.recipe_id).toBe('recipe-1');
      expect(progress.status).toBe('alive');
    });

    it('should throw NotFoundError for unknown recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(organismModule.spawnOrganism('unknown', 'node-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for unpublished recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe({ status: 'draft' }));

      await expect(organismModule.spawnOrganism('recipe-1', 'node-1')).rejects.toThrow('Recipe must be published');
    });

    it('should throw ValidationError when max concurrent reached', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe());
      mockPrisma.organism.count.mockResolvedValue(3); // max_concurrent = 3

      await expect(organismModule.spawnOrganism('recipe-1', 'node-1')).rejects.toThrow('Max concurrent organisms');
    });

    it('should clamp TTL to valid range', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe());
      mockPrisma.organism.count.mockResolvedValue(0);
      mockPrisma.organism.create.mockImplementation((data: any) =>
        Promise.resolve({ ...mockOrganism(), ttl_seconds: data.data.ttl_seconds }),
      );

      const progress = await organismModule.spawnOrganism('recipe-1', 'node-1', {}, 200000);

      // Should be clamped to MAX_TTL_SECONDS (86400)
      expect(progress.ttl_seconds).toBeLessThanOrEqual(86400);
    });
  });

  describe('evolveOrganism', () => {
    it('should evolve alive organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism({ status: 'alive' }));
      mockPrisma.asset.findUnique.mockResolvedValue(mockGene('gene-2'));
      mockPrisma.evolutionEvent.create.mockResolvedValue({});
      mockPrisma.organism.update.mockResolvedValue(
        mockOrganism({ status: 'alive', genes_expressed: 2 }),
      );

      const progress = await organismModule.evolveOrganism('org-1', {
        gene_asset_id: 'gene-2',
        description: 'Added new capability',
        adapted_by: 'node-1',
      });

      expect(progress.status).toBe('alive');
    });

    it('should throw NotFoundError for unknown organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(null);

      await expect(organismModule.evolveOrganism('unknown', { adapted_by: 'node-1' })).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for expired organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism({ status: 'expired' }));

      await expect(organismModule.evolveOrganism('org-1', { adapted_by: 'node-1' })).rejects.toThrow('Cannot evolve');
    });

    it('should throw NotFoundError for unknown gene in adaptation', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism({ status: 'alive' }));
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(
        organismModule.evolveOrganism('org-1', { gene_asset_id: 'unknown', adapted_by: 'node-1' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('cloneOrganism', () => {
    it('should clone organism from published recipe', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism({ status: 'completed' }));
      mockPrisma.organism.create.mockResolvedValue({
        ...mockOrganism(),
        organism_id: 'org-clone-1',
        status: 'assembling',
        genes_expressed: 0,
        current_position: 0,
      });

      const progress = await organismModule.cloneOrganism('org-1');

      expect(progress.status).toBe('assembling');
      expect(progress.genes_expressed).toBe(0);
    });

    it('should throw NotFoundError for unknown organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(null);

      await expect(organismModule.cloneOrganism('unknown')).rejects.toThrow(NotFoundError);
    });
  });

  describe('terminateOrganism', () => {
    it('should terminate alive organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism({ status: 'alive' }));
      mockPrisma.organism.update.mockResolvedValue(mockOrganism({ status: 'expired' }));
      mockPrisma.evolutionEvent.create.mockResolvedValue({});

      const progress = await organismModule.terminateOrganism('org-1', 'User requested termination');

      expect(progress.status).toBe('expired');
    });

    it('should throw NotFoundError for unknown organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(null);

      await expect(organismModule.terminateOrganism('unknown', 'Unknown')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for already expired organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism({ status: 'expired' }));

      await expect(organismModule.terminateOrganism('org-1', 'Already expired')).rejects.toThrow('already terminated');
    });
  });

  describe('getOrganismProgress', () => {
    it('should return progress with percentage', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(
        mockOrganism({ genes_expressed: 2, genes_total_count: 4 }),
      );

      const progress = await organismModule.getOrganismProgress('org-1');

      expect(progress.progress_percent).toBe(50);
    });

    it('should throw NotFoundError for unknown organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(null);

      await expect(organismModule.getOrganismProgress('unknown')).rejects.toThrow(NotFoundError);
    });
  });
});

// ============================================================
// VERSIONING TESTS
// ============================================================

describe('Recipe Versioning', () => {
  describe('createVersion', () => {
    it('should create a new version for existing recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe());
      mockPrisma.recipeVersion.findFirst.mockResolvedValue(null);
      mockPrisma.recipeVersion.create.mockResolvedValue({
        id: 'version-1',
        recipe_id: 'recipe-1',
        version: 1,
        title: 'Test Recipe',
        description: 'A test recipe',
        genes: [],
        price_per_execution: 5,
        max_concurrent: 3,
        changes: 'Initial version',
        created_at: new Date(),
      });

      const version = await versioningModule.createVersion({
        recipeId: 'recipe-1',
        changes: 'Initial version',
      });

      expect(version.version).toBe(1);
      expect(version.changes).toBe('Initial version');
    });

    it('should throw NotFoundError for unknown recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(
        versioningModule.createVersion({ recipeId: 'unknown', changes: 'test' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listVersions', () => {
    it('should throw NotFoundError for unknown recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(versioningModule.listVersions('unknown')).rejects.toThrow(NotFoundError);
    });

    it('should return empty array when recipeVersion model not available', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe());
      // recipeVersion is undefined when not available
      delete mockPrisma.recipeVersion;

      const versions = await versioningModule.listVersions('recipe-1');
      expect(versions).toEqual([]);
    });
  });

  describe('rollbackVersion', () => {
    it('should throw NotFoundError for unknown recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(versioningModule.rollbackVersion('unknown', 'version-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for published recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe({ status: 'published' }));
      mockPrisma.recipeVersion.findUnique.mockResolvedValue({
        id: 'version-1', recipe_id: 'recipe-1', version: 1,
        title: 'Test', description: 'desc', genes: [],
        price_per_execution: 5, max_concurrent: 3,
        changes: 'test', created_at: new Date(),
      });

      await expect(versioningModule.rollbackVersion('recipe-1', 'version-1')).rejects.toThrow(
        'Only draft recipes can be rolled back',
      );
    });
  });

  describe('getLatestVersionNumber', () => {
    it('should return 0 when no versions exist', async () => {
      mockPrisma.recipeVersion.findFirst.mockResolvedValue(null);

      const version = await versioningModule.getLatestVersionNumber('recipe-1');
      expect(version).toBe(0);
    });
  });
});

// ============================================================
// TTL TESTS
// ============================================================

describe('TTL Management', () => {
  describe('setTTL', () => {
    it('should set TTL for existing organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism());
      mockPrisma.organism.update.mockResolvedValue(mockOrganism({ ttl_seconds: 7200 }));

      const config = await ttlModule.setTTL('org-1', 7200);

      expect(config.ttl_seconds).toBe(7200);
      expect(config.organism_id).toBe('org-1');
    });

    it('should clamp TTL below minimum to 60', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism());
      mockPrisma.organism.update.mockImplementation((data: any) =>
        Promise.resolve(mockOrganism({ ttl_seconds: data.data.ttl_seconds })),
      );

      const config = await ttlModule.setTTL('org-1', 10);
      expect(config.ttl_seconds).toBe(60);
    });

    it('should clamp TTL above maximum to 86400', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism());
      mockPrisma.organism.update.mockImplementation((data: any) =>
        Promise.resolve(mockOrganism({ ttl_seconds: data.data.ttl_seconds })),
      );

      const config = await ttlModule.setTTL('org-1', 200000);
      expect(config.ttl_seconds).toBe(86400);
    });

    it('should throw NotFoundError for unknown organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(null);

      await expect(ttlModule.setTTL('unknown', 3600)).rejects.toThrow(NotFoundError);
    });
  });

  describe('checkAndCleanup', () => {
    it('should expire organisms that exceeded their TTL', async () => {
      const expiredDate = new Date(Date.now() - 4000 * 1000); // 4000 seconds ago
      const activeDate = new Date(); // now

      mockPrisma.organism.findMany.mockResolvedValue([
        { organism_id: 'org-expired', created_at: expiredDate, ttl_seconds: 3600, status: 'alive' },
        { organism_id: 'org-active', created_at: activeDate, ttl_seconds: 3600, status: 'alive' },
      ]);
      mockPrisma.organism.update.mockResolvedValue(mockOrganism({ status: 'expired' }));

      const result = await ttlModule.checkAndCleanup();

      expect(result.expired_count).toBe(1);
      expect(result.expired_ids).toContain('org-expired');
    });

    it('should return empty when no organisms are expired', async () => {
      mockPrisma.organism.findMany.mockResolvedValue([
        { organism_id: 'org-active', created_at: new Date(), ttl_seconds: 3600, status: 'alive' },
      ]);

      const result = await ttlModule.checkAndCleanup();

      expect(result.expired_count).toBe(0);
      expect(result.expired_ids).toHaveLength(0);
    });
  });

  describe('extendTTL', () => {
    it('should extend TTL for alive organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism({ status: 'alive', ttl_seconds: 3600 }));
      mockPrisma.organism.update.mockImplementation((data: any) =>
        Promise.resolve(mockOrganism({ ttl_seconds: data.data.ttl_seconds })),
      );

      const config = await ttlModule.extendTTL('org-1', 1800);

      expect(config.ttl_seconds).toBe(5400);
    });

    it('should throw ValidationError for completed organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism({ status: 'completed' }));

      await expect(ttlModule.extendTTL('org-1', 1800)).rejects.toThrow('Cannot extend TTL');
    });

    it('should throw NotFoundError for unknown organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(null);

      await expect(ttlModule.extendTTL('unknown', 1800)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getRemainingTTL', () => {
    it('should return remaining seconds for active organism', async () => {
      const recentDate = new Date(Date.now() - 600 * 1000); // 10 minutes ago
      mockPrisma.organism.findUnique.mockResolvedValue(
        mockOrganism({ created_at: recentDate, ttl_seconds: 3600 }),
      );

      const remaining = await ttlModule.getRemainingTTL('org-1');

      // Should be approximately 3000 (3600 - 600), allow some tolerance
      expect(remaining).toBeGreaterThan(2900);
      expect(remaining).toBeLessThanOrEqual(3000);
    });

    it('should return 0 for expired organism', async () => {
      const oldDate = new Date(Date.now() - 5000 * 1000);
      mockPrisma.organism.findUnique.mockResolvedValue(
        mockOrganism({ created_at: oldDate, ttl_seconds: 3600 }),
      );

      const remaining = await ttlModule.getRemainingTTL('org-1');
      expect(remaining).toBe(0);
    });
  });

  describe('getTTLStats', () => {
    it('should return correct TTL statistics', async () => {
      const recentDate = new Date(Date.now() - 3500 * 1000);
      const now = new Date();

      mockPrisma.organism.findMany.mockResolvedValue([
        { organism_id: 'org-1', created_at: recentDate, ttl_seconds: 3600, status: 'alive' },
        { organism_id: 'org-2', created_at: now, ttl_seconds: 3600, status: 'alive' },
      ]);
      mockPrisma.organism.count.mockResolvedValue(5);

      const stats = await ttlModule.getTTLStats();

      expect(stats.total_active).toBe(2);
      expect(stats.expiring_soon).toBe(1); // org-1 has < 5 min remaining
      expect(stats.expired_total).toBe(5);
    });
  });
});

// ============================================================
// SCHEDULER TESTS
// ============================================================

describe('Priority Scheduler', () => {
  describe('prioritizeExpression', () => {
    it('should return recipes sorted by priority', async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([
        mockRecipe({ recipe_id: 'recipe-high', organisms: Array(20).fill({}) }),
        mockRecipe({ recipe_id: 'recipe-low', organisms: [] }),
      ]);
      mockPrisma.gDIScoreRecord.findFirst.mockResolvedValue({ total: 80 });

      const scores = await schedulerModule.prioritizeExpression(10);

      expect(scores.length).toBeGreaterThan(0);
      expect(scores[0]!.gdi_score).toBe(80);
    });

    it('should default GDI score to 50 when no record exists', async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([mockRecipe()]);
      mockPrisma.gDIScoreRecord.findFirst.mockResolvedValue(null);

      const scores = await schedulerModule.prioritizeExpression(10);

      expect(scores[0]!.gdi_score).toBe(50);
    });
  });

  describe('scheduleExpression', () => {
    it('should schedule expression for published recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe());
      mockPrisma.organism.create.mockResolvedValue(mockOrganism());

      const scheduled = await schedulerModule.scheduleExpression('recipe-1', 80);

      expect(scheduled.recipe_id).toBe('recipe-1');
      expect(scheduled.priority).toBe(80);
      expect(scheduled.status).toBe('scheduled');
    });

    it('should throw NotFoundError for unknown recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(schedulerModule.scheduleExpression('unknown')).rejects.toThrow(NotFoundError);
    });

    it('should use default priority when not specified', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(mockRecipe());
      mockPrisma.organism.create.mockResolvedValue(mockOrganism());

      const scheduled = await schedulerModule.scheduleExpression('recipe-1');

      expect(scheduled.priority).toBe(50);
    });
  });

  describe('getExecutionFrequency', () => {
    it('should return correct execution counts', async () => {
      mockPrisma.organism.count.mockResolvedValueOnce(10).mockResolvedValueOnce(25);

      const freq = await schedulerModule.getExecutionFrequency('recipe-1');

      expect(freq.recipe_id).toBe('recipe-1');
      expect(freq.count_7d).toBe(10);
      expect(freq.count_30d).toBe(25);
    });
  });

  describe('getNextScheduled', () => {
    it('should return scheduled organisms sorted by creation time', async () => {
      mockPrisma.organism.findMany.mockResolvedValue([
        mockOrganism({ organism_id: 'org-1' }),
        mockOrganism({ organism_id: 'org-2' }),
      ]);

      const scheduled = await schedulerModule.getNextScheduled(5);

      expect(scheduled.length).toBe(2);
      expect(scheduled[0]!.status).toBe('scheduled');
    });
  });

  describe('cancelScheduled', () => {
    it('should cancel scheduled organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(mockOrganism({ status: 'assembling' }));
      mockPrisma.organism.update.mockResolvedValue(mockOrganism({ status: 'expired' }));

      const result = await schedulerModule.cancelScheduled('org-1');

      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundError for unknown organism', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(null);

      await expect(schedulerModule.cancelScheduled('unknown')).rejects.toThrow(NotFoundError);
    });
  });
});

// ============================================================
// SERVICE ENTRY POINT TESTS
// ============================================================

describe('Recipe Service Entry', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listRecipes', () => {
    it('should return paginated recipes', async () => {
      const items = [{ recipe_id: 'r-1', title: 'Test' }];
      mockPrisma.recipe.findMany.mockResolvedValue(items);
      mockPrisma.recipe.count.mockResolvedValue(1);

      const result = await service.listRecipes();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.recipe.count.mockResolvedValue(0);

      await service.listRecipes('published');

      expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'published' } }),
      );
    });

    it('should filter by author', async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.recipe.count.mockResolvedValue(0);

      await service.listRecipes(undefined, 'node-1');

      expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { author_id: 'node-1' } }),
      );
    });
  });

  describe('getRecipe', () => {
    it('should return a recipe with organisms', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', title: 'Test', organisms: [] });

      const result = await service.getRecipe('r-1');

      expect(result.recipe_id).toBe('r-1');
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(service.getRecipe('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createRecipe', () => {
    it('should create a recipe with draft status', async () => {
      const created = { recipe_id: 'r-1', title: 'New', description: 'Desc', status: 'draft', author_id: 'node-1' };
      mockPrisma.recipe.create.mockResolvedValue(created);

      const result = await service.createRecipe('node-1', 'New', 'Desc');

      expect(result.status).toBe('draft');
      expect(result.recipe_id).toBeDefined();
    });
  });

  describe('updateRecipe', () => {
    it('should update recipe fields', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'draft' });
      mockPrisma.recipe.update.mockResolvedValue({ recipe_id: 'r-1', title: 'Updated' });

      const result = await service.updateRecipe('r-1', 'node-1', { title: 'Updated' });

      expect(result.title).toBe('Updated');
    });

    it('should reject update by non-author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'draft' });

      await expect(service.updateRecipe('r-1', 'node-2', { title: 'x' })).rejects.toThrow(ForbiddenError);
    });

    it('should reject update of non-draft recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'published' });

      await expect(service.updateRecipe('r-1', 'node-1', { title: 'x' })).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when recipe not found', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(service.updateRecipe('nonexistent', 'node-1', { title: 'x' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('publishRecipe', () => {
    it('should publish a draft recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'draft' });
      mockPrisma.recipe.update.mockResolvedValue({ recipe_id: 'r-1', status: 'published' });

      const result = await service.publishRecipe('r-1', 'node-1');

      expect(result.status).toBe('published');
    });

    it('should reject non-author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'draft' });

      await expect(service.publishRecipe('r-1', 'node-2')).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when recipe not found', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(service.publishRecipe('nonexistent', 'node-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when recipe is not draft', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'published' });

      await expect(service.publishRecipe('r-1', 'node-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('archiveRecipe', () => {
    it('should archive a published recipe for its author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'published' });
      mockPrisma.recipe.update.mockResolvedValue({ recipe_id: 'r-1', status: 'archived' });

      const result = await service.archiveRecipe('r-1', 'node-1');
      expect(result.status).toBe('archived');
    });

    it('should reject non-authors', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'published' });

      await expect(service.archiveRecipe('r-1', 'node-2')).rejects.toThrow(ForbiddenError);
    });

    it('should reject archiving already archived recipes', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'archived' });

      await expect(service.archiveRecipe('r-1', 'node-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('forkRecipe', () => {
    it('should fork a published recipe into a new draft', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({
        recipe_id: 'r-1',
        title: 'Original Recipe',
        description: 'Desc',
        genes: [],
        price_per_execution: 5,
        max_concurrent: 2,
        input_schema: null,
        output_schema: null,
        status: 'published',
        author_id: 'node-1',
      });
      mockPrisma.recipe.create.mockResolvedValue({
        recipe_id: 'r-2',
        title: 'Original Recipe (fork)',
        status: 'draft',
        author_id: 'node-2',
      });

      const result = await service.forkRecipe('r-1', 'node-2');

      expect(result.recipe_id).toBe('r-2');
      expect(result.status).toBe('draft');
      expect(result.author_id).toBe('node-2');
      expect(mockPrisma.recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Original Recipe (fork)',
            status: 'draft',
            author_id: 'node-2',
          }),
        }),
      );
    });

    it('should allow authors to fork their own drafts', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({
        recipe_id: 'r-1',
        title: 'Draft Recipe',
        description: 'Desc',
        genes: [],
        price_per_execution: 5,
        max_concurrent: 2,
        input_schema: null,
        output_schema: null,
        status: 'draft',
        author_id: 'node-1',
      });
      mockPrisma.recipe.create.mockResolvedValue({
        recipe_id: 'r-2',
        title: 'Draft Recipe (fork)',
        status: 'draft',
        author_id: 'node-1',
      });

      const result = await service.forkRecipe('r-1', 'node-1');
      expect(result.recipe_id).toBe('r-2');
    });

    it('should reject forking another user\'s unpublished recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({
        recipe_id: 'r-1',
        title: 'Draft Recipe',
        description: 'Desc',
        genes: [],
        price_per_execution: 5,
        max_concurrent: 2,
        input_schema: null,
        output_schema: null,
        status: 'draft',
        author_id: 'node-1',
      });

      await expect(service.forkRecipe('r-1', 'node-2')).rejects.toThrow(ForbiddenError);
      expect(mockPrisma.recipe.create).not.toHaveBeenCalled();
    });

    it('should reject forking archived recipes even for the author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({
        recipe_id: 'r-1',
        title: 'Archived Recipe',
        description: 'Desc',
        genes: [],
        price_per_execution: 5,
        max_concurrent: 2,
        input_schema: null,
        output_schema: null,
        status: 'archived',
        author_id: 'node-1',
      });

      await expect(service.forkRecipe('r-1', 'node-1')).rejects.toThrow(ForbiddenError);
      expect(mockPrisma.recipe.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteRecipe', () => {
    it('should delete recipe by author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'draft' });
      mockPrisma.organism.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.recipe.delete.mockResolvedValue({});

      await expect(service.deleteRecipe('r-1', 'node-1')).resolves.not.toThrow();
    });

    it('should reject delete by non-author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1' });

      await expect(service.deleteRecipe('r-1', 'node-2')).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when recipe not found', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(service.deleteRecipe('nonexistent', 'node-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when recipe is not draft', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', author_id: 'node-1', status: 'published' });

      await expect(service.deleteRecipe('r-1', 'node-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('listOrganisms', () => {
    it('should return organisms for a recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1' });
      mockPrisma.organism.findMany.mockResolvedValue([{ organism_id: 'org-1' }]);

      const result = await service.listOrganisms('r-1');

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundError when recipe not found', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(service.listOrganisms('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createOrganism', () => {
    it('should create an organism for published recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', status: 'published', author_id: 'node-1' });
      mockPrisma.organism.create.mockResolvedValue({ organism_id: 'org-1' });

      const result = await service.createOrganism('r-1', 'node-1', ['gene-1'], 3600);

      expect(result.organism_id).toBeDefined();
    });

    it('should reject for non-published recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', status: 'draft', author_id: 'node-1' });

      await expect(service.createOrganism('r-1', 'node-1', [], 3600)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when recipe not found', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(service.createOrganism('nonexistent', 'node-1', [], 3600)).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when node is not author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'r-1', status: 'published', author_id: 'node-1' });

      await expect(service.createOrganism('r-1', 'node-2', [], 3600)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getOrganism', () => {
    it('should return organism by id', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue({ organism_id: 'org-1' });

      const result = await service.getOrganism('org-1');

      expect(result?.organism_id).toBe('org-1');
    });

    it('should throw NotFoundError when organism not found', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(null);

      await expect(service.getOrganism('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('executeOrganism', () => {
    it('should execute alive organism and complete when all genes expressed', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'alive',
        genes_expressed: 2,
        genes_total_count: 3,
        current_position: 2,
      });
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'recipe-1', status: 'published' });
      mockPrisma.organism.update.mockResolvedValue({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'completed',
        genes_expressed: 3,
        genes_total_count: 3,
        current_position: 3,
      });

      const result = await service.executeOrganism('org-1', { input: 'test' });

      expect(result.result.status).toBe('completed');
      expect(result.genes_expressed).toBe(3);
    });

    it('should execute alive organism and remain running when not complete', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'alive',
        genes_expressed: 1,
        genes_total_count: 3,
        current_position: 1,
      });
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'recipe-1', status: 'published' });
      mockPrisma.organism.update.mockResolvedValue({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'running',
        genes_expressed: 2,
        genes_total_count: 3,
        current_position: 2,
      });

      const result = await service.executeOrganism('org-1');

      expect(result.result.status).toBe('running');
      expect(result.genes_expressed).toBe(2);
    });

    it('should throw NotFoundError when organism not found', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue(null);

      await expect(service.executeOrganism('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when organism is completed', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'completed',
        genes_expressed: 3,
        genes_total_count: 3,
        current_position: 3,
      });

      await expect(service.executeOrganism('org-1')).rejects.toThrow('already been executed');
    });

    it('should throw ValidationError when organism has failed', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'failed',
        genes_expressed: 1,
        genes_total_count: 3,
        current_position: 1,
      });

      await expect(service.executeOrganism('org-1')).rejects.toThrow('has failed');
    });

    it('should throw NotFoundError when recipe not found', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'alive',
        genes_expressed: 0,
        genes_total_count: 3,
        current_position: 0,
      });
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(service.executeOrganism('org-1')).rejects.toThrow(NotFoundError);
    });

    it('should return null inputs when no inputs provided', async () => {
      mockPrisma.organism.findUnique.mockResolvedValue({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'alive',
        genes_expressed: 2,
        genes_total_count: 3,
        current_position: 2,
      });
      mockPrisma.recipe.findUnique.mockResolvedValue({ recipe_id: 'recipe-1', status: 'published' });
      mockPrisma.organism.update.mockResolvedValue({
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'completed',
        genes_expressed: 3,
        genes_total_count: 3,
        current_position: 3,
      });

      const result = await service.executeOrganism('org-1');

      expect(result.result.inputs).toBeNull();
    });
  });
});
