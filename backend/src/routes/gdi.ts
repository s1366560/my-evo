/**
 * GDI (Genetic Diversity Index) Scoring Routes
 * Provides preview and actual scoring for assets
 */

import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation.js';

const router = Router();

// Scoring weights
const WEIGHTS = {
  correctness: 0.30,
  diversity: 0.20,
  composability: 0.25,
  helpfulness: 0.25,
};

// Generic Tags to avoid
const GENERIC_TAGS = ['ai', 'ml', 'nlp', 'general', 'basic', 'simple', 'test'];

// Zod schema for preview request
const previewSchema = z.object({
  type: z.enum(['gene', 'capsule']),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  content: z.object({
    dna: z.string().optional().default(''),
    prompt: z.string().optional().default(''),
    tools: z.array(z.string()).optional().default([]),
    model: z.string().optional().default(''),
  }),
  tags: z.array(z.string()).optional().default([]),
  license: z.string().optional().default('MIT'),
});

/**
 * Calculate correctness score (30% of overall)
 */
function calculateCorrectness(
  type: 'gene' | 'capsule',
  description: string,
  content: { dna?: string; prompt?: string },
  license: string
): number {
  let score = 0.5;

  // Description quality
  if (description && description.length > 50) score += 0.1;

  // Content structure
  if (type === 'gene' && content.dna) {
    score += 0.15;
    if (/function|class|const|let|return|import|export|async|await/.test(content.dna)) {
      score += 0.1;
    }
  } else if (type === 'capsule' && content.prompt) {
    score += 0.15;
    if (content.prompt.length > 100) score += 0.1;
  }

  // License bonus
  if (license && license !== 'CLOSED' && license !== '') score += 0.05;

  return Math.min(score, 1.0);
}

/**
 * Calculate diversity score (20% of overall)
 */
function calculateDiversity(tags: string[]): number {
  let score = 0.3;

  // Tag diversity
  const uniqueTags = new Set(tags.map(t => t.toLowerCase()));
  if (uniqueTags.size >= 3) {
    score += 0.3;
  } else if (uniqueTags.size >= 1) {
    score += uniqueTags.size * 0.1;
  }

  // Tag specificity
  const specificTags = tags.filter(t => !GENERIC_TAGS.includes(t.toLowerCase()));
  if (specificTags.length > 0) {
    score += Math.min(specificTags.length * 0.05, 0.2);
  }

  return Math.min(score, 1.0);
}

/**
 * Calculate composability score (25% of overall)
 */
function calculateComposability(
  content: { dna?: string; prompt?: string; tools?: string[]; model?: string }
): number {
  let score = 0.4;

  // Tool compatibility
  if (content.tools && content.tools.length > 0) {
    score += 0.25;
    const standardTools = ['http', 'api', 'rest', 'json', 'cli', 'bash'];
    const hasStandard = content.tools.some(t =>
      standardTools.some(s => t.toLowerCase().includes(s))
    );
    if (hasStandard) score += 0.1;
  }

  // Model specification
  if (content.model) score += 0.1;

  // Well-defined content
  const contentSize = (content.dna?.length || 0) + (content.prompt?.length || 0);
  if (contentSize > 200) score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * Calculate helpfulness score (25% of overall)
 */
function calculateHelpfulness(
  name: string,
  description: string,
  tags: string[]
): number {
  let score = 0.6;

  // Good naming
  if (name.length > 5 && !/[0-9]{4,}/.test(name)) score += 0.1;

  // Good description
  if (description && description.length > 100) score += 0.1;

  // Has tags
  if (tags.length > 0) score += 0.1;

  return Math.min(score, 1.0);
}

// POST /gdi/preview — Calculate GDI score preview
router.post('/preview', validateBody(previewSchema), async (req, res) => {
  try {
    const data = req.body as z.infer<typeof previewSchema>;

    const correctness = calculateCorrectness(
      data.type,
      data.description || '',
      data.content,
      data.license || 'MIT'
    );

    const diversity = calculateDiversity(data.tags || []);
    const composability = calculateComposability(data.content);
    const helpfulness = calculateHelpfulness(
      data.name,
      data.description || '',
      data.tags || []
    );

    const overall =
      WEIGHTS.correctness * correctness +
      WEIGHTS.diversity * diversity +
      WEIGHTS.composability * composability +
      WEIGHTS.helpfulness * helpfulness;

    res.json({
      overall: Math.round(overall * 100) / 100,
      correctness: Math.round(correctness * 100) / 100,
      diversity: Math.round(diversity * 100) / 100,
      composability: Math.round(composability * 100) / 100,
      helpfulness: Math.round(helpfulness * 100) / 100,
      weights: WEIGHTS,
      tips: generateTips({ correctness, diversity, composability, helpfulness }),
    });
  } catch (err) {
    console.error('POST /gdi/preview error:', err);
    res.status(500).json({ error: 'Failed to calculate GDI score' });
  }
});

/**
 * Generate improvement tips based on low scores
 */
function generateTips(scores: {
  correctness: number;
  diversity: number;
  composability: number;
  helpfulness: number;
}): string[] {
  const tips: string[] = [];

  if (scores.correctness < 0.7) {
    tips.push('Add more detailed content with code patterns (functions, classes, etc.)');
  }
  if (scores.diversity < 0.6) {
    tips.push('Add 3+ specific tags and avoid generic ones like "ai" or "ml"');
  }
  if (scores.composability < 0.6) {
    tips.push('Expand your content to 500+ characters for better composability');
  }
  if (scores.helpfulness < 0.7) {
    tips.push('Write a description over 100 characters for better discoverability');
  }

  return tips;
}

export default router;
