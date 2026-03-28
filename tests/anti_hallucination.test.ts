/**
 * Anti-Hallucination Module Tests
 */

import { HallucinationDetector } from '../src/anti_hallucination/detector';
import { ValidationExecutor } from '../src/anti_hallucination/validator';
import { calculateConfidence, getConfidenceGrade, projectDecay, DECAY_PRESETS } from '../src/anti_hallucination/confidence';
import { AntiHallucinationEngine } from '../src/anti_hallucination/engine';

describe('【反幻觉】Hallucination Detector', () => {
  let detector: HallucinationDetector;

  beforeEach(() => {
    detector = new HallucinationDetector();
  });

  describe('detectForbiddenPatterns', () => {
    it('should detect eval() usage', () => {
      const code = 'result = eval("2 + 2")';
      const alerts = detector.detectForbiddenPatterns(code);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('security_risk');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].description).toContain('eval');
    });

    it('should detect exec() usage', () => {
      const code = 'exec("print(1)")';
      const alerts = detector.detectForbiddenPatterns(code);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('high');
    });

    it('should detect shell=True in subprocess', () => {
      const code = 'subprocess.run(cmd, shell=True)';
      const alerts = detector.detectForbiddenPatterns(code);
      expect(alerts.some(a => a.description.toLowerCase().includes('shell'))).toBe(true);
    });

    it('should detect hardcoded passwords', () => {
      const code = 'password = "secret123"';
      const alerts = detector.detectForbiddenPatterns(code);
      expect(alerts.some(a => a.type === 'security_risk')).toBe(true);
    });

    it('should detect hardcoded API keys', () => {
      const code = 'api_key = "sk-1234567890abcdef"';
      const alerts = detector.detectForbiddenPatterns(code);
      expect(alerts.some(a => a.description.toLowerCase().includes('api'))).toBe(true);
    });

    it('should return empty for safe code', () => {
      const code = `
        import json
        import os

        def load_config(path):
            with open(path) as f:
                return json.load(f)
      `;
      const alerts = detector.detectForbiddenPatterns(code);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('detectPlaceholderPatterns', () => {
    it('should detect TODO placeholder comments', () => {
      const code = '# TODO: implementation required';
      const alerts = detector.detectPlaceholderPatterns(code);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should detect stub functions with only pass', () => {
      const code = `
def future_feature():
    pass
      `;
      const alerts = detector.detectPlaceholderPatterns(code);
      expect(alerts.some(a => a.type === 'logic_error')).toBe(true);
    });

    it('should detect stub functions with only return None', () => {
      const code = `
def future_feature():
    return None
      `;
      const alerts = detector.detectPlaceholderPatterns(code);
      expect(alerts.some(a => a.type === 'logic_error')).toBe(true);
    });
  });

  describe('classifyError', () => {
    it('should classify ImportError as L3', () => {
      const result = detector.classifyError('ImportError: No module named xyz', '');
      expect(result.level).toBe('L3_hallucination');
    });

    it('should classify ModuleNotFoundError as L3', () => {
      const result = detector.classifyError('ModuleNotFoundError', '');
      expect(result.level).toBe('L3_hallucination');
    });

    it('should classify AttributeError as L2', () => {
      const result = detector.classifyError('AttributeError: module has no attribute xyz', '');
      expect(result.level).toBe('L2_semantic');
    });

    it('should classify TypeError as L2', () => {
      const result = detector.classifyError('TypeError: unsupported operand type', '');
      expect(result.level).toBe('L2_semantic');
    });

    it('should return L3 for unknown errors', () => {
      const result = detector.classifyError('SomeUnknownError', '');
      expect(result.level).toBe('L3_hallucination');
    });
  });

  describe('findSimilarApi', () => {
    it('should find similar API when method name is close', () => {
      // 'json.loadd' is close to 'json.load'
      const suggestion = detector.findSimilarApi('json.loadd');
      expect(suggestion).toBe('json.load');
    });

    it('should return null for unknown module', () => {
      const suggestion = detector.findSimilarApi('unknown_module.method');
      expect(suggestion).toBeNull();
    });
  });
});

describe('【反幻觉】Validation Executor', () => {
  let executor: ValidationExecutor;

  beforeEach(() => {
    executor = new ValidationExecutor();
  });

  describe('execute', () => {
    it('should pass valid python syntax check', async () => {
      const cmd = { type: 'syntax' as const, command: 'python -c "print(1)"', timeout_seconds: 5 };
      const result = await executor.execute(cmd);
      expect(result.passed).toBe(true);
      expect(result.type).toBe('syntax');
      expect(result.output).toContain('1');
    });

    it('should fail invalid python syntax', async () => {
      const cmd = { type: 'syntax' as const, command: "python -c 'x=1; print(x'", timeout_seconds: 5 };
      const result = await executor.execute(cmd);
      expect(result.passed).toBe(false);
    });

    it('should respect timeout', async () => {
      // Use a loop that takes long to avoid shell builtin issues
      const cmd = { type: 'syntax' as const, command: 'python3 -c "import time; time.sleep(10)"', timeout_seconds: 1 };
      const result = await executor.execute(cmd);
      expect(result.passed).toBe(false);
      expect(result.error || '').toMatch(/timed out|timeout|TERM/i);
    }, 10000);
  });

  describe('generateForGene', () => {
    it('should generate python validation commands', () => {
      const cmds = ValidationExecutor.generateForGene('python');
      expect(cmds.length).toBeGreaterThan(0);
      expect(cmds.some(c => c.type === 'syntax')).toBe(true);
    });

    it('should generate typescript validation commands', () => {
      const cmds = ValidationExecutor.generateForGene('typescript');
      expect(cmds.some(c => c.type === 'syntax')).toBe(true);
      expect(cmds.some(c => c.type === 'linter')).toBe(true);
    });
  });

  describe('aggregateResults', () => {
    it('should return passed for all passing validations', () => {
      const results = [
        { passed: true, type: 'syntax' as const, output: '', duration_ms: 10, timestamp: '' },
        { passed: true, type: 'linter' as const, output: '', duration_ms: 20, timestamp: '' },
      ];
      const { passed, score } = ValidationExecutor.aggregateResults(results);
      expect(passed).toBe(true);
      expect(score).toBeGreaterThan(0.5);
    });

    it('should return failed if any validation fails', () => {
      const results = [
        { passed: true, type: 'syntax' as const, output: '', duration_ms: 10, timestamp: '' },
        { passed: false, type: 'linter' as const, output: '', error: 'error', duration_ms: 20, timestamp: '' },
      ];
      const { passed } = ValidationExecutor.aggregateResults(results);
      expect(passed).toBe(false);
    });
  });
});

describe('【反幻觉】Confidence Decay Model', () => {
  describe('calculateConfidence', () => {
    it('should apply exponential decay over time', () => {
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      const feedback = { positive_count: 0, negative_count: 0, fetch_count: 0 };
      const conf1 = calculateConfidence(1.0, oldDate, feedback, { lambda: 0.023 });
      expect(conf1).toBeLessThan(1.0);
      expect(conf1).toBeGreaterThan(0.4);
    });

    it('should increase with positive feedback', () => {
      const recentDate = new Date().toISOString();
      const noFeedback = { positive_count: 0, negative_count: 0, fetch_count: 0 };
      const withFeedback = { positive_count: 5, negative_count: 0, fetch_count: 0 };
      const conf0 = calculateConfidence(0.8, recentDate, noFeedback);
      const conf5 = calculateConfidence(0.8, recentDate, withFeedback);
      expect(conf5).toBeGreaterThan(conf0);
    });

    it('should decrease with negative feedback', () => {
      const recentDate = new Date().toISOString();
      const noFeedback = { positive_count: 0, negative_count: 0, fetch_count: 0 };
      const withNegative = { positive_count: 0, negative_count: 3, fetch_count: 0 };
      const conf0 = calculateConfidence(0.8, recentDate, noFeedback);
      const confNeg = calculateConfidence(0.8, recentDate, withNegative);
      expect(confNeg).toBeLessThan(conf0);
    });

    it('should be bounded between 0.1 and 1.0', () => {
      const feedback = { positive_count: 0, negative_count: 100, fetch_count: 0 };
      const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year ago
      const conf = calculateConfidence(1.0, oldDate, feedback);
      expect(conf).toBeGreaterThanOrEqual(0.1);
      expect(conf).toBeLessThanOrEqual(1.0);
    });
  });

  describe('getConfidenceGrade', () => {
    it('should return A+ for confidence >= 0.9', () => {
      const grade = getConfidenceGrade(0.95);
      expect(grade.grade).toBe('A+');
    });

    it('should return B for confidence >= 0.5 and < 0.7', () => {
      const grade = getConfidenceGrade(0.6);
      expect(grade.grade).toBe('B');
    });

    it('should return F for confidence < 0.1', () => {
      const grade = getConfidenceGrade(0.05);
      expect(grade.grade).toBe('F');
    });
  });

  describe('projectDecay', () => {
    it('should project confidence over 30 days', () => {
      const createdAt = new Date().toISOString();
      const feedback = { positive_count: 0, negative_count: 0, fetch_count: 0 };
      const projections = projectDecay(0.8, createdAt, feedback, 30, 7);
      expect(projections.length).toBeGreaterThan(0);
      expect(projections[0].date).toBeDefined();
      // Confidence should generally decline
      const firstConf = projections[0].confidence;
      const lastConf = projections[projections.length - 1].confidence;
      expect(lastConf).toBeLessThanOrEqual(firstConf);
    });
  });

  describe('DECAY_PRESETS', () => {
    it('should have conservative, default, and aggressive presets', () => {
      expect(DECAY_PRESETS.conservative).toBeDefined();
      expect(DECAY_PRESETS.default).toBeDefined();
      expect(DECAY_PRESETS.aggressive).toBeDefined();
    });

    it('conservative should have longest half-life', () => {
      expect(DECAY_PRESETS.conservative.halfLifeDays).toBeGreaterThan(DECAY_PRESETS.default.halfLifeDays);
      expect(DECAY_PRESETS.default.halfLifeDays).toBeGreaterThan(DECAY_PRESETS.aggressive.halfLifeDays);
    });
  });
});

describe('【反幻觉】Anti-Hallucination Engine', () => {
  let engine: AntiHallucinationEngine;

  beforeEach(() => {
    engine = new AntiHallucinationEngine();
  });

  describe('checkContent', () => {
    it('should pass safe content', () => {
      const content = `
import json
def load_config(path):
    with open(path) as f:
        return json.load(f)
      `;
      const result = engine.checkContent(content, 'test_asset');
      expect(result.overall_passed).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should fail content with eval', () => {
      const content = 'eval("dangerous code")';
      const result = engine.checkContent(content, 'test_asset');
      expect(result.overall_passed).toBe(false);
      expect(result.detected_hallucinations.some(h => h.type === 'security_risk')).toBe(true);
    });
  });

  describe('check with validation commands', () => {
    it('should run validation commands if provided', async () => {
      const content = 'print("hello")';
      const commands = [{ type: 'syntax' as const, command: 'python -c "print(1)"', timeout_seconds: 5 }];
      const result = await engine.check('test_asset', content, commands);
      expect(result.validations.length).toBe(1);
      expect(result.validations[0].passed).toBe(true);
    });
  });

  describe('trust anchors', () => {
    it('should have default anchors registered', () => {
      const anchors = engine.getAnchors();
      expect(anchors.length).toBeGreaterThan(0);
    });

    it('should verify content against anchors', () => {
      const content = 'import requests\nrequests.get("http://example.com")';
      const results = engine.verifyWithAnchors(content);
      expect(results).toBeDefined();
    });
  });

  describe('confidence tracking', () => {
    it('should track confidence with snapshot', () => {
      const createdAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const feedback = { positive_count: 2, negative_count: 0, fetch_count: 5 };
      const snapshot = engine.trackConfidence('asset_123', 0.9, createdAt, feedback, 30);
      expect(snapshot.asset_id).toBe('asset_123');
      expect(snapshot.initial_confidence).toBe(0.9);
      expect(snapshot.current_confidence).toBeLessThan(0.9);
      expect(snapshot.projected_decay.length).toBeGreaterThan(0);
    });

    it('should get confidence grade', () => {
      const grade = engine.getConfidenceGrade(0.85);
      expect(grade.grade).toBe('A');
    });
  });
});
