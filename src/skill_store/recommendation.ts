/**
 * Skill Recommendation Engine
 *
 * Provides personalized skill recommendations for users,
 * suggests improvements for existing skills, and identifies complementary skills.
 */

import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { getTopSkills } from './ranking';
import type { RankedSkill } from './ranking';
import { assessQuality, generateSuggestions } from './quality';
import type { SkillContent } from './quality';

let prisma: PrismaClient | null = null;
const DISCOVERABLE_SKILL_STATUSES = ['approved', 'published'];

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Prisma client not set. Call setPrisma() first.');
  }
  return prisma;
}

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface UserProfile {
  nodeId: string;
  downloadedSkillIds: string[];
  authoredSkillIds: string[];
  tags: string[];
  preferredCategories: string[];
}

export interface SkillRecommendation {
  skill: RankedSkill;
  score: number;
  reasons: string[];
}

export interface ImprovementSuggestion {
  category: 'clarity' | 'completeness' | 'reusability';
  priority: 'high' | 'medium' | 'low';
  message: string;
}

export interface ComplementarySkill {
  skill: RankedSkill;
  relationship: 'prerequisite' | 'enhances' | 'alternative' | 'extension';
  strength: number; // 0-1
}

// ------------------------------------------------------------------
// recommendSkills
// ------------------------------------------------------------------

export async function recommendSkills(
  userId: string,
  limit = 10,
): Promise<SkillRecommendation[]> {
  const db = getPrisma();

  // Fetch user profile
  const profile = await buildUserProfile(userId);

  // Fetch candidate skills
  const candidates = await getTopSkills(limit * 3);

  // Score each skill for this user
  const scored: SkillRecommendation[] = candidates
    .filter((skill) => !profile.downloadedSkillIds.includes(skill.skill_id))
    .filter((skill) => !profile.authoredSkillIds.includes(skill.skill_id))
    .map((skill) => {
      const { score, reasons } = scoreSkillForUser(skill, profile);
      return { skill, score, reasons };
    });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

async function buildUserProfile(nodeId: string): Promise<UserProfile> {
  const db = getPrisma();

  // Note: SkillDownload table does not exist in schema.
  // Download history is tracked via SkillRating (user has rated = user interacted).
  const [rated, authored] = await Promise.all([
    db.skillRating.findMany({
      where: { rater_id: nodeId },
      select: { skill_id: true },
    }),
    db.skill.findMany({
      where: { author_id: nodeId },
      select: { skill_id: true, tags: true, category: true },
    }),
  ]);

  const downloadedSkillIds: string[] = [];
  const ratedSkillIds: string[] = rated.map((r: { skill_id: string }) => r.skill_id);
  const authoredSkillIds: string[] = authored.map(
    (s: { skill_id: string; tags: string[]; category: string }) => s.skill_id,
  );

  // Aggregate tags and categories from authored skills
  const tagCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  for (const skill of authored) {
    for (const tag of skill.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    categoryCounts.set(skill.category, (categoryCounts.get(skill.category) ?? 0) + 1);
  }

  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const preferredCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  return {
    nodeId,
    downloadedSkillIds: ratedSkillIds,
    authoredSkillIds,
    tags,
    preferredCategories,
  };
}

function scoreSkillForUser(
  skill: RankedSkill,
  profile: UserProfile,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Composite score from ranking (0-100)
  score += skill.compositeScore * 0.3;

  // Tag overlap with user's preferences (0-30 bonus)
  const tagOverlap = (skill.tags ?? []).filter((t) => profile.tags.includes(t)).length;
  if (tagOverlap > 0) {
    score += Math.min(30, tagOverlap * 10);
    reasons.push(`Matches ${tagOverlap} of your interest tags`);
  }

  // Category preference (0-20 bonus)
  if (profile.preferredCategories.includes(skill.category)) {
    score += 20;
    reasons.push(`In your preferred category: ${skill.category}`);
  }

  // High rating signal (0-20 bonus)
  if (skill.rating >= 4.5) {
    score += 20;
    reasons.push('Highly rated by the community');
  } else if (skill.rating >= 4.0) {
    score += 10;
  }

  // Novelty bonus: skill user hasn't downloaded but is in similar category (0-10)
  const hasSimilar = profile.downloadedSkillIds.some((id) => {
    // This would require fetching more data; keep it simple here
    return false;
  });
  if (!hasSimilar) {
    score += 5;
  }

  return { score: Math.round(score * 100) / 100, reasons };
}

// ------------------------------------------------------------------
// suggestImprovements
// ------------------------------------------------------------------

export function suggestImprovements(skill: SkillContent): ImprovementSuggestion[] {
  const assessment = assessQuality(skill);
  const qualitySuggestions = generateSuggestions(assessment.scores, skill);

  const suggestions: ImprovementSuggestion[] = [];

  // Map quality scores to improvement suggestions
  if (assessment.scores.clarity < 70) {
    suggestions.push({
      category: 'clarity',
      priority: assessment.scores.clarity < 50 ? 'high' : 'medium',
      message: `Clarity score is ${assessment.scores.clarity}/100. ${qualitySuggestions.find((s) => s.includes('name')) ?? 'Improve naming and descriptions.'}`,
    });
  }

  if (assessment.scores.completeness < 70) {
    const completenessSuggestion = qualitySuggestions.find(
      (s) => s.includes('steps') || s.includes('example') || s.includes('parameter'),
    );
    suggestions.push({
      category: 'completeness',
      priority: assessment.scores.completeness < 50 ? 'high' : 'medium',
      message: `Completeness score is ${assessment.scores.completeness}/100. ${completenessSuggestion ?? 'Add more content to improve completeness.'}`,
    });
  }

  if (assessment.scores.reusability < 70) {
    const reusabilitySuggestion = qualitySuggestions.find(
      (s) => s.includes('tag') || s.includes('parameterize') || s.includes('reusability'),
    );
    suggestions.push({
      category: 'reusability',
      priority: assessment.scores.reusability < 50 ? 'high' : 'medium',
      message: `Reusability score is ${assessment.scores.reusability}/100. ${reusabilitySuggestion ?? 'Improve parameterization and tagging.'}`,
    });
  }

  // Priority boosts for specific issues
  if (suggestions.length === 0) {
    suggestions.push({
      category: 'clarity',
      priority: 'low',
      message: 'Skill quality is already high; focus on gathering more user ratings',
    });
  }

  return suggestions;
}

// ------------------------------------------------------------------
// findComplementarySkills
// ------------------------------------------------------------------

export async function findComplementarySkills(
  skillId: string,
  limit = 5,
): Promise<ComplementarySkill[]> {
  const db = getPrisma();

  const skill = await db.skill.findUnique({
    where: { skill_id: skillId },
  });

  if (!skill || skill.deleted_at) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  // Find skills with overlapping tags but different categories (extensions/alternatives)
  const candidates = await db.skill.findMany({
    where: {
      status: { in: DISCOVERABLE_SKILL_STATUSES },
      deleted_at: null,
      skill_id: { not: skillId },
      OR: [
        // Overlapping tags
        { tags: { hasSome: skill.tags ?? [] } },
        // Same category
        { category: skill.category },
      ],
    },
    take: limit * 3,
  });

  const complementary: ComplementarySkill[] = [];

  for (const candidate of candidates) {
    const relationship = determineRelationship(skill, candidate);
    const strength = computeComplementaryStrength(skill, candidate);

    if (strength > 0) {
      complementary.push({ skill: candidate as unknown as RankedSkill, relationship, strength });
    }
  }

  // Sort by strength descending
  complementary.sort((a, b) => b.strength - a.strength);

  return complementary.slice(0, limit);
}

function determineRelationship(
  base: { category: string; tags: string[]; parameters: unknown },
  candidate: { category: string; tags: string[]; parameters: unknown },
): ComplementarySkill['relationship'] {
  const baseTags = new Set(base.tags ?? []);
  const candidateTags = new Set(candidate.tags ?? []);
  const tagOverlap = [...baseTags].filter((t) => candidateTags.has(t)).length;

  if (tagOverlap === 0 && candidate.category !== base.category) {
    return 'alternative';
  }

  if (candidate.category === base.category && tagOverlap > 0) {
    // Check if it's an enhancement (same category, overlapping tags, different params)
    const baseParams = Object.keys(base.parameters as object ?? {});
    const candParams = Object.keys(candidate.parameters as object ?? {});
    const paramDiff = candParams.filter((p) => !baseParams.includes(p)).length;
    if (paramDiff > 0) return 'enhances';
  }

  if (candidate.category !== base.category && tagOverlap >= 2) {
    return 'extension';
  }

  return 'prerequisite';
}

function computeComplementaryStrength(
  base: { tags: string[]; category: string },
  candidate: { tags: string[]; category: string },
): number {
  const baseTags = new Set(base.tags ?? []);
  const candidateTags = new Set(candidate.tags ?? []);
  const tagOverlap = [...baseTags].filter((t) => candidateTags.has(t)).length;

  const tagScore = tagOverlap / Math.max(baseTags.size, candidateTags.size);

  const categoryBonus =
    base.category !== candidate.category && tagOverlap >= 1 ? 0.3 : 0;

  return Math.min(1, tagScore + categoryBonus);
}
