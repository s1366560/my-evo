/**
 * Anti-Hallucination Engine
 * Main orchestrator for asset validation, trust verification, and confidence tracking
 * Chapter 28: Anti-Hallucination (Complete Implementation)
 */

import { HallucinationDetector } from './detector';
import { ValidationExecutor } from './validator';
import { calculateConfidence, getConfidenceGrade, createSnapshot } from './confidence';
import type {
  AntiHallucinationResult,
  ValidationCommand,
  TrustAnchor,
  HallucinationAlert,
  ValidationResult,
  FeedbackHistory,
  ConfidenceSnapshot,
  ValidationConfig,
} from './types';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Anti-Hallucination Engine
 * Orchestrates validation, hallucination detection, and confidence tracking
 */
export class AntiHallucinationEngine {
  private detector: HallucinationDetector;
  private executor: ValidationExecutor;
  private trustAnchors: Map<string, TrustAnchor>;
  private validationConfigs: Map<string, ValidationConfig>;

  constructor() {
    this.detector = new HallucinationDetector();
    this.executor = new ValidationExecutor();
    this.trustAnchors = new Map();
    this.validationConfigs = new Map();
    this.registerDefaultAnchors();
  }

  /**
   * Register default trust anchors
   */
  private registerDefaultAnchors(): void {
    const defaultAnchors: TrustAnchor[] = [
      {
        type: 'document',
        name: 'Python Standard Library',
        description: 'Verified Python stdlib APIs',
        verified_apis: ['requests', 'json', 'os', 'subprocess', 'http', 'collections', 'urllib'],
        verified_patterns: ['^import \\w+', '^from \\w+ import'],
        source: 'python_stdlib',
        last_updated: new Date().toISOString(),
      },
      {
        type: 'test_suite',
        name: 'Unit Test Standards',
        description: 'Standard unit test patterns',
        verified_apis: ['pytest', 'unittest', 'assert'],
        verified_patterns: ['def test_\\w+', 'assert\\w*'],
        source: 'standard_testing',
        last_updated: new Date().toISOString(),
      },
      {
        type: 'community',
        name: 'Trusted Community Patterns',
        description: 'Community-verified code patterns',
        verified_apis: [],
        verified_patterns: ['^#.*comment'],
        source: 'community_verified',
        last_updated: new Date().toISOString(),
      },
    ];

    for (const anchor of defaultAnchors) {
      this.trustAnchors.set(anchor.name, anchor);
    }
  }

  /**
   * Run full anti-hallucination check on asset content
   */
  async check(
    assetId: string,
    content: string,
    validationCommands?: ValidationCommand[],
    options?: { skipValidation?: boolean; skipDetection?: boolean }
  ): Promise<AntiHallucinationResult> {
    const timestamp = new Date().toISOString();
    const validations: ValidationResult[] = [];
    let detected_hallucinations: HallucinationAlert[] = [];

    // Step 1: Execute validation commands (if provided)
    if (!options?.skipValidation && validationCommands && validationCommands.length > 0) {
      validations.push(...(await this.executor.executeAll(validationCommands)));
    }

    // Step 2: Detect hallucinations and forbidden patterns
    if (!options?.skipDetection) {
      detected_hallucinations = this.detector.detectAll(content);
    }

    // Step 3: Determine overall pass/fail
    const validationPassed = validations.length === 0 || validations.every(v => v.passed);
    const noHighSeverity = !detected_hallucinations.some(h => h.severity === 'high');
    const overallPassed = validationPassed && noHighSeverity;

    // Step 4: Calculate confidence
    const baseConfidence = overallPassed ? 0.8 : 0.3;
    const severityPenalty = detected_hallucinations.reduce((sum, h) => {
      if (h.severity === 'high') return sum + 0.2;
      if (h.severity === 'medium') return sum + 0.1;
      return sum + 0.05;
    }, 0);
    const validationBonus = validations.filter(v => v.passed).length * 0.02;
    const confidence = Math.max(0, Math.min(1, baseConfidence - severityPenalty + validationBonus));

    return {
      asset_id: assetId,
      overall_passed: overallPassed,
      confidence: Math.round(confidence * 1000) / 1000,
      validations,
      detected_hallucinations,
      forbidden_patterns_found: detected_hallucinations
        .filter(h => h.type === 'security_risk')
        .map(h => h.description),
      timestamp,
    };
  }

  /**
   * Check content only (no validation commands)
   */
  checkContent(content: string, assetId: string): AntiHallucinationResult {
    const timestamp = new Date().toISOString();
    const detected_hallucinations = this.detector.detectAll(content);
    const noHighSeverity = !detected_hallucinations.some(h => h.severity === 'high');
    const overallPassed = noHighSeverity;

    const baseConfidence = overallPassed ? 0.8 : 0.3;
    const severityPenalty = detected_hallucinations.reduce((sum, h) => {
      if (h.severity === 'high') return sum + 0.2;
      if (h.severity === 'medium') return sum + 0.1;
      return sum + 0.05;
    }, 0);
    const confidence = Math.max(0, Math.min(1, baseConfidence - severityPenalty));

    return {
      asset_id: assetId,
      overall_passed: overallPassed,
      confidence: Math.round(confidence * 1000) / 1000,
      validations: [],
      detected_hallucinations,
      forbidden_patterns_found: detected_hallucinations
        .filter(h => h.type === 'security_risk')
        .map(h => h.description),
      timestamp,
    };
  }

  /**
   * Verify content against registered trust anchors
   */
  verifyWithAnchors(content: string): ReturnType<HallucinationDetector['verifyAgainstAnchors']> {
    return this.detector.verifyAgainstAnchors(content, Array.from(this.trustAnchors.values()));
  }

  /**
   * Register a custom trust anchor
   */
  registerAnchor(anchor: TrustAnchor): void {
    this.trustAnchors.set(anchor.name, anchor);
  }

  /**
   * Get all registered anchors
   */
  getAnchors(): TrustAnchor[] {
    return Array.from(this.trustAnchors.values());
  }

  /**
   * Register a validation config for a gene
   */
  registerValidationConfig(config: ValidationConfig): void {
    this.validationConfigs.set(config.gene_id, config);
  }

  /**
   * Get validation config for a gene
   */
  getValidationConfig(geneId: string): ValidationConfig | undefined {
    return this.validationConfigs.get(geneId);
  }

  /**
   * Track confidence for an asset over time
   */
  trackConfidence(
    assetId: string,
    initialConfidence: number,
    createdAt: string,
    feedback: FeedbackHistory,
    horizonDays?: number
  ): ConfidenceSnapshot {
    return createSnapshot(assetId, initialConfidence, createdAt, feedback, {
      horizonDays: horizonDays ?? 30,
    });
  }

  /**
   * Get current confidence score
   */
  getCurrentConfidence(
    initialConfidence: number,
    createdAt: string,
    feedback: FeedbackHistory
  ): number {
    return calculateConfidence(initialConfidence, createdAt, feedback);
  }

  /**
   * Get confidence grade
   */
  getConfidenceGrade(confidence: number) {
    return getConfidenceGrade(confidence);
  }

  /**
   * Generate validation commands for a gene type
   */
  generateValidationCommands(
    geneCategory: string,
    language: 'python' | 'typescript' | 'javascript' | 'bash'
  ): ValidationCommand[] {
    return ValidationExecutor.generateForGene(language);
  }
}

// Singleton instance
let engineInstance: AntiHallucinationEngine | null = null;

export function getAntiHallucinationEngine(): AntiHallucinationEngine {
  if (!engineInstance) {
    engineInstance = new AntiHallucinationEngine();
  }
  return engineInstance;
}
