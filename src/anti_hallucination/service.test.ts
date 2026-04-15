import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { NotFoundError, ValidationError } from '../shared/errors';

const {
  performCheck,
  validateCode,
  detectHallucination,
  getCheck,
  listChecks,
  getConfidence,
  listForbiddenPatterns,
  getCheckStats,
  listAnchors,
  addAnchor,
  listGraphNodes,
  getGraphNode,
  upsertGraphNode,
  listGraphEdges,
  createGraphEdge,
  getCapabilityChain,
} = service;

const mockPrisma = {
  hallucinationCheck: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  trustAnchor: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  memoryGraphNode: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  memoryGraphEdge: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  capabilityChain: {
    findFirst: jest.fn(),
  },
} as any;

describe('Anti-Hallucination Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.hallucinationCheck.findMany.mockResolvedValue([]);
  });

  describe('performCheck', () => {
    it('should create a check with alerts when code contains TODO/FIXME', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-1',
        node_id: 'node-1',
        has_hallucination: true,
        alert_count: 1,
        result: {},
        confidence: 0.85,
        alerts: ['Found 1 TODO/FIXME/HACK comment(s) in code'],
        validation_type: 'code_review',
      });

      const result = await performCheck('node-1', 'function test() { // TODO: fix later }', 'code_review') as any;

      expect(result.has_hallucination).toBe(true);
      expect(result.alert_count).toBe(1);
      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalled();
    });

    it('should create a clean check when code has no issues', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-2',
        node_id: 'node-1',
        has_hallucination: false,
        alert_count: 0,
        result: {},
        confidence: 0.95,
        alerts: [],
        validation_type: 'code_review',
      });

      const result = await performCheck('node-1', 'function greet(name) { return `Hello, ${name}!`; }', 'code_review') as any;

      expect(result.has_hallucination).toBe(false);
      expect(result.alert_count).toBe(0);
    });

    it('should detect hardcoded credentials', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-3',
        node_id: 'node-1',
        has_hallucination: true,
        alert_count: 1,
        result: {},
        confidence: 0.85,
        alerts: ['Potential hardcoded secret or credential detected'],
        validation_type: 'security',
      });

      const result = await performCheck('node-1', 'const apiKey = "sk-proj-1234567890abcdef";', 'security') as any;

      expect(result.has_hallucination).toBe(true);
      expect(result.alerts).toContain('Potential hardcoded secret or credential detected');
    });

    it('should reject empty code content', async () => {
      await expect(performCheck('node-1', '', 'code_review')).rejects.toThrow(ValidationError);
      await expect(performCheck('node-1', '   ', 'code_review')).rejects.toThrow(ValidationError);
    });

    it('should pass language through validateCode for validator-aware checks', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-validate-lang',
        node_id: 'node-1',
        result: {},
        confidence: 0.95,
        alerts: [],
        validation_type: 'validate',
      });

      await validateCode('node-1', 'const x = 1;', 'asset-1', 'typescript');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              language: 'typescript',
            }),
          }),
        }),
      );
    });

    it('does not execute user code for unit_test validation types', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-static-unit-test',
        node_id: 'node-1',
        result: {},
        confidence: 0.4,
        alerts: [],
        validation_type: 'unit_test',
      });

      await performCheck(
        'node-1',
        'console.log("should not execute"); process.exit(1);',
        'unit_test',
        'asset-2',
        'javascript',
      );

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              validations: [
                {
                  type: 'unit_test',
                  passed: false,
                  message: 'Unit-test execution unavailable for this language',
                },
              ],
            }),
          }),
        }),
      );
    });

    it('should reject missing validation_type', async () => {
      await expect(performCheck('node-1', 'some code', '')).rejects.toThrow(ValidationError);
    });

    it('should detect repeated magic numbers', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-4',
        node_id: 'node-1',
        has_hallucination: true,
        alert_count: 1,
        result: {},
        confidence: 0.85,
        alerts: ['Repeated magic numbers detected (consider using named constants)'],
        validation_type: 'code_review',
      });

      const code = 'const a = 42; const b = 42; const c = 42; const d = 42;';
      const result = await performCheck('node-1', code, 'code_review') as any;

      expect(result.has_hallucination).toBe(true);
      expect(result.alerts).toContain('Repeated magic numbers detected (consider using named constants)');
    });

    it('should detect repeated placeholder stubs', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-5',
        node_id: 'node-1',
        has_hallucination: true,
        alert_count: 1,
        result: {},
        confidence: 0.8,
        alerts: ['Multiple placeholder or stub patterns detected'],
        validation_type: 'code_review',
      });

      const code = Array.from({ length: 6 }, () => 'return null;').join('\n');
      const result = await performCheck('node-1', code, 'code_review') as any;

      expect(result.alerts).toContain('Multiple placeholder or stub patterns detected');
    });

    it('should persist compatibility metadata for language and trust anchors', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-6',
        node_id: 'node-1',
        has_hallucination: false,
        alert_count: 0,
        result: {
          language: 'python',
          trust_anchors_used: [{ type: 'document', source: 'requests-docs', confidence: 0.95 }],
        },
        confidence: 0.95,
        alerts: [],
        validation_type: 'check',
      });

      await performCheck(
        'node-1',
        'print("hello")',
        'check',
        'asset-1',
        'python',
        [{ type: 'document', source: 'requests-docs', confidence: 0.95 }],
      );

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              language: 'python',
              trust_anchors_used: [{ type: 'document', source: 'requests-docs', confidence: 0.95 }],
            }),
          }),
        }),
      );
    });

    it('should detect invalid API calls and persist structured validation output', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-7',
        node_id: 'node-1',
        confidence: 0.57,
        validation_type: 'check',
      });

      await performCheck(
        'node-1',
        "import requests\nresponse = requests.download('https://example.com/file.zip')",
        'check',
        'asset-2',
        'python',
        [{ type: 'document', source: 'requests-docs', confidence: 0.95 }],
      );

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validation_type: 'check',
            result: expect.objectContaining({
              passed: false,
              validations: expect.arrayContaining([
                expect.objectContaining({ type: 'syntax', passed: true }),
              ]),
              alerts: expect.arrayContaining([
                expect.objectContaining({
                  type: 'invalid_api',
                  level: 'L3',
                  message: 'requests.download() does not exist in the requests library',
                  suggestion: expect.stringContaining('requests.get()'),
                }),
              ]),
            }),
          }),
        }),
      );
    });

    it('should use generic nearest-api suggestions for other allowlisted modules', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-8',
        node_id: 'node-1',
        confidence: 0.6,
        validation_type: 'check',
      });

      await performCheck('node-1', 'import json\nvalue = json.lods("{}")', 'check');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              alerts: expect.arrayContaining([
                expect.objectContaining({
                  type: 'invalid_api',
                  suggestion: 'Did you mean: json.loads() ?',
                }),
              ]),
            }),
          }),
        }),
      );
    });

    it('should keep unknown modules out of the invalid-api detector', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-9',
        node_id: 'node-1',
        confidence: 0.9,
        validation_type: 'check',
      });

      await performCheck('node-1', 'customSdk.fetchThing()', 'check');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              alerts: [],
              passed: true,
            }),
          }),
        }),
      );
    });

    it('should mark syntax validation as failed when delimiters are unbalanced', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-10',
        node_id: 'node-1',
        confidence: 0.4,
        validation_type: 'syntax',
      });

      await performCheck('node-1', 'function broken( { return 1; }', 'syntax');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              passed: false,
              validations: [{ type: 'syntax', passed: false, message: 'Syntax appears invalid' }],
            }),
          }),
        }),
      );
    });

    it('should report unavailable runtime validation when benchmark execution cannot run', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-11',
        node_id: 'node-1',
        confidence: 0.9,
        validation_type: 'benchmark',
      });

      await performCheck('node-1', 'const stable = 1;', 'benchmark');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              validations: [{ type: 'benchmark', passed: false, message: 'Benchmark execution unavailable for this language' }],
            }),
          }),
        }),
      );
    });

    it('should deduplicate repeated credential alerts and fail weak trust anchors', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-12',
        node_id: 'node-1',
        confidence: 0.34,
        validation_type: 'check',
      });

      await performCheck(
        'node-1',
        'password = "secret"\nsecret = "another"\nkey = "third"',
        'check',
        'asset-3',
        'python',
        [{ type: 'document', source: 'unverified-note', confidence: 0.2 }],
      );

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              alert_count: 1,
              alerts: [
                expect.objectContaining({
                  type: 'security_risk',
                  message: 'Potential hardcoded secret or credential detected',
                }),
              ],
              validations: expect.arrayContaining([
                expect.objectContaining({
                  type: 'trust_anchor',
                  passed: false,
                  message: 'Trust anchors are too weak (avg confidence 0.20)',
                }),
              ]),
              passed: false,
            }),
          }),
        }),
      );
    });

    it('should keep javascript syntax validation static-only', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-13',
        node_id: 'node-1',
        confidence: 0.95,
        validation_type: 'syntax',
      });

      await performCheck('node-1', 'const answer = 42;\nconsole.log(answer);', 'syntax', undefined, 'javascript');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              validations: [
                expect.objectContaining({
                  type: 'syntax',
                  passed: true,
                  message: 'syntax validation passed',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('should keep bash syntax validation static-only', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-14',
        node_id: 'node-1',
        confidence: 0.95,
        validation_type: 'syntax',
      });

      await performCheck('node-1', 'echo hello\nif [ 1 -eq 1 ]; then echo ok; fi', 'syntax', undefined, 'bash');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              validations: [
                expect.objectContaining({
                  type: 'syntax',
                  passed: true,
                  message: 'syntax validation passed',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('should mark python unit-test validation as unavailable without execution', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-15',
        node_id: 'node-1',
        confidence: 0.95,
        validation_type: 'unit_test',
      });

      await performCheck('node-1', 'print("unit ok")', 'unit_test', undefined, 'python');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              validations: [
                expect.objectContaining({
                  type: 'unit_test',
                  passed: false,
                  message: 'Unit-test execution unavailable for this language',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('should mark javascript integration validation as unavailable without execution', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-16',
        node_id: 'node-1',
        confidence: 0.95,
        validation_type: 'integration',
      });

      await performCheck('node-1', 'console.log("integration ok");', 'integration', undefined, 'js');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              validations: [
                expect.objectContaining({
                  type: 'integration',
                  passed: false,
                  message: 'Integration execution unavailable for this language',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('should mark bash benchmark validation as unavailable without execution', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-17',
        node_id: 'node-1',
        confidence: 0.95,
        validation_type: 'benchmark',
      });

      await performCheck('node-1', 'echo benchmark-ok', 'benchmark', undefined, 'shell');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              validations: [
                expect.objectContaining({
                  type: 'benchmark',
                  passed: false,
                  message: 'Benchmark execution unavailable for this language',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('should fall back to linter-only validation when shell execution is unsupported for the type', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-18',
        node_id: 'node-1',
        confidence: 0.84,
        validation_type: 'linter',
      });

      await performCheck('node-1', 'print("lint")', 'linter', undefined, 'python');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              validations: [
                expect.objectContaining({
                  type: 'linter',
                  passed: true,
                  message: 'No lint-style issues detected',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('should fall back to heuristic validation for unknown validation types and unsupported languages', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-19',
        node_id: 'node-1',
        confidence: 0.84,
        validation_type: 'custom_scan',
      });

      await performCheck('node-1', 'puts "hello"', 'custom_scan', undefined, 'ruby');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              validations: [
                expect.objectContaining({
                  type: 'custom_scan',
                  passed: true,
                  message: 'Heuristic validation completed',
                }),
              ],
              language: 'ruby',
            }),
          }),
        }),
      );
    });

    it('should increase confidence when history is clean and recent', async () => {
      mockPrisma.hallucinationCheck.findMany.mockResolvedValue([
        {
          created_at: new Date(Date.now() - 60 * 60 * 1000),
          result: { passed: true, has_hallucination: false },
        },
      ]);
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-20',
        node_id: 'node-1',
        confidence: 0.96,
        validation_type: 'check',
      });

      await performCheck('node-1', 'const stable = 1;', 'check', 'asset-4', 'javascript');

      const [{ data }] = mockPrisma.hallucinationCheck.create.mock.calls.at(-1);
      expect(data.confidence).toBeGreaterThan(0.92);
    });

    it('should decrease confidence when history contains recent failed checks', async () => {
      mockPrisma.hallucinationCheck.findMany.mockResolvedValue([
        {
          created_at: new Date(Date.now() - 60 * 60 * 1000),
          result: { passed: false, has_hallucination: true },
        },
      ]);
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-21',
        node_id: 'node-1',
        confidence: 0.78,
        validation_type: 'check',
      });

      await performCheck('node-1', 'const stable = 1;', 'check', 'asset-5', 'javascript');

      const [{ data }] = mockPrisma.hallucinationCheck.create.mock.calls.at(-1);
      expect(data.confidence).toBeLessThan(0.92);
    });
  });

  describe('getCheck', () => {
    it('should return a check by id', async () => {
      const mockCheck = { check_id: 'chk-1', node_id: 'node-1' };
      mockPrisma.hallucinationCheck.findUnique.mockResolvedValue(mockCheck);

      const result = await getCheck('chk-1', 'node-1');
      expect(result).toEqual(mockCheck);
    });

    it('should return null when check not found', async () => {
      mockPrisma.hallucinationCheck.findUnique.mockResolvedValue(null);
      const result = await getCheck('nonexistent', 'node-1');
      expect(result).toBeNull();
    });

    it('should hide checks owned by another node', async () => {
      mockPrisma.hallucinationCheck.findUnique.mockResolvedValue({ check_id: 'chk-1', node_id: 'node-2' });

      const result = await getCheck('chk-1', 'node-1');

      expect(result).toBeNull();
    });
  });

  describe('validateCode and detectHallucination', () => {
    it('should create validation-specific checks', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-validate',
        node_id: 'node-1',
        validation_type: 'validate',
        confidence: 0.9,
      });

      await validateCode('node-1', 'const x = 1;');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validation_type: 'validate',
          }),
        }),
      );
    });

    it('should create detection-specific checks', async () => {
      mockPrisma.hallucinationCheck.create.mockResolvedValue({
        check_id: 'chk-detect',
        node_id: 'node-1',
        validation_type: 'detect',
        confidence: 0.8,
      });

      await detectHallucination('node-1', 'const secret = "abc123456";');

      expect(mockPrisma.hallucinationCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validation_type: 'detect',
          }),
        }),
      );
    });
  });

  describe('listChecks', () => {
    it('should return paginated checks for a node', async () => {
      const items = [{ check_id: 'chk-1' }, { check_id: 'chk-2' }];
      mockPrisma.hallucinationCheck.findMany.mockResolvedValue(items);
      mockPrisma.hallucinationCheck.count.mockResolvedValue(2);

      const result = await listChecks('node-1', 20, 0);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.hallucinationCheck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { node_id: 'node-1' } }),
      );
    });

    it('should apply pagination', async () => {
      mockPrisma.hallucinationCheck.findMany.mockResolvedValue([{ check_id: 'chk-3' }]);
      mockPrisma.hallucinationCheck.count.mockResolvedValue(3);

      await listChecks('node-1', 1, 0);

      expect(mockPrisma.hallucinationCheck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1, skip: 0 }),
      );
    });
  });

  describe('getConfidence', () => {
    it('should return the latest confidence record for a node asset', async () => {
      mockPrisma.hallucinationCheck.findFirst.mockResolvedValue({
        check_id: 'chk-latest',
        node_id: 'node-1',
        asset_id: 'asset-1',
        confidence: 0.92,
        validation_type: 'check',
        result: {
          has_hallucination: false,
          alert_count: 0,
          summary: 'No obvious hallucinations detected',
        },
        created_at: new Date('2025-01-02T00:00:00Z'),
      });

      const result = await getConfidence('node-1', { assetId: 'asset-1' });

      expect(result.check_id).toBe('chk-latest');
      expect(result.asset_id).toBe('asset-1');
      expect(result.confidence).toBe(0.92);
      expect(mockPrisma.hallucinationCheck.findFirst).toHaveBeenCalledWith({
        where: { node_id: 'node-1', asset_id: 'asset-1' },
        orderBy: { created_at: 'desc' },
      });
    });

    it('should look up a specific check id and fall back to alert array length', async () => {
      mockPrisma.hallucinationCheck.findUnique.mockResolvedValue({
        check_id: 'chk-direct',
        node_id: 'node-1',
        asset_id: null,
        confidence: 0.75,
        validation_type: 'detect',
        result: { has_hallucination: true, summary: 'Potential issue' },
        alerts: ['issue-1', 'issue-2'],
        created_at: new Date('2025-01-03T00:00:00Z'),
      });

      const result = await getConfidence('node-1', { checkId: 'chk-direct' });

      expect(result.alert_count).toBe(2);
      expect(result.has_hallucination).toBe(true);
    });

    it('should throw when a direct check belongs to another node', async () => {
      mockPrisma.hallucinationCheck.findUnique.mockResolvedValue({
        check_id: 'chk-foreign',
        node_id: 'node-2',
        created_at: new Date(),
      });

      await expect(getConfidence('node-1', { checkId: 'chk-foreign' })).rejects.toThrow(NotFoundError);
    });

    it('should throw when no confidence record exists for the node', async () => {
      mockPrisma.hallucinationCheck.findFirst.mockResolvedValue(null);

      await expect(getConfidence('node-1', { assetId: 'asset-missing' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('listForbiddenPatterns', () => {
    it('should expose the configured forbidden pattern catalog', () => {
      const patterns = listForbiddenPatterns();

      expect(patterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'eval-exec' }),
          expect.objectContaining({ id: 'hardcoded-password' }),
        ]),
      );
      expect(patterns).toHaveLength(10);
    });
  });

  describe('getCheckStats', () => {
    it('should summarize global anti-hallucination checks', async () => {
      mockPrisma.hallucinationCheck.findMany.mockResolvedValue([
        {
          validation_type: 'check',
          confidence: 0.9,
          result: { has_hallucination: false },
          created_at: new Date(),
        },
        {
          validation_type: 'detect',
          confidence: 0.6,
          result: { has_hallucination: true },
          created_at: new Date(),
        },
      ]);

      const result = await getCheckStats();

      expect(result.total_checks).toBe(2);
      expect(result.checks_with_alerts).toBe(1);
      expect(result.by_validation_type).toEqual({ check: 1, detect: 1 });
    });

    it('should return empty stats when no checks exist', async () => {
      mockPrisma.hallucinationCheck.findMany.mockResolvedValue([]);

      const result = await getCheckStats();

      expect(result).toEqual({
        total_checks: 0,
        avg_confidence: 0,
        checks_with_alerts: 0,
        alert_rate: 0,
        recent_24h: 0,
        by_validation_type: {},
      });
    });
  });

  describe('listAnchors', () => {
    it('should list all anchors without filter', async () => {
      const items = [{ anchor_id: 'anc-1' }];
      mockPrisma.trustAnchor.findMany.mockResolvedValue(items);
      mockPrisma.trustAnchor.count.mockResolvedValue(1);

      const result = await listAnchors();

      expect(result.items).toHaveLength(1);
      expect(mockPrisma.trustAnchor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should filter anchors by type', async () => {
      mockPrisma.trustAnchor.findMany.mockResolvedValue([]);
      mockPrisma.trustAnchor.count.mockResolvedValue(0);

      await listAnchors('github');

      expect(mockPrisma.trustAnchor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'github' } }),
      );
    });
  });

  describe('addAnchor', () => {
    it('should create a trust anchor with valid data', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      mockPrisma.trustAnchor.create.mockResolvedValue({
        anchor_id: 'anc-1',
        type: 'github',
        source: 'https://github.com/user/repo',
        confidence: 0.95,
        expires_at: futureDate,
      });

      const result = await addAnchor('github', 'https://github.com/user/repo', 0.95, futureDate);

      expect(result.type).toBe('github');
    });

    it('should reject invalid confidence', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      await expect(addAnchor('github', 'source', 1.5, futureDate)).rejects.toThrow(ValidationError);
      await expect(addAnchor('github', 'source', -0.1, futureDate)).rejects.toThrow(ValidationError);
    });

    it('should reject past expiry date', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      await expect(addAnchor('github', 'source', 0.9, pastDate)).rejects.toThrow(ValidationError);
    });

    it('should require both type and source', async () => {
      const futureDate = new Date(Date.now() + 86400000);

      await expect(addAnchor('', 'source', 0.9, futureDate)).rejects.toThrow(ValidationError);
      await expect(addAnchor('github', '', 0.9, futureDate)).rejects.toThrow(ValidationError);
    });
  });

  describe('listGraphNodes', () => {
    it('should list nodes sorted by gdi_score', async () => {
      mockPrisma.memoryGraphNode.findMany.mockResolvedValue([{ node_id: 'node-1', gdi_score: 80 }]);
      mockPrisma.memoryGraphNode.count.mockResolvedValue(1);

      const result = await listGraphNodes();

      expect(result.items).toHaveLength(1);
      expect(mockPrisma.memoryGraphNode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { gdi_score: 'desc' } }),
      );
    });

    it('should filter by min confidence', async () => {
      mockPrisma.memoryGraphNode.findMany.mockResolvedValue([]);
      mockPrisma.memoryGraphNode.count.mockResolvedValue(0);

      await listGraphNodes(undefined, 0.8);

      expect(mockPrisma.memoryGraphNode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ confidence: { gte: 0.8 } }) }),
      );
    });
  });

  describe('getGraphNode', () => {
    it('should return a graph node by id', async () => {
      mockPrisma.memoryGraphNode.findUnique.mockResolvedValue({ node_id: 'node-1' });
      const result = await getGraphNode('node-1');
      expect(result).toEqual({ node_id: 'node-1' });
    });

    it('should return null when not found', async () => {
      mockPrisma.memoryGraphNode.findUnique.mockResolvedValue(null);
      expect(await getGraphNode('nonexistent')).toBeNull();
    });
  });

  describe('upsertGraphNode', () => {
    it('should create a new graph node', async () => {
      mockPrisma.memoryGraphNode.upsert.mockResolvedValue({ node_id: 'node-1', type: 'gene', label: 'Test Gene' });

      const result = await upsertGraphNode('node-1', 'gene', 'Test Gene', { version: 1 });

      expect(mockPrisma.memoryGraphNode.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { node_id: 'node-1' },
          update: expect.objectContaining({ type: 'gene', label: 'Test Gene' }),
        }),
      );
    });

    it('should reject missing required fields', async () => {
      await expect(upsertGraphNode('', 'gene', 'label')).rejects.toThrow(ValidationError);
      await expect(upsertGraphNode('node-1', '', 'label')).rejects.toThrow(ValidationError);
      await expect(upsertGraphNode('node-1', 'gene', '')).rejects.toThrow(ValidationError);
    });
  });

  describe('listGraphEdges', () => {
    it('should list all edges without filters', async () => {
      mockPrisma.memoryGraphEdge.findMany.mockResolvedValue([{ edge_id: 'e-1' }]);
      mockPrisma.memoryGraphEdge.count.mockResolvedValue(1);

      const result = await listGraphEdges();

      expect(result.items).toHaveLength(1);
    });

    it('should filter by source and target', async () => {
      mockPrisma.memoryGraphEdge.findMany.mockResolvedValue([]);
      mockPrisma.memoryGraphEdge.count.mockResolvedValue(0);

      await listGraphEdges('node-a', 'node-b');

      expect(mockPrisma.memoryGraphEdge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { source_id: 'node-a', target_id: 'node-b' },
        }),
      );
    });
  });

  describe('createGraphEdge', () => {
    it('should create an edge when both nodes exist', async () => {
      mockPrisma.memoryGraphNode.findUnique
        .mockResolvedValueOnce({ node_id: 'node-a' })
        .mockResolvedValueOnce({ node_id: 'node-b' });
      mockPrisma.memoryGraphEdge.create.mockResolvedValue({
        edge_id: 'e-1',
        source_id: 'node-a',
        target_id: 'node-b',
        relation: 'evolves_from',
        weight: 0.5,
      });

      const result = await createGraphEdge('node-a', 'node-b', 'evolves_from', 0.5);

      expect(result.relation).toBe('evolves_from');
    });

    it('should throw NotFoundError when source node does not exist', async () => {
      mockPrisma.memoryGraphNode.findUnique.mockResolvedValue(null);

      await expect(createGraphEdge('nonexistent', 'node-b', 'evolves_from')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when target node does not exist', async () => {
      mockPrisma.memoryGraphNode.findUnique
        .mockResolvedValueOnce({ node_id: 'node-a' })
        .mockResolvedValueOnce(null);

      await expect(createGraphEdge('node-a', 'nonexistent', 'evolves_from')).rejects.toThrow(NotFoundError);
    });

    it('should reject invalid weight', async () => {
      await expect(createGraphEdge('node-a', 'node-b', 'evolves_from', 1.5)).rejects.toThrow(ValidationError);
      await expect(createGraphEdge('node-a', 'node-b', 'evolves_from', -0.1)).rejects.toThrow(ValidationError);
    });

    it('should require source, target, and relation identifiers', async () => {
      await expect(createGraphEdge('', 'node-b', 'evolves_from')).rejects.toThrow(ValidationError);
      await expect(createGraphEdge('node-a', '', 'evolves_from')).rejects.toThrow(ValidationError);
      await expect(createGraphEdge('node-a', 'node-b', '')).rejects.toThrow(ValidationError);
    });
  });

  describe('getCapabilityChain', () => {
    it('should return the most recent chain for an asset', async () => {
      const chain = { chain_id: 'chain-1', root_asset_id: 'asset-1', chain: ['a1', 'a2'] };
      mockPrisma.capabilityChain.findFirst.mockResolvedValue(chain);

      const result = await getCapabilityChain('asset-1');
      expect(result).toEqual(chain);
    });

    it('should return null when no chain exists', async () => {
      mockPrisma.capabilityChain.findFirst.mockResolvedValue(null);
      expect(await getCapabilityChain('nonexistent')).toBeNull();
    });
  });
});
