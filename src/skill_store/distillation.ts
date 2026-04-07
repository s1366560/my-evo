/**
 * Skill Distillation Engine
 *
 * Automatically extracts skills from successful Agent practices.
 * Triggered when ≥7 of the last 10 Capsules are successful for a node,
 * with similar task_type/tags, and 24h cooldown has passed.
 */

import { createSkill } from './service';
import { ValidationError } from '../shared/errors';

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const DISTILLATION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const REQUIRED_SUCCESS_RATE = 0.7; // 7 out of 10
const RECENT_CAPSULES_WINDOW = 10;
const MAX_ASSOCIATED_FILES = 12;
const INITIAL_GDI_DISCOUNT = 0.8;
const INITIAL_CONFIDENCE = 0.7;

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface SuccessfulPractice {
  asset_id: string;
  asset_type: string;
  name: string;
  description: string;
  content: string | null;
  signals: string[];
  tags: string[];
  author_id: string;
  status: string;
  gdi_score: number;
  success_signal?: boolean;
  config?: Record<string, unknown> | null;
}

export interface SkillPattern {
  name: string;
  description: string;
  tags: string[];
  taskType: string;
  codeTemplate: string;
  parameters: Record<string, unknown>;
  steps: string[];
  examples: string[];
  avgGdiScore: number;
  sourceCapsuleIds: string[];
}

export interface DistillationInput {
  nodeId: string;
  capsules: SuccessfulPractice[];
  cooldownAfter?: number; // Unix ms, when last distillation occurred
}

export interface DistillationResult {
  skillId: string;
  pattern: SkillPattern;
  gdiScore: number;
  confidence: number;
}

export interface ExtractionMetrics {
  totalCapsules: number;
  successfulCount: number;
  similarCount: number;
  cooldownRemainingMs: number;
  canDistill: boolean;
}

// ------------------------------------------------------------------
// Cooldown check
// ------------------------------------------------------------------

export function checkCooldown(lastDistillationAt?: number): number {
  if (!lastDistillationAt) return 0;
  const elapsed = Date.now() - lastDistillationAt;
  return Math.max(0, DISTILLATION_COOLDOWN_MS - elapsed);
}

export function canDistill(input: DistillationInput): ExtractionMetrics {
  const { capsules, cooldownAfter } = input;

  const cooldownRemainingMs = checkCooldown(cooldownAfter);

  const successful = capsules.filter(
    (c) => c.asset_type === 'capsule' && (c.success_signal !== false),
  );

  const successRate = capsules.length > 0 ? successful.length / capsules.length : 0;

  // Identify similar capsules by tag overlap
  const tagFrequency = new Map<string, number>();
  for (const capsule of successful) {
    for (const tag of capsule.tags ?? []) {
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    }
  }

  const dominantTags = [...tagFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const similar = successful.filter((c) =>
    (c.tags ?? []).some((tag: string) => dominantTags.includes(tag)),
  );

  const canDistill =
    capsules.length >= RECENT_CAPSULES_WINDOW &&
    successRate >= REQUIRED_SUCCESS_RATE &&
    cooldownRemainingMs === 0 &&
    similar.length >= 3;

  return {
    totalCapsules: capsules.length,
    successfulCount: successful.length,
    similarCount: similar.length,
    cooldownRemainingMs,
    canDistill,
  };
}

// ------------------------------------------------------------------
// extractSkill
// ------------------------------------------------------------------

export async function extractSkill(
  input: DistillationInput,
): Promise<DistillationResult> {
  const metrics = canDistill(input);
  if (!metrics.canDistill) {
    throw new ValidationError(
      `Distillation conditions not met: need ${RECENT_CAPSULES_WINDOW} capsules, ` +
        `${Math.ceil(RECENT_CAPSULES_WINDOW * REQUIRED_SUCCESS_RATE)}+ successful, ` +
        `24h cooldown elapsed, and ≥3 similar. ` +
        `Got ${metrics.totalCapsules} capsules, ${metrics.successfulCount} successful, ` +
        `${metrics.similarCount} similar, cooldown remaining ${metrics.cooldownRemainingMs}ms`,
    );
  }

  const pattern = identifySkillPattern(input.capsules);
  const distilled = distillToCode(pattern);

  const result = await createSkill(input.nodeId, {
    name: distilled.name,
    description: distilled.description,
    category: pattern.taskType || 'general',
    tags: pattern.tags,
    code_template: pattern.codeTemplate,
    parameters: pattern.parameters,
    steps: pattern.steps,
    examples: pattern.examples,
    source_capsules: pattern.sourceCapsuleIds,
    price_credits: 5,
  });

  return {
    skillId: result.skill_id,
    pattern,
    gdiScore: Math.round(pattern.avgGdiScore * INITIAL_GDI_DISCOUNT),
    confidence: INITIAL_CONFIDENCE,
  };
}

// ------------------------------------------------------------------
// identifySkillPattern
// ------------------------------------------------------------------

export function identifySkillPattern(capsules: SuccessfulPractice[]): SkillPattern {
  const successful = capsules.filter(
    (c) => c.asset_type === 'capsule' && (c.success_signal !== false),
  );

  if (successful.length === 0) {
    throw new ValidationError('No successful capsules provided for pattern identification');
  }

  // Extract dominant tags
  const tagFrequency = new Map<string, number>();
  for (const capsule of successful) {
    for (const tag of capsule.tags ?? []) {
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    }
  }

  const dominantTags = [...tagFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  // Determine task type from most common tags
  const taskType = dominantTags[0] || 'general';

  // Extract common signals across capsules
  const signalFrequency = new Map<string, number>();
  for (const capsule of successful) {
    for (const signal of capsule.signals ?? []) {
      signalFrequency.set(signal, (signalFrequency.get(signal) ?? 0) + 1);
    }
  }

  const commonSignals = [...signalFrequency.entries()]
    .filter(([, count]) => count >= successful.length * 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([signal]) => signal);

  // Generate name from common signals
  const nameParts = commonSignals.length > 0
    ? commonSignals.map(s => s.replace(/_/g, ' ')).join(' + ')
    : taskType.replace(/_/g, ' ');
  const name = `Distilled: ${capitalize(nameParts)}`;

  // Generate description
  const avgGdi = successful.reduce((sum, c) => sum + c.gdi_score, 0) / successful.length;
  const description = `Auto-distilled skill extracted from ${successful.length} successful capsule(s). ` +
    `Average GDI: ${avgGdi.toFixed(1)}. Tags: ${dominantTags.join(', ')}.`;

  // Extract code patterns from content
  const codeTemplate = extractCodeTemplate(successful);

  // Extract parameters from config
  const parameters = extractParameters(successful);

  // Generate steps from common signals
  const steps = generateSteps(commonSignals, taskType);

  // Extract examples
  const examples = extractExamples(successful);

  // Source capsule IDs
  const sourceCapsuleIds = successful.map((c) => c.asset_id);

  return {
    name,
    description,
    tags: dominantTags,
    taskType,
    codeTemplate,
    parameters,
    steps,
    examples,
    avgGdiScore: avgGdi,
    sourceCapsuleIds,
  };
}

// ------------------------------------------------------------------
// distillToCode
// ------------------------------------------------------------------

export function distillToCode(pattern: SkillPattern): {
  name: string;
  description: string;
  codeTemplate: string;
  parameters: Record<string, unknown>;
  steps: string[];
  examples: string[];
} {
  // Build a structured code template from the pattern
  const codeTemplate = buildCodeTemplate(pattern);

  return {
    name: pattern.name,
    description: pattern.description,
    codeTemplate,
    parameters: pattern.parameters,
    steps: pattern.steps,
    examples: pattern.examples,
  };
}

// ------------------------------------------------------------------
// validateDistilledSkill
// ------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDistilledSkill(skill: {
  name?: string;
  description?: string;
  code_template?: string | null;
  steps?: string[];
  examples?: string[];
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!skill.name || skill.name.trim().length < 3) {
    errors.push('Name must be at least 3 characters');
  }
  if (!skill.description || skill.description.trim().length < 10) {
    errors.push('Description must be at least 10 characters');
  }

  // Content checks
  if (!skill.code_template || skill.code_template.trim().length < 20) {
    warnings.push('Code template is short or missing; may lack detail');
  }

  if (!skill.steps || skill.steps.length === 0) {
    warnings.push('No execution steps provided');
  } else if (skill.steps.length > MAX_ASSOCIATED_FILES) {
    errors.push(`Too many steps: ${skill.steps.length} (max ${MAX_ASSOCIATED_FILES})`);
  }

  if (!skill.examples || skill.examples.length === 0) {
    warnings.push('No usage examples provided');
  }

  // Special character ratio check (L2 moderation)
  if (skill.code_template) {
    const specialCharRatio = computeSpecialCharRatio(skill.code_template);
    if (specialCharRatio > 0.15) {
      errors.push(`Special character ratio too high: ${(specialCharRatio * 100).toFixed(1)}% (max 15%)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

function extractCodeTemplate(capsules: SuccessfulPractice[]): string {
  const contents = capsules
    .map((c) => c.content)
    .filter((content): content is string => Boolean(content && content.trim().length > 0));

  if (contents.length === 0) {
    return '// No code template extracted';
  }

  // Find common code structure across capsules
  const lines = contents.flatMap((c) => c.split('\n').map((l) => l.trim()).filter(Boolean));

  // Deduplicate and take representative lines (max MAX_ASSOCIATED_FILES)
  const uniqueLines = [...new Set(lines)].slice(0, MAX_ASSOCIATED_FILES);

  return uniqueLines.join('\n');
}

function extractParameters(capsules: SuccessfulPractice[]): Record<string, unknown> {
  // Merge config fields across capsules
  const paramSets = capsules
    .map((c) => c.config)
    .filter((config): config is Record<string, unknown> => config != null);

  if (paramSets.length === 0) {
    return {};
  }

  // Merge parameters, taking the most common value for each key
  const allKeys = [...new Set(paramSets.flatMap((s) => Object.keys(s)))];

  const merged: Record<string, unknown> = {};
  for (const key of allKeys) {
    const values = paramSets.map((s) => s[key]).filter((v) => v !== undefined);
    // Use most frequent value
    const frequency = new Map<unknown, number>();
    for (const v of values) {
      frequency.set(v, (frequency.get(v) ?? 0) + 1);
    }
    const mostFrequent = [...frequency.entries()].sort((a, b) => b[1] - a[1])[0];
    if (mostFrequent) {
      merged[key] = mostFrequent[0];
    }
  }

  return merged;
}

function generateSteps(commonSignals: string[], taskType: string): string[] {
  const steps: string[] = [];

  if (commonSignals.length > 0) {
    steps.push(`1. Identify ${commonSignals[0]} context`);
  }
  steps.push('2. Prepare input parameters');
  steps.push('3. Execute core logic');
  if (commonSignals.length > 1) {
    steps.push(`4. Validate ${commonSignals[1]} output`);
  }
  steps.push('5. Return result and log execution');

  return steps.slice(0, MAX_ASSOCIATED_FILES);
}

function extractExamples(capsules: SuccessfulPractice[]): string[] {
  const examples: string[] = [];

  for (const capsule of capsules.slice(0, 3)) {
    if (capsule.name) {
      examples.push(`Example: ${capsule.name}`);
    }
    if (capsule.content && capsule.content.trim().length > 0) {
      const firstLine = capsule.content.split('\n').find((l) => l.trim().length > 0) ?? '';
      if (firstLine) {
        examples.push(`Code: ${firstLine.slice(0, 100)}`);
      }
    }
  }

  return [...new Set(examples)].slice(0, 5);
}

function buildCodeTemplate(pattern: SkillPattern): string {
  const parts: string[] = [
    `// Skill: ${pattern.name}`,
    `// Task Type: ${pattern.taskType}`,
    `// Source Capsules: ${pattern.sourceCapsuleIds.length}`,
    '',
  ];

  if (pattern.codeTemplate && pattern.codeTemplate.trim().length > 0) {
    parts.push('// --- Code Template ---');
    parts.push(pattern.codeTemplate);
  }

  if (Object.keys(pattern.parameters).length > 0) {
    parts.push('');
    parts.push('// --- Parameters ---');
    for (const [key, value] of Object.entries(pattern.parameters)) {
      parts.push(`// ${key}: ${JSON.stringify(value)}`);
    }
  }

  return parts.join('\n');
}

function computeSpecialCharRatio(text: string): number {
  if (text.length === 0) return 0;
  const specialChars = text.replace(/[\w\s\n\r\t]/g, '').length;
  return specialChars / text.length;
}

function capitalize(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}
