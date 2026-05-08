/**
 * GDI (Genetic Diversity Index) Scoring Service
 * 
 * Calculates multi-dimensional quality scores for assets based on:
 * - Correctness (30%): Automated testing + verification
 * - Diversity (20%): Tag coverage + content uniqueness
 * - Composability (25%): Tool compatibility + interface standardization
 * - Helpfulness (25%): User feedback + usage metrics
 * 
 * Formula: GDI = 0.3*C + 0.2*D + 0.25*Comp + 0.25*H
 */

import { config } from '../config/index.js';

export interface GDIScore {
  overall: number;
  correctness: number;
  diversity: number;
  composability: number;
  helpfulness: number;
}

export interface AssetContent {
  type: 'gene' | 'capsule';
  name: string;
  description?: string;
  content: {
    dna?: string;
    prompt?: string;
    tools?: string[];
    model?: string;
  };
  tags: string[];
  license?: string;
}

interface ScoringWeights {
  correctness: number;
  diversity: number;
  composability: number;
  helpfulness: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  correctness: 0.3,
  diversity: 0.2,
  composability: 0.25,
  helpfulness: 0.25,
};

export class GDIScoringService {
  private weights: ScoringWeights;
  private apiKey: string;
  private apiUrl: string;

  constructor(weights?: Partial<ScoringWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.apiKey = config.gdi.apiKey;
    this.apiUrl = config.gdi.apiUrl;
  }

  /**
   * Calculate GDI score for an asset
   */
  async calculateScore(asset: AssetContent, existingScores?: Partial<GDIScore>): Promise<GDIScore> {
    // Try external API if configured
    if (this.apiUrl && this.apiKey) {
      try {
        return await this.calculateWithAPI(asset);
      } catch (error) {
        console.warn('GDI API scoring failed, falling back to local scoring:', error);
      }
    }

    // Local scoring calculation
    return this.calculateLocally(asset, existingScores);
  }

  /**
   * Calculate scores using external GDI API
   */
  private async calculateWithAPI(asset: AssetContent): Promise<GDIScore> {
    const response = await fetch(`${this.apiUrl}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        type: asset.type,
        name: asset.name,
        description: asset.description,
        content: asset.content,
        tags: asset.tags,
      }),
    });

    if (!response.ok) {
      throw new Error(`GDI API error: ${response.status}`);
    }

    const data = await response.json() as {
      overall?: number;
      correctness?: number;
      diversity?: number;
      composability?: number;
      helpfulness?: number;
    };
    return {
      overall: data.overall ?? 0,
      correctness: data.correctness ?? 0,
      diversity: data.diversity ?? 0,
      composability: data.composability ?? 0,
      helpfulness: data.helpfulness ?? 0,
    };
  }

  /**
   * Calculate scores locally using heuristic analysis
   */
  private calculateLocally(asset: AssetContent, existingScores?: Partial<GDIScore>): GDIScore {
    const correctness = this.calculateCorrectness(asset);
    const diversity = this.calculateDiversity(asset);
    const composability = this.calculateComposability(asset);
    const helpfulness = existingScores?.helpfulness ?? this.calculateHelpfulness(asset);

    const overall = 
      this.weights.correctness * correctness +
      this.weights.diversity * diversity +
      this.weights.composability * composability +
      this.weights.helpfulness * helpfulness;

    return {
      overall: Math.round(overall * 100) / 100,
      correctness: Math.round(correctness * 100) / 100,
      diversity: Math.round(diversity * 100) / 100,
      composability: Math.round(composability * 100) / 100,
      helpfulness: Math.round(helpfulness * 100) / 100,
    };
  }

  /**
   * Correctness (30%): Quality and safety of the asset
   */
  private calculateCorrectness(asset: AssetContent): number {
    let score = 0.5; // Base score

    // Check for description quality
    if (asset.description && asset.description.length > 50) {
      score += 0.1;
    }

    // Check for proper content structure
    if (asset.type === 'gene' && asset.content.dna) {
      score += 0.15;
      // Check for basic code patterns
      if (/function|class|const|let|return/.test(asset.content.dna)) {
        score += 0.1;
      }
    } else if (asset.type === 'capsule' && asset.content.prompt) {
      score += 0.15;
      // Check for prompt structure
      if (asset.content.prompt.length > 100) {
        score += 0.1;
      }
    }

    // License bonus
    if (asset.license && asset.license !== 'CLOSED') {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Diversity (20%): Tag coverage and uniqueness
   */
  private calculateDiversity(asset: AssetContent): number {
    let score = 0.3; // Base score

    // Tag diversity
    const uniqueTags = new Set(asset.tags.map(t => t.toLowerCase()));
    if (uniqueTags.size >= 3) {
      score += 0.3;
    } else if (uniqueTags.size >= 1) {
      score += uniqueTags.size * 0.1;
    }

    // Tag specificity (avoid generic tags)
    const genericTags = ['ai', 'ml', 'nlp', 'general', 'basic'];
    const specificTags = asset.tags.filter(t => !genericTags.includes(t.toLowerCase()));
    if (specificTags.length > 0) {
      score += Math.min(specificTags.length * 0.05, 0.2);
    }

    // Model diversity for capsules
    if (asset.content.model) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Composability (25%): Tool compatibility and interface standardization
   */
  private calculateComposability(asset: AssetContent): number {
    let score = 0.4; // Base score

    // Tool compatibility
    if (asset.content.tools && asset.content.tools.length > 0) {
      score += 0.25;
      
      // Standard tool interface indicators
      const standardTools = ['http', 'api', 'rest', 'json', 'cli', 'bash'];
      const hasStandard = asset.content.tools.some(t => 
        standardTools.some(s => t.toLowerCase().includes(s))
      );
      if (hasStandard) {
        score += 0.1;
      }
    }

    // Model specification
    if (asset.content.model) {
      score += 0.1;
    }

    // Well-defined content
    const contentSize = (asset.content.dna?.length || 0) + (asset.content.prompt?.length || 0);
    if (contentSize > 200) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Helpfulness (25%): Based on reviews and usage (placeholder for actual metrics)
   */
  private calculateHelpfulness(asset: AssetContent): number {
    let score = 0.6; // Base score

    // Good naming
    if (asset.name.length > 5 && !/[0-9]{4,}/.test(asset.name)) {
      score += 0.1;
    }

    // Good description
    if (asset.description && asset.description.length > 100) {
      score += 0.1;
    }

    // Has tags
    if (asset.tags.length > 0) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Batch score multiple assets
   */
  async batchScore(assets: AssetContent[]): Promise<Map<string, GDIScore>> {
    const results = new Map<string, GDIScore>();
    
    for (const asset of assets) {
      const score = await this.calculateScore(asset);
      results.set(asset.name, score);
    }
    
    return results;
  }

  /**
   * Update existing score based on new reviews/metrics
   */
  recalculateWithMetrics(baseScore: GDIScore, metrics: {
    reviewCount?: number;
    avgRating?: number;
    viewCount?: number;
    callCount?: number;
  }): GDIScore {
    let helpfulness = baseScore.helpfulness;

    if (metrics.avgRating !== undefined) {
      helpfulness = (helpfulness + (metrics.avgRating / 5)) / 2;
    }

    if (metrics.callCount && metrics.callCount > 100) {
      helpfulness = Math.min(helpfulness + 0.1, 1.0);
    }

    const overall = 
      this.weights.correctness * baseScore.correctness +
      this.weights.diversity * baseScore.diversity +
      this.weights.composability * baseScore.composability +
      this.weights.helpfulness * helpfulness;

    return {
      overall: Math.round(overall * 100) / 100,
      correctness: baseScore.correctness,
      diversity: baseScore.diversity,
      composability: baseScore.composability,
      helpfulness: Math.round(helpfulness * 100) / 100,
    };
  }
}

export const gdiScoringService = new GDIScoringService();
