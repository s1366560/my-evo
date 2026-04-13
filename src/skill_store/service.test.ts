import { PrismaClient } from '@prisma/client';
import * as service from './service';
import * as distillation from './distillation';
import * as quality from './quality';
import * as ranking from './ranking';
import * as recommendation from './recommendation';
import { ValidationError } from '../shared/errors';

// ------------------------------------------------------------------
// Mock Prisma
// ------------------------------------------------------------------

const mockSkill = (overrides = {}) => ({
  id: 'skill_internal_id',
  skill_id: 'skill_test_001',
  name: 'Test Skill',
  description: 'A test skill for unit testing purposes',
  category: 'testing',
  author_id: 'node_001',
  status: 'published',
  price_credits: 5,
  download_count: 50,
  rating: 4.2,
  rating_count: 10,
  source_capsules: ['cap_001', 'cap_002'],
  code_template: 'function test() { return true; }',
  parameters: { timeout: 3000, retries: 3 },
  steps: ['Step 1', 'Step 2', 'Step 3'],
  examples: ['example: test()', 'example: test(42)'],
  tags: ['testing', 'unit'],
  version: '1.0.0',
  versions: [],
  l1_passed: true,
  l2_passed: true,
  l3_passed: true,
  l4_passed: true,
  reviewed_at: null,
  reviewer: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-15'),
  deleted_at: null,
  ...overrides,
});

const mockCapsule = (overrides = {}) => ({
  asset_id: 'cap_001',
  asset_type: 'capsule',
  name: 'Test Capsule',
  description: 'A test capsule',
  content: 'function capsuleLogic() { return process(); }',
  signals: ['signal_1', 'signal_2'],
  tags: ['testing', 'automation'],
  author_id: 'node_001',
  status: 'published',
  gdi_score: 75,
  success_signal: true,
  ...overrides,
});

const mockPrisma = {
  skill: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  skillRating: {
    upsert: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

describe('SkillStore Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) =>
      callback(mockPrisma));
  });

  // ==================================================================
  // Distillation Module
  // ==================================================================

  describe('Distillation Module', () => {
    describe('checkCooldown', () => {
      it('should return 0 when no previous distillation', () => {
        expect(distillation.checkCooldown(undefined)).toBe(0);
        expect(distillation.checkCooldown(null as any)).toBe(0);
      });

      it('should return 0 when cooldown has fully elapsed (24h+)', () => {
        const now = Date.now();
        const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;
        expect(distillation.checkCooldown(twentyFiveHoursAgo)).toBe(0);
      });

      it('should return remaining cooldown time when still in cooldown', () => {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const remaining = distillation.checkCooldown(oneHourAgo);
        // Should be roughly 23 hours remaining (within 1 second tolerance)
        expect(remaining).toBeGreaterThan(23 * 60 * 60 * 1000 - 1000);
        expect(remaining).toBeLessThan(23 * 60 * 60 * 1000 + 1000);
      });
    });

    describe('canDistill', () => {
      it('should return canDistill=false when fewer than 10 capsules', () => {
        const capsules = Array.from({ length: 5 }, (_, i) =>
          mockCapsule({ asset_id: `cap_${i}`, success_signal: true }),
        );
        const result = distillation.canDistill({
          nodeId: 'node_001',
          capsules,
        });
        expect(result.canDistill).toBe(false);
        expect(result.totalCapsules).toBe(5);
      });

      it('should return canDistill=false when success rate below 70%', () => {
        const capsules = Array.from({ length: 10 }, (_, i) =>
          mockCapsule({ asset_id: `cap_${i}`, success_signal: i < 5 }),
        );
        const result = distillation.canDistill({
          nodeId: 'node_001',
          capsules,
        });
        expect(result.canDistill).toBe(false);
        expect(result.successfulCount).toBe(5);
      });

      it('should return canDistill=false when cooldown not elapsed', () => {
        const capsules = Array.from({ length: 10 }, () =>
          mockCapsule({ success_signal: true }),
        );
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const result = distillation.canDistill({
          nodeId: 'node_001',
          capsules,
          cooldownAfter: oneHourAgo,
        });
        expect(result.canDistill).toBe(false);
        expect(result.cooldownRemainingMs).toBeGreaterThan(0);
      });

      it('should return canDistill=true when all conditions met', () => {
        const capsules = Array.from({ length: 10 }, (_, i) =>
          mockCapsule({
            asset_id: `cap_${i}`,
            success_signal: i < 7,
            tags: ['testing', 'automation'],
          }),
        );
        const result = distillation.canDistill({
          nodeId: 'node_001',
          capsules,
        });
        expect(result.canDistill).toBe(true);
        expect(result.successfulCount).toBe(7);
        expect(result.similarCount).toBeGreaterThanOrEqual(3);
      });
    });

    describe('identifySkillPattern', () => {
      it('should extract dominant tags from successful capsules', () => {
        const capsules = [
          mockCapsule({ asset_id: 'cap_1', tags: ['python', 'api'], success_signal: true }),
          mockCapsule({ asset_id: 'cap_2', tags: ['python', 'api'], success_signal: true }),
          mockCapsule({ asset_id: 'cap_3', tags: ['python', 'api'], success_signal: true }),
        ];
        const pattern = distillation.identifySkillPattern(capsules);
        expect(pattern.tags).toContain('python');
        expect(pattern.tags).toContain('api');
        expect(pattern.sourceCapsuleIds).toEqual(['cap_1', 'cap_2', 'cap_3']);
      });

      it('should throw ValidationError for empty capsules', () => {
        expect(() => distillation.identifySkillPattern([])).toThrow(ValidationError);
      });

      it('should throw ValidationError when no successful capsules', () => {
        const capsules = [
          mockCapsule({ success_signal: false }),
          mockCapsule({ success_signal: false }),
        ];
        expect(() => distillation.identifySkillPattern(capsules)).toThrow(ValidationError);
      });

      it('should calculate average GDI score', () => {
        const capsules = [
          mockCapsule({ asset_id: 'cap_1', gdi_score: 80, success_signal: true }),
          mockCapsule({ asset_id: 'cap_2', gdi_score: 60, success_signal: true }),
        ];
        const pattern = distillation.identifySkillPattern(capsules);
        expect(pattern.avgGdiScore).toBe(70);
      });
    });

    describe('distillToCode', () => {
      it('should preserve name, description, and code template', () => {
        const pattern: distillation.SkillPattern = {
          name: 'Test Pattern',
          description: 'A test pattern description',
          tags: ['test'],
          taskType: 'testing',
          codeTemplate: 'function test() {}',
          parameters: { a: 1 },
          steps: ['Step 1'],
          examples: ['example'],
          avgGdiScore: 70,
          sourceCapsuleIds: ['cap_1'],
        };
        const result = distillation.distillToCode(pattern);
        expect(result.name).toBe('Test Pattern');
        expect(result.description).toBe('A test pattern description');
        expect(result.codeTemplate).toContain('Test Pattern');
        expect(result.parameters).toEqual({ a: 1 });
      });
    });

    describe('validateDistilledSkill', () => {
      it('should return valid=true for well-formed skill', () => {
        const skill = {
          name: 'Valid Skill Name',
          description: 'A very descriptive skill that explains what it does',
          code_template: 'function doSomething() { return true; }',
          steps: ['Step 1', 'Step 2'],
          examples: ['example: doSomething()'],
        };
        const result = distillation.validateDistilledSkill(skill);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should return errors for missing or short name', () => {
        const result = distillation.validateDistilledSkill({ name: 'ab' });
        expect(result.errors.some((e) => e.includes('Name'))).toBe(true);
      });

      it('should return errors for missing description', () => {
        const result = distillation.validateDistilledSkill({
          name: 'Valid Name',
          description: 'short',
        });
        expect(result.errors.some((e) => e.includes('Description'))).toBe(true);
      });

      it('should return error when steps exceed MAX_ASSOCIATED_FILES', () => {
        const result = distillation.validateDistilledSkill({
          name: 'Valid Skill',
          description: 'A valid description that is long enough',
          steps: Array.from({ length: 15 }, (_, i) => `Step ${i}`),
        });
        expect(result.errors.some((e) => e.includes('Too many steps'))).toBe(true);
      });

      it('should return warning when no examples provided', () => {
        const result = distillation.validateDistilledSkill({
          name: 'Valid Skill',
          description: 'A very descriptive skill',
          steps: ['Step 1'],
        });
        expect(result.warnings.some((w) => w.includes('example'))).toBe(true);
      });

      it('should detect high special character ratio', () => {
        const result = distillation.validateDistilledSkill({
          name: 'Valid Skill',
          description: 'A very descriptive skill that is long enough here',
          code_template: '###@@@###@@@###@@@###@@@###@@@###@@@###@@@###@@@###@@@',
          steps: ['Step 1'],
        });
        expect(result.errors.some((e) => e.includes('Special character ratio'))).toBe(true);
      });
    });

    describe('extractSkill integration', () => {
      it('should create a skill when conditions are met', async () => {
        const capsules = Array.from({ length: 10 }, (_, i) =>
          mockCapsule({
            asset_id: `cap_${i}`,
            success_signal: i < 7,
            tags: ['python', 'api'],
          }),
        );

        const createdSkill = {
          ...mockSkill(),
          skill_id: 'skill_distilled_001',
        };
        mockPrisma.skill.create.mockResolvedValue(createdSkill);

        const result = await distillation.extractSkill({
          nodeId: 'node_001',
          capsules,
        });

        expect(result.skillId).toBe('skill_distilled_001');
        expect(result.confidence).toBe(0.7);
        expect(result.pattern.sourceCapsuleIds).toHaveLength(7);
        expect(mockPrisma.skill.create).toHaveBeenCalled();
      });

      it('should throw ValidationError when conditions not met', async () => {
        const capsules = Array.from({ length: 5 }, () =>
          mockCapsule({ success_signal: true }),
        );
        await expect(
          distillation.extractSkill({ nodeId: 'node_001', capsules }),
        ).rejects.toThrow(ValidationError);
      });
    });
  });

  // ==================================================================
  // Quality Module
  // ==================================================================

  describe('Quality Module', () => {
    describe('scoreClarity', () => {
      it('should return higher score for longer, descriptive names', () => {
        const low = quality.scoreClarity({ name: 'Ab' });
        const high = quality.scoreClarity({ name: 'Effective API Error Handler' });
        expect(high).toBeGreaterThan(low);
      });

      it('should reward longer descriptions', () => {
        const short = quality.scoreClarity({ name: 'Valid Name', description: 'Short' });
        const long = quality.scoreClarity({
          name: 'Valid Name',
          description: 'A very comprehensive description that explains everything about this skill',
        });
        expect(long).toBeGreaterThan(short);
      });

      it('should return 0 for completely empty skill', () => {
        const score = quality.scoreClarity({});
        expect(score).toBe(0);
      });
    });

    describe('scoreCompleteness', () => {
      it('should return higher scores for complete skills', () => {
        const empty = quality.scoreCompleteness({});
        const complete = quality.scoreCompleteness({
          name: 'Test',
          description: 'Test description here',
          code_template: 'function test() { return true; }',
          parameters: { a: 1, b: 2, c: 3 },
          steps: ['Step 1', 'Step 2'],
          examples: ['example'],
          tags: ['test', 'unit'],
        });
        expect(complete).toBeGreaterThan(empty);
      });

      it('should partial credit for partial fields', () => {
        const partial = quality.scoreCompleteness({
          name: 'Test',
          description: 'A test description that is valid',
        });
        expect(partial).toBeGreaterThan(0);
        expect(partial).toBeLessThan(100);
      });
    });

    describe('scoreReusability', () => {
      it('should score higher with more tags and parameters', () => {
        const low = quality.scoreReusability({});
        const high = quality.scoreReusability({
          tags: ['python', 'api', 'error-handling'],
          parameters: { timeout: 3000, retries: 3, verbose: true, mode: 'strict' },
          steps: ['Step 1', 'Step 2', 'Step 3'],
          examples: ['example 1', 'example 2'],
        });
        expect(high).toBeGreaterThan(low);
      });

      it('should penalize too many steps (>12)', () => {
        const tooMany = quality.scoreReusability({
          tags: ['test'],
          parameters: { a: 1 },
          steps: Array.from({ length: 20 }, (_, i) => `Step ${i}`),
          examples: ['ex'],
        });
        expect(tooMany).toBeLessThan(100);
      });
    });

    describe('calculateOverallScore', () => {
      it('should apply correct weights (clarity 35%, completeness 40%, reusability 25%)', () => {
        const scores = { clarity: 100, completeness: 80, reusability: 60 };
        const overall = quality.calculateOverallScore(scores);
        const expected = 100 * 0.35 + 80 * 0.40 + 60 * 0.25;
        expect(overall).toBeCloseTo(expected, 1);
      });
    });

    describe('computeGrade', () => {
      it('should return correct grades for score ranges', () => {
        expect(quality.computeGrade(96)).toBe('A+');
        expect(quality.computeGrade(85)).toBe('A');
        expect(quality.computeGrade(70)).toBe('B');
        expect(quality.computeGrade(55)).toBe('C');
        expect(quality.computeGrade(40)).toBe('D');
        expect(quality.computeGrade(30)).toBe('F');
      });
    });

    describe('assessQuality', () => {
      it('should return full assessment with grade and suggestions', () => {
        const skill = {
          name: 'Test Skill',
          description: 'A comprehensive test skill that does everything well',
          code_template: 'function test() { return true; }',
          parameters: { a: 1, b: 2, c: 3 },
          steps: ['Step 1', 'Step 2'],
          examples: ['example'],
          tags: ['test', 'unit'],
        };
        const assessment = quality.assessQuality(skill);
        expect(assessment.grade).toMatch(/^[A-F]$/);
        expect(assessment.scores.clarity).toBeGreaterThan(0);
        expect(assessment.scores.completeness).toBeGreaterThan(0);
        expect(assessment.scores.reusability).toBeGreaterThan(0);
        expect(assessment.breakdown).toBeDefined();
        expect(Array.isArray(assessment.suggestions)).toBe(true);
      });

      it('should include skillId in assessment', () => {
        const assessment = quality.assessQuality({ skill_id: 'skill_abc' });
        expect(assessment.skillId).toBe('skill_abc');
      });
    });

    describe('gradeDescription', () => {
      it('should return a description for each grade', () => {
        const grades: quality.QualityGrade[] = ['A+', 'A', 'B', 'C', 'D', 'F'];
        for (const grade of grades) {
          const desc = quality.gradeDescription(grade);
          expect(typeof desc).toBe('string');
          expect(desc.length).toBeGreaterThan(0);
        }
      });
    });
  });

  // ==================================================================
  // Ranking Module
  // ==================================================================

  describe('Ranking Module', () => {
    beforeEach(() => {
      ranking.setPrisma(mockPrisma as unknown as PrismaClient);
    });

    describe('getSkillScoreComponents', () => {
      it('should compute all score components from skill', async () => {
        const skill = mockSkill({ updated_at: new Date(), rating: 4.0 });
        const components = await ranking.getSkillScoreComponents(skill);
        expect(components).toHaveProperty('qualityScore');
        expect(components).toHaveProperty('popularityScore');
        expect(components).toHaveProperty('recencyScore');
        expect(components).toHaveProperty('ratingScore');
        expect(components.ratingScore).toBe(80); // 4/5 * 100
      });

      it('should give high recency score to recently updated skills', async () => {
        const recentSkill = mockSkill({ updated_at: new Date() });
        const oldSkill = mockSkill({ updated_at: new Date('2020-01-01') });
        const [recent, old] = await Promise.all([
          ranking.getSkillScoreComponents(recentSkill),
          ranking.getSkillScoreComponents(oldSkill),
        ]);
        expect(recent.recencyScore).toBeGreaterThan(old.recencyScore);
      });
    });

    describe('calculateSkillScore', () => {
      it('should return composite score', async () => {
        mockPrisma.skill.findUnique.mockResolvedValue(mockSkill());
        const score = await ranking.calculateSkillScore('skill_test_001');
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(100);
      });

      it('should throw for non-existent skill', async () => {
        mockPrisma.skill.findUnique.mockResolvedValue(null);
        await expect(ranking.calculateSkillScore('unknown')).rejects.toThrow();
      });
    });

    describe('compareSkills', () => {
      it('should compare two skills and determine a winner', async () => {
        mockPrisma.skill.findUnique
          .mockResolvedValueOnce(mockSkill({ skill_id: 'skill_a', rating: 5.0, download_count: 100 }))
          .mockResolvedValueOnce(mockSkill({ skill_id: 'skill_b', rating: 3.0, download_count: 10 }));

        const comparison = await ranking.compareSkills('skill_a', 'skill_b');
        expect(comparison.skillA).toBe('skill_a');
        expect(comparison.skillB).toBe('skill_b');
        expect(['A', 'B', 'tie']).toContain(comparison.winner);
        expect(typeof comparison.reasoning).toBe('string');
      });

      it('should throw for non-existent skill', async () => {
        mockPrisma.skill.findUnique
          .mockResolvedValueOnce(mockSkill({ skill_id: 'skill_a' }))
          .mockResolvedValueOnce(null);
        await expect(ranking.compareSkills('skill_a', 'unknown')).rejects.toThrow();
      });
    });
  });

  // ==================================================================
  // Recommendation Module
  // ==================================================================

  describe('Recommendation Module', () => {
    beforeEach(() => {
      recommendation.setPrisma(mockPrisma as unknown as PrismaClient);
    });

    describe('suggestImprovements', () => {
      it('should return suggestion when quality needs improvement', () => {
        const suggestions = recommendation.suggestImprovements({
          name: 'Ab',
          description: 'x',
          code_template: 'code',
        });
        // Low name/desc => high priority clarity suggestion
        const highPriority = suggestions.find((s) => s.priority === 'high');
        expect(highPriority).toBeDefined();
      });

      it('should return low-priority suggestion for high-quality skill', () => {
        const suggestions = recommendation.suggestImprovements({
          name: 'Comprehensive API Error Handler with Retry Logic',
          description: 'A very thorough description that covers all the details needed for this skill to be understood and used correctly by other agents',
          code_template: 'function complete(param) { console.log(param); return true; }',
          parameters: { a: 1, b: 2, c: 3 },
          steps: ['Step 1', 'Step 2', 'Step 3'],
          examples: ['example 1', 'example 2'],
          tags: ['test', 'unit', 'integration'],
        });
        // All scores >70 => one low-priority suggestion
        expect(suggestions).toHaveLength(1);
        expect(suggestions[0]?.priority).toBe('low');
      });
    });

    describe('findComplementarySkills', () => {
      it('should return skills with overlapping tags', async () => {
        const baseSkill = mockSkill({
          skill_id: 'skill_base',
          category: 'python',
          tags: ['python', 'api'],
        });
        mockPrisma.skill.findUnique.mockResolvedValue(baseSkill);
        mockPrisma.skill.findMany.mockResolvedValue([
          mockSkill({
            skill_id: 'skill_compl_1',
            category: 'web',
            tags: ['python', 'web'],
          }),
        ]);

        const results = await recommendation.findComplementarySkills('skill_base');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.strength ?? 0).toBeGreaterThan(0);
      });

      it('should throw for non-existent skill', async () => {
        mockPrisma.skill.findUnique.mockResolvedValue(null);
        await expect(recommendation.findComplementarySkills('unknown')).rejects.toThrow();
      });
    });
  });

  // ==================================================================
  // Integrated Service Functions
  // ==================================================================

  describe('Integrated Service', () => {
    describe('distillFromCapsules', () => {
      it('should delegate to distillation.extractSkill', async () => {
        const capsules = Array.from({ length: 10 }, (_, i) =>
          mockCapsule({ asset_id: `cap_${i}`, success_signal: i < 7, tags: ['test'] }),
        );
        mockPrisma.skill.create.mockResolvedValue(mockSkill());

        const result = await service.distillFromCapsules('node_001', capsules);
        expect(result.skillId).toBeDefined();
        expect(mockPrisma.skill.create).toHaveBeenCalled();
      });
    });

    describe('checkDistillationEligibility', () => {
      it('should return extraction metrics', () => {
        const capsules = Array.from({ length: 10 }, () =>
          mockCapsule({ success_signal: true, tags: ['test'] }),
        );
        const metrics = service.checkDistillationEligibility(capsules);
        expect(metrics.canDistill).toBe(true);
        expect(metrics.successfulCount).toBe(10);
      });
    });

    describe('validateSkillContent', () => {
      it('should return validation result', () => {
        const result = service.validateSkillContent({
          name: 'Valid Skill Name',
          description: 'A very descriptive skill for testing purposes',
          code_template: 'function testSkill(param) {\n  console.log(param);\n  return true;\n}',
          steps: ['Step 1', 'Step 2'],
        });
        expect(result.valid).toBe(true);
      });
    });

    describe('rankSkillsByCategory', () => {
      it('should rank skills by composite score', async () => {
        mockPrisma.skill.findMany.mockResolvedValue([mockSkill()]);
        mockPrisma.skill.count.mockResolvedValue(1);
        mockPrisma.skill.findUnique.mockResolvedValue(mockSkill());

        const result = await service.rankSkillsByCategory('testing', 10);
        expect(result.items.length).toBe(1);
        expect(result.total).toBe(1);
        expect(result.items[0]).toHaveProperty('compositeScore');
      });
    });

    describe('calculateCompositeSkillScore', () => {
      it('should return composite score', async () => {
        mockPrisma.skill.findUnique.mockResolvedValue(mockSkill());
        const score = await service.calculateCompositeSkillScore('skill_test_001');
        expect(typeof score).toBe('number');
      });
    });

    describe('assessSkillQuality', () => {
      it('should assess and return quality metrics', () => {
        const assessment = service.assessSkillQuality({
          name: 'Test Skill',
          description: 'A comprehensive test skill description here',
          code_template: 'function test() { return true; }',
          parameters: { a: 1 },
          steps: ['Step 1'],
          examples: ['example'],
          tags: ['test'],
        });
        expect(assessment.grade).toMatch(/^[A-F]$/);
        expect(assessment.scores.clarity).toBeGreaterThan(0);
      });
    });

    describe('gradeFromScore', () => {
      it('should return grade from score', () => {
        expect(service.gradeFromScore(95)).toBe('A+');
        expect(service.gradeFromScore(85)).toBe('A');
        expect(service.gradeFromScore(70)).toBe('B');
      });
    });

    describe('getSkillImprovements', () => {
      it('should return improvement suggestions', () => {
        const suggestions = service.getSkillImprovements({
          name: 'Test',
          description: 'Short',
          code_template: 'x',
        });
        expect(Array.isArray(suggestions)).toBe(true);
      });
    });

    describe('getComplementarySkills', () => {
      it('should return complementary skills', async () => {
        const baseSkill = mockSkill({
          skill_id: 'skill_base',
          category: 'python',
          tags: ['python', 'api'],
        });
        mockPrisma.skill.findUnique.mockResolvedValue(baseSkill);
        mockPrisma.skill.findMany.mockResolvedValue([]);

        const results = await service.getComplementarySkills('skill_base');
        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe('restoreSkill', () => {
      it('should clear deleted_at and set status to published', async () => {
        const deletedSkill = {
          ...mockSkill(),
          deleted_at: new Date(),
          status: 'published',
        };
        mockPrisma.skill.findUnique.mockResolvedValue(deletedSkill);
        mockPrisma.skill.update.mockResolvedValue({
          ...mockSkill(),
          deleted_at: null,
        });

        await service.restoreSkill('skill_test_001', 'node_001');
        expect(mockPrisma.skill.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ deleted_at: null, status: 'published' }),
          }),
        );
      });

      it('should throw when skill is not deleted', async () => {
        mockPrisma.skill.findUnique.mockResolvedValue(mockSkill());
        await expect(service.restoreSkill('skill_test_001', 'node_001')).rejects.toThrow(
          ValidationError,
        );
      });
    });

    describe('getMySkills', () => {
      it('should return only skills authored by the user', async () => {
        mockPrisma.skill.findMany.mockResolvedValue([mockSkill()]);
        mockPrisma.skill.count.mockResolvedValue(1);

        const result = await service.getMySkills('node_001');
        expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ author_id: 'node_001', deleted_at: null }),
          }),
        );
        expect(result.items).toHaveLength(1);
      });
    });

    describe('updateSkillVersion', () => {
      it('should snapshot the current version before updating', async () => {
        mockPrisma.skill.findUnique.mockResolvedValue(mockSkill({
          skill_id: 'skill_test_001',
          versions: [],
        }));
        mockPrisma.skill.update.mockResolvedValue(mockSkill({
          skill_id: 'skill_test_001',
          version: '1.0.1',
        }));

        const result = await service.updateSkillVersion('skill_test_001', 'node_001', {
          description: 'Updated description',
        });

        expect(result.version).toBe('1.0.1');
        expect(mockPrisma.skill.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              version: '1.0.1',
              versions: expect.arrayContaining([
                expect.objectContaining({ version: '1.0.0' }),
              ]),
            }),
          }),
        );
      });
    });

    describe('rollbackSkillVersion', () => {
      it('should restore a previous version snapshot', async () => {
        mockPrisma.skill.findUnique.mockResolvedValue(mockSkill({
          skill_id: 'skill_test_001',
          version: '1.0.1',
          versions: [
            {
              version: '1.0.0',
              name: 'Original Skill',
              description: 'Original description',
              category: 'testing',
              price_credits: 5,
              code_template: 'function original() { return true; }',
              parameters: null,
              steps: ['Step 1'],
              examples: ['example'],
              tags: ['testing'],
              source_capsules: ['cap_001'],
            },
          ],
        }));
        mockPrisma.skill.update.mockResolvedValue(mockSkill({
          skill_id: 'skill_test_001',
          version: '1.0.0',
          name: 'Original Skill',
        }));

        const result = await service.rollbackSkillVersion('skill_test_001', 'node_001');

        expect(result.version).toBe('1.0.0');
        expect(mockPrisma.skill.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              version: '1.0.0',
              name: 'Original Skill',
            }),
          }),
        );
      });
    });

    describe('permanentlyDeleteSkill', () => {
      it('should delete ratings before deleting the skill', async () => {
        mockPrisma.skill.findUnique.mockResolvedValue(mockSkill());
        mockPrisma.skillRating.deleteMany.mockResolvedValue({ count: 2 });
        mockPrisma.skill.delete = jest.fn().mockResolvedValue(mockSkill());

        const result = await service.permanentlyDeleteSkill('skill_test_001', 'node_001');

        expect(result).toEqual({ deleted: true });
        expect(mockPrisma.skillRating.deleteMany).toHaveBeenCalledWith({
          where: { skill_id: 'skill_test_001' },
        });
        expect(mockPrisma.skill.delete).toHaveBeenCalledWith({
          where: { skill_id: 'skill_test_001' },
        });
      });

      it('should throw when the skill does not exist', async () => {
        mockPrisma.skill.findUnique.mockResolvedValue(null);

        await expect(service.permanentlyDeleteSkill('missing', 'node_001')).rejects.toThrow('not found');
      });

      it('should reject permanent deletion for another author', async () => {
        mockPrisma.skill.findUnique.mockResolvedValue(mockSkill({ author_id: 'node_999' }));

        await expect(service.permanentlyDeleteSkill('skill_test_001', 'node_001')).rejects.toThrow(
          'permanently delete your own',
        );
      });
    });

    describe('getSkillStoreStats', () => {
      it('should summarize store-wide skill metrics', async () => {
        mockPrisma.skill.findMany.mockResolvedValue([
          mockSkill({ status: 'published', rating: 4.5, rating_count: 2, download_count: 10 }),
          mockSkill({
            skill_id: 'skill_test_002',
            author_id: 'node_002',
            status: 'pending',
            deleted_at: new Date(),
            rating: 3,
            rating_count: 1,
            download_count: 5,
          }),
        ]);

        const result = await service.getSkillStoreStats();

        expect(result).toEqual({
          total_skills: 2,
          published: 1,
          pending: 0,
          deleted: 1,
          total_downloads: 15,
          avg_rating: 4,
          total_authors: 2,
        });
      });
    });
  });

  // ==================================================================
  // Service Entry Point — direct prisma callers
  // ==================================================================

  describe('listSkills', () => {
    it('should return paginated skills', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([{ skill_id: 'sk-1', name: 'Test' }]);
      mockPrisma.skill.count.mockResolvedValue(1);

      const result = await service.listSkills();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by category', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      mockPrisma.skill.count.mockResolvedValue(0);

      await service.listSkills('coding');

      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ category: 'coding' }) }),
      );
    });
  });

  describe('getSkill', () => {
    it('should return a skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({
        skill_id: 'sk-1',
        author_id: 'node-1',
        status: 'published',
        deleted_at: null,
      });

      const result = await service.getSkill('sk-1');

      expect(result?.skill_id).toBe('sk-1');
    });

    it('should return null for deleted skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', deleted_at: new Date() });

      const result = await service.getSkill('sk-1');

      expect(result).toBeNull();
    });

    it('should hide drafts from non-authors', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({
        skill_id: 'sk-1',
        author_id: 'node-2',
        status: 'pending',
        deleted_at: null,
      });

      const result = await service.getSkill('sk-1');

      expect(result).toBeNull();
    });

    it('should allow authors to read their own drafts', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({
        skill_id: 'sk-1',
        author_id: 'node-1',
        status: 'pending',
        deleted_at: null,
      });

      const result = await service.getSkill('sk-1', undefined, 'node-1');

      expect(result?.skill_id).toBe('sk-1');
    });
  });

  describe('createSkill', () => {
    it('should create a skill with pending status', async () => {
      mockPrisma.skill.create.mockResolvedValue({ skill_id: 'sk-1', status: 'pending' });

      const result = await service.createSkill('node-1', {
        name: 'New Skill',
        description: 'A new skill',
        category: 'coding',
      });

      expect(result.status).toBe('pending');
    });

    it('should reject empty name', async () => {
      await expect(
        service.createSkill('node-1', { name: '', description: 'desc', category: 'cat' }),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject empty description', async () => {
      await expect(
        service.createSkill('node-1', { name: 'name', description: '', category: 'cat' }),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject whitespace-only description', async () => {
      await expect(
        service.createSkill('node-1', { name: 'name', description: '   ', category: 'cat' }),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject empty category', async () => {
      await expect(
        service.createSkill('node-1', { name: 'name', description: 'desc', category: '' }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('createPublishedSkill', () => {
    it('should create and publish a skill atomically', async () => {
      const pendingSkill = mockSkill({ skill_id: 'sk-1', author_id: 'node-1', status: 'pending' });
      const publishedSkill = mockSkill({ skill_id: 'sk-1', author_id: 'node-1', status: 'published' });
      mockPrisma.skill.create.mockResolvedValue(pendingSkill);
      mockPrisma.skill.findUnique.mockResolvedValue(pendingSkill);
      mockPrisma.skill.update.mockResolvedValue(publishedSkill);

      const result = await service.createPublishedSkill('node-1', {
        name: 'New Skill',
        description: 'A new skill',
        category: 'coding',
      });

      expect(result.status).toBe('published');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateSkill', () => {
    it('should update a skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1', name: 'Updated' });

      const result = await service.updateSkill('sk-1', 'node-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });
  });

  describe('deleteSkill', () => {
    it('should soft-delete a skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1' });

      await expect(service.deleteSkill('sk-1', 'node-1')).resolves.not.toThrow();
    });
  });

  describe('publishSkill', () => {
    it('should publish a skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1', status: 'pending' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1', status: 'published' });

      const result = await service.publishSkill('sk-1', 'node-1');

      expect(result.status).toBe('published');
    });
  });

  describe('publishSkillWithUpdates', () => {
    it('should publish a skill and apply updates atomically', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({
        skill_id: 'sk-1',
        author_id: 'node-1',
        status: 'pending',
      });
      mockPrisma.skill.update.mockResolvedValue({
        skill_id: 'sk-1',
        status: 'published',
        category: 'engineering',
        price_credits: 25,
      });

      const result = await service.publishSkillWithUpdates('sk-1', 'node-1', {
        category: 'engineering',
        price_credits: 25,
      });

      expect(result.status).toBe('published');
      expect(mockPrisma.skill.update).toHaveBeenCalledWith({
        where: { skill_id: 'sk-1' },
        data: expect.objectContaining({
          status: 'published',
          category: 'engineering',
          price_credits: 25,
        }),
      });
    });

    it('should reject already published skills without updating metadata', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({
        skill_id: 'sk-1',
        author_id: 'node-1',
        status: 'published',
      });

      await expect(service.publishSkillWithUpdates('sk-1', 'node-1', {
        category: 'engineering',
        price_credits: 25,
      })).rejects.toThrow('already published');

      expect(mockPrisma.skill.update).not.toHaveBeenCalled();
    });

    it('should reject blank category updates before publishing', async () => {
      await expect(service.publishSkillWithUpdates('sk-1', 'node-1', {
        category: '   ',
      })).rejects.toThrow('category is required');

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.skill.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.publishSkillWithUpdates('missing', 'node-1')).rejects.toThrow('not found');
      expect(mockPrisma.skill.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError for deleted skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({
        skill_id: 'sk-1',
        author_id: 'node-1',
        deleted_at: new Date(),
      });
      await expect(service.publishSkillWithUpdates('sk-1', 'node-1')).rejects.toThrow('not found');
      expect(mockPrisma.skill.update).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for non-owner', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({
        skill_id: 'sk-1',
        author_id: 'other-node',
        status: 'pending',
      });
      await expect(service.publishSkillWithUpdates('sk-1', 'node-1')).rejects.toThrow('only publish your own');
      expect(mockPrisma.skill.update).not.toHaveBeenCalled();
    });
  });

  describe('rateSkill', () => {
    it('should create a rating', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1' });
      mockPrisma.skillRating.upsert.mockResolvedValue({ skill_id: 'sk-1', rater_id: 'rater-1', rating: 5 });
      mockPrisma.skillRating.aggregate.mockResolvedValue({ _avg: { rating: 5 }, _count: { rating: 1 } });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1' });

      const result = await service.rateSkill('sk-1', 'rater-1', 5);

      expect(result.rating).toBe(5);
    });

    it('should reject invalid rating', async () => {
      await expect(service.rateSkill('sk-1', 'rater-1', 6)).rejects.toThrow(ValidationError);
      await expect(service.rateSkill('sk-1', 'rater-1', 0)).rejects.toThrow(ValidationError);
    });
  });

  describe('downloadSkill', () => {
    it('should increment download count', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', download_count: 10, status: 'published' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1' });

      await service.downloadSkill('sk-1', 'node-1');

      expect(mockPrisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ download_count: { increment: 1 } }) }),
      );
    });
  });

  describe('getCategories', () => {
    it('should return category counts', async () => {
      mockPrisma.skill.groupBy.mockResolvedValue([{ category: 'coding', _count: { category: 5 } }]);

      const result = await service.getCategories();

      expect(result).toHaveLength(1);
    });
  });

  describe('getFeaturedSkills', () => {
    it('should return featured skills', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([{ skill_id: 'sk-1' }]);

      const result = await service.getFeaturedSkills(5);

      expect(result).toHaveLength(1);
    });
  });

  // ==================================================================
  // Additional coverage for service.ts branches
  // ==================================================================

  describe('listSkills — sort variants', () => {
    it('should sort by rating', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([{ skill_id: 'sk-1' }]);
      mockPrisma.skill.count.mockResolvedValue(1);
      await service.listSkills(undefined, undefined, undefined, 20, 0, 'rating');
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { rating: 'desc' } }),
      );
    });

    it('should sort by downloads', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([{ skill_id: 'sk-1' }]);
      mockPrisma.skill.count.mockResolvedValue(1);
      await service.listSkills(undefined, undefined, undefined, 20, 0, 'downloads');
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { download_count: 'desc' } }),
      );
    });

    it('should sort by price_asc', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([{ skill_id: 'sk-1' }]);
      mockPrisma.skill.count.mockResolvedValue(1);
      await service.listSkills(undefined, undefined, undefined, 20, 0, 'price_asc');
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { price_credits: 'asc' } }),
      );
    });

    it('should sort by price_desc', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([{ skill_id: 'sk-1' }]);
      mockPrisma.skill.count.mockResolvedValue(1);
      await service.listSkills(undefined, undefined, undefined, 20, 0, 'price_desc');
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { price_credits: 'desc' } }),
      );
    });

    it('should filter by tags', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      mockPrisma.skill.count.mockResolvedValue(0);
      await service.listSkills(undefined, ['test', 'unit']);
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tags: { hasSome: ['test', 'unit'] } }) }),
      );
    });

    it('should skip tags filter when empty', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([{ skill_id: 'sk-1' }]);
      mockPrisma.skill.count.mockResolvedValue(1);
      await service.listSkills(undefined, []);
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.not.objectContaining({ tags: expect.anything() }) }),
      );
    });

    it('should search by name and description', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      mockPrisma.skill.count.mockResolvedValue(0);
      await service.listSkills(undefined, undefined, 'api handler');
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.objectContaining({ contains: 'api handler', mode: 'insensitive' }) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('updateSkill — field branches', () => {
    it('should update description', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1', description: 'Updated desc' });
      const result = await service.updateSkill('sk-1', 'node-1', { description: 'Updated desc' });
      expect(result.description).toBe('Updated desc');
    });

    it('should update category', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1', category: 'web' });
      const result = await service.updateSkill('sk-1', 'node-1', { category: 'web' });
      expect(result.category).toBe('web');
    });

    it('should update price_credits', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1', price_credits: 15 });
      const result = await service.updateSkill('sk-1', 'node-1', { price_credits: 15 });
      expect(result.price_credits).toBe(15);
    });

    it('should reject fractional price_credits', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      await expect(service.updateSkill('sk-1', 'node-1', { price_credits: 12.5 })).rejects.toThrow(
        'price_credits must be a non-negative integer',
      );
      expect(mockPrisma.skill.update).not.toHaveBeenCalled();
    });

    it('should update code_template', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1', code_template: 'new code' });
      const result = await service.updateSkill('sk-1', 'node-1', { code_template: 'new code' });
      expect(result.code_template).toBe('new code');
    });

    it('should update parameters', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1' });
      await service.updateSkill('sk-1', 'node-1', { parameters: { timeout: 5000 } });
      expect(mockPrisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ parameters: { timeout: 5000 } }),
        }),
      );
    });

    it('should update steps', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1' });
      await service.updateSkill('sk-1', 'node-1', { steps: ['Step A', 'Step B'] });
      expect(mockPrisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ steps: ['Step A', 'Step B'] }),
        }),
      );
    });

    it('should update examples', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1' });
      await service.updateSkill('sk-1', 'node-1', { examples: ['example A'] });
      expect(mockPrisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ examples: ['example A'] }),
        }),
      );
    });

    it('should update tags', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1' });
      await service.updateSkill('sk-1', 'node-1', { tags: ['python', 'api'] });
      expect(mockPrisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tags: ['python', 'api'] }),
        }),
      );
    });

    it('should update source_capsules', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'node-1' });
      mockPrisma.skill.update.mockResolvedValue({ skill_id: 'sk-1' });
      await service.updateSkill('sk-1', 'node-1', { source_capsules: ['cap_new'] });
      expect(mockPrisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source_capsules: ['cap_new'] }),
        }),
      );
    });

    it('should throw NotFoundError for non-existent skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.updateSkill('nonexistent', 'node-1', { name: 'x' })).rejects.toThrow('not found');
    });

    it('should throw NotFoundError for deleted skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', deleted_at: new Date() });
      await expect(service.updateSkill('sk-1', 'node-1', { name: 'x' })).rejects.toThrow('not found');
    });

    it('should throw ValidationError for non-owner', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'other-node' });
      await expect(service.updateSkill('sk-1', 'node-1', { name: 'x' })).rejects.toThrow('only update your own');
    });
  });

  describe('deleteSkill', () => {
    it('should throw NotFoundError for non-existent skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.deleteSkill('nonexistent', 'node-1')).rejects.toThrow('not found');
    });

    it('should throw NotFoundError for deleted skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', deleted_at: new Date() });
      await expect(service.deleteSkill('sk-1', 'node-1')).rejects.toThrow('not found');
    });

    it('should throw ValidationError for non-owner', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'other-node' });
      await expect(service.deleteSkill('sk-1', 'node-1')).rejects.toThrow('only delete your own');
    });
  });

  describe('publishSkill', () => {
    it('should throw NotFoundError for non-existent skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.publishSkill('nonexistent', 'node-1')).rejects.toThrow('not found');
    });

    it('should throw NotFoundError for deleted skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', deleted_at: new Date() });
      await expect(service.publishSkill('sk-1', 'node-1')).rejects.toThrow('not found');
    });

    it('should throw ValidationError for non-owner', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', author_id: 'other-node' });
      await expect(service.publishSkill('sk-1', 'node-1')).rejects.toThrow('only publish your own');
    });

    it('should throw ValidationError for already published skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({
        skill_id: 'sk-1', author_id: 'node-1', status: 'published',
      });
      await expect(service.publishSkill('sk-1', 'node-1')).rejects.toThrow('already published');
    });
  });

  describe('rateSkill — deleted skill', () => {
    it('should throw NotFoundError for non-existent skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.rateSkill('missing', 'rater-1', 4)).rejects.toThrow('not found');
    });

    it('should throw NotFoundError for deleted skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', deleted_at: new Date() });
      await expect(service.rateSkill('sk-1', 'rater-1', 4)).rejects.toThrow('not found');
    });
  });

  describe('downloadSkill', () => {
    it('should throw NotFoundError for non-existent skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.downloadSkill('nonexistent', 'node-1')).rejects.toThrow('not found');
    });

    it('should throw NotFoundError for deleted skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', deleted_at: new Date() });
      await expect(service.downloadSkill('sk-1', 'node-1')).rejects.toThrow('not found');
    });

    it('should throw ValidationError for unpublished skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', status: 'pending' });
      await expect(service.downloadSkill('sk-1', 'node-1')).rejects.toThrow('Only published skills');
    });
  });

  describe('restoreSkill', () => {
    it('should throw NotFoundError for non-existent skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.restoreSkill('nonexistent', 'node-1')).rejects.toThrow('not found');
    });

    it('should throw ValidationError for non-deleted skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-1', deleted_at: null, author_id: 'node-1' });
      await expect(service.restoreSkill('sk-1', 'node-1')).rejects.toThrow('not deleted');
    });

    it('should throw ValidationError for non-owner', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({
        skill_id: 'sk-1', deleted_at: new Date(), author_id: 'other-node',
      });
      await expect(service.restoreSkill('sk-1', 'node-1')).rejects.toThrow('only restore your own');
    });
  });

  describe('listWorkers — branch coverage', () => {
    // listWorkers is in workerpool/service.ts, not skill_store
    // This section intentionally left blank — coverage is handled in workerpool tests
  });

  // ==================================================================
  // Additional coverage for recommendation / ranking
  // ==================================================================

  describe('recommendation — recommendSkills', () => {
    beforeEach(() => {
      recommendation.setPrisma(mockPrisma as unknown as PrismaClient);
      ranking.setPrisma(mockPrisma as unknown as PrismaClient);
    });

    it('should recommend skills based on user profile', async () => {
      const skill = mockSkill({ skill_id: 'rec-1', category: 'python', tags: ['python'] });
      mockPrisma.skillRating.findMany.mockResolvedValue([]);
      mockPrisma.skill.findMany.mockResolvedValue([{ skill_id: 'rec-1', tags: ['python'], category: 'python' }]);
      mockPrisma.skill.findUnique.mockResolvedValue(skill);

      const result = await service.getRecommendedSkills('node-001', 5);

      expect(mockPrisma.skill.findMany).toHaveBeenCalled();
    });
  });

  describe('ranking — compareSkills tie', () => {
    beforeEach(() => {
      ranking.setPrisma(mockPrisma as unknown as PrismaClient);
    });

    it('should return tie when scores are equal', async () => {
      const now = new Date();
      mockPrisma.skill.findUnique
        .mockResolvedValueOnce(mockSkill({ skill_id: 'sA', updated_at: now, rating: 4.0, download_count: 50, rating_count: 10 }))
        .mockResolvedValueOnce(mockSkill({ skill_id: 'sB', updated_at: now, rating: 4.0, download_count: 50, rating_count: 10 }));

      const result = await ranking.compareSkills('sA', 'sB');
      expect(result.winner).toBe('tie');
    });
  });

  describe('ranking — calculateSkillScore with deleted skill', () => {
    beforeEach(() => {
      ranking.setPrisma(mockPrisma as unknown as PrismaClient);
    });

    it('should throw for deleted skill', async () => {
      mockPrisma.skill.findUnique.mockResolvedValue({ skill_id: 'sk-del', deleted_at: new Date() });
      await expect(ranking.calculateSkillScore('sk-del')).rejects.toThrow('not found');
    });
  });

  describe('ranking — getTopRankedSkills', () => {
    beforeEach(() => {
      ranking.setPrisma(mockPrisma as unknown as PrismaClient);
    });

    it('should return top skills', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([mockSkill()]);
      mockPrisma.skill.count.mockResolvedValue(1);
      mockPrisma.skill.findUnique.mockResolvedValue(mockSkill());

      const result = await service.getTopRankedSkills(5);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      mockPrisma.skill.findMany.mockResolvedValue([mockSkill({ category: 'web' })]);
      mockPrisma.skill.count.mockResolvedValue(1);
      mockPrisma.skill.findUnique.mockResolvedValue(mockSkill({ category: 'web' }));

      const result = await service.getTopRankedSkills(5, 'web');

      expect(mockPrisma.skill.findMany).toHaveBeenCalled();
    });
  });

  describe('ranking — compareTwoSkills', () => {
    beforeEach(() => {
      ranking.setPrisma(mockPrisma as unknown as PrismaClient);
    });

    it('should compare two skills via service', async () => {
      mockPrisma.skill.findUnique
        .mockResolvedValueOnce(mockSkill({ skill_id: 's1', rating: 5.0, download_count: 100 }))
        .mockResolvedValueOnce(mockSkill({ skill_id: 's2', rating: 3.0, download_count: 10 }));

      const result = await service.compareTwoSkills('s1', 's2');
      expect(result.skillA).toBe('s1');
      expect(result.skillB).toBe('s2');
    });
  });
});
