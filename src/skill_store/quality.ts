/**
 * Skill Quality Assessment
 *
 * Evaluates distilled skills across three dimensions:
 * - Clarity (0-100): How clear and understandable the skill is
 * - Completeness (0-100): How complete the skill definition is
 * - Reusability (0-100): How easily the skill can be reused across contexts
 */

export interface QualityScores {
  clarity: number;
  completeness: number;
  reusability: number;
}

export interface QualityAssessment {
  skillId: string;
  scores: QualityScores;
  overall: number;
  grade: QualityGrade;
  breakdown: Record<string, number>;
  suggestions: string[];
}

export type QualityGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface SkillContent {
  skill_id?: string;
  name?: string;
  description?: string;
  code_template?: string | null;
  parameters?: Record<string, unknown> | null;
  steps?: string[];
  examples?: string[];
  tags?: string[];
}

const MIN_NAME_LENGTH = 5;
const MIN_DESCRIPTION_LENGTH = 30;
const MIN_CODE_LENGTH = 50;
const MIN_STEPS = 2;
const MIN_EXAMPLES = 1;
const MAX_STEPS = 12;

// ------------------------------------------------------------------
// assessQuality
// ------------------------------------------------------------------

export function assessQuality(skill: SkillContent): QualityAssessment {
  const skillId = skill.skill_id ?? 'unknown';

  const clarity = scoreClarity(skill);
  const completeness = scoreCompleteness(skill);
  const reusability = scoreReusability(skill);

  const scores: QualityScores = { clarity, completeness, reusability };
  const overall = calculateOverallScore(scores);
  const grade = computeGrade(overall);
  const breakdown = {
    ...scores,
    overall,
  };
  const suggestions = generateSuggestions(scores, skill);

  return {
    skillId,
    scores,
    overall,
    grade,
    breakdown,
    suggestions,
  };
}

// ------------------------------------------------------------------
// scoreClarity
// ------------------------------------------------------------------

export function scoreClarity(skill: SkillContent): number {
  let score = 0;
  const name = skill.name ?? '';
  const description = skill.description ?? '';
  const code = skill.code_template ?? '';

  // Name contributes up to 25 points
  if (name.length >= MIN_NAME_LENGTH) score += 10;
  if (name.length >= 15) score += 15;

  // Description contributes up to 40 points
  if (description.length >= MIN_DESCRIPTION_LENGTH) score += 15;
  if (description.length >= 60) score += 15;
  if (description.length >= 100) score += 10;

  // Code clarity contributes up to 35 points
  if (code.length >= MIN_CODE_LENGTH) score += 15;
  if (code.length >= 100) score += 10;
  const lineCount = (code.match(/\n/g) ?? []).length;
  if (lineCount >= 3) score += 10;

  return Math.min(100, score);
}

// ------------------------------------------------------------------
// scoreCompleteness
// ------------------------------------------------------------------

export function scoreCompleteness(skill: SkillContent): number {
  let score = 0;

  // All core fields present
  if (skill.name && skill.name.trim().length > 0) score += 15;
  if (skill.description && skill.description.trim().length > 0) score += 15;

  // Code template
  const codeLen = (skill.code_template ?? '').trim().length;
  if (codeLen >= MIN_CODE_LENGTH) score += 20;
  else if (codeLen > 0) score += 10;

  // Parameters
  const paramCount = Object.keys(skill.parameters ?? {}).length;
  if (paramCount >= 3) score += 15;
  else if (paramCount > 0) score += Math.round((paramCount / 3) * 15);

  // Steps
  const stepCount = skill.steps?.length ?? 0;
  if (stepCount >= MIN_STEPS) score += 15;
  else if (stepCount > 0) score += Math.round((stepCount / MIN_STEPS) * 15);

  // Examples
  const exampleCount = skill.examples?.length ?? 0;
  if (exampleCount >= MIN_EXAMPLES) score += 10;
  else if (exampleCount > 0) score += 5;

  // Tags
  if ((skill.tags?.length ?? 0) >= 2) score += 10;
  else if ((skill.tags?.length ?? 0) > 0) score += 5;

  return Math.min(100, score);
}

// ------------------------------------------------------------------
// scoreReusability
// ------------------------------------------------------------------

export function scoreReusability(skill: SkillContent): number {
  let score = 0;

  // Tags contribute up to 30 points
  const tagCount = skill.tags?.length ?? 0;
  if (tagCount >= 3) score += 30;
  else if (tagCount >= 1) score += Math.round((tagCount / 3) * 30);

  // Parameterization contributes up to 40 points
  const paramCount = Object.keys(skill.parameters ?? {}).length;
  if (paramCount >= 5) score += 40;
  else if (paramCount >= 1) score += Math.round((paramCount / 5) * 40);

  // Steps clarity contributes up to 20 points
  const stepCount = skill.steps?.length ?? 0;
  if (stepCount >= 3 && stepCount <= MAX_STEPS) score += 20;
  else if (stepCount > 0) score += Math.round((stepCount / MAX_STEPS) * 20);

  // Examples contribute up to 10 points
  const exampleCount = skill.examples?.length ?? 0;
  if (exampleCount >= 2) score += 10;
  else if (exampleCount === 1) score += 5;

  return Math.min(100, score);
}

// ------------------------------------------------------------------
// calculateOverallScore
// ------------------------------------------------------------------

export function calculateOverallScore(scores: QualityScores): number {
  const weights = { clarity: 0.35, completeness: 0.40, reusability: 0.25 };
  const overall = (
    scores.clarity * weights.clarity +
    scores.completeness * weights.completeness +
    scores.reusability * weights.reusability
  );
  return Math.round(overall * 10) / 10;
}

// ------------------------------------------------------------------
// Grade computation
// ------------------------------------------------------------------

export function computeGrade(score: number): QualityGrade {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function gradeDescription(grade: QualityGrade): string {
  switch (grade) {
    case 'A+': return 'Exceptional quality, ready for promotion';
    case 'A': return 'High quality, minor improvements possible';
    case 'B': return 'Good quality, some gaps to address';
    case 'C': return 'Adequate quality, notable improvements needed';
    case 'D': return 'Below average quality, significant work required';
    case 'F': return 'Poor quality, major revision needed';
  }
}

// ------------------------------------------------------------------
// Suggestions
// ------------------------------------------------------------------

export function generateSuggestions(
  scores: QualityScores,
  skill: SkillContent,
): string[] {
  const suggestions: string[] = [];

  if (scores.clarity < 70) {
    if (!skill.name || skill.name.length < MIN_NAME_LENGTH) {
      suggestions.push('Improve skill name: use a clear, descriptive name of at least 5 characters');
    }
    if (!skill.description || skill.description.length < MIN_DESCRIPTION_LENGTH) {
      suggestions.push('Expand description: add at least 30 characters explaining the skill\'s purpose and use case');
    }
    if ((skill.code_template ?? '').length < MIN_CODE_LENGTH) {
      suggestions.push('Add more code details to the template for better clarity');
    }
  }

  if (scores.completeness < 70) {
    if ((skill.steps?.length ?? 0) < MIN_STEPS) {
      suggestions.push('Add more execution steps (minimum 2) to fully describe the workflow');
    }
    if ((skill.examples?.length ?? 0) < MIN_EXAMPLES) {
      suggestions.push('Add at least one usage example');
    }
    if (Object.keys(skill.parameters ?? {}).length === 0) {
      suggestions.push('Define parameters so users can customize the skill');
    }
  }

  if (scores.reusability < 70) {
    if ((skill.tags?.length ?? 0) < 2) {
      suggestions.push('Add more tags (minimum 2) to improve discoverability');
    }
    if (Object.keys(skill.parameters ?? {}).length < 3) {
      suggestions.push('Parameterize the skill more to increase reusability');
    }
    if ((skill.steps?.length ?? 0) > MAX_STEPS) {
      suggestions.push('Simplify the skill: reduce steps to improve reusability');
    }
  }

  if (suggestions.length === 0) {
    suggestions.push('Skill quality is excellent; consider submitting for promotion');
  }

  return suggestions;
}
