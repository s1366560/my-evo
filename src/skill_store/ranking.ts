/**
 * Skill Ranking & Scoring
 *
 * Ranks skills by category, calculates composite scores, and compares skills.
 */

import type { Skill, Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

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

export interface SkillScoreComponents {
  qualityScore: number;
  popularityScore: number;
  recencyScore: number;
  ratingScore: number;
}

export interface RankedSkill extends Skill {
  compositeScore: number;
  components: SkillScoreComponents;
}

export interface SkillComparison {
  skillA: string;
  skillB: string;
  scoresA: SkillScoreComponents;
  scoresB: SkillScoreComponents;
  winner: 'A' | 'B' | 'tie';
  reasoning: string;
}

const POPULARITY_WEIGHT = 0.25;
const RECENCY_WEIGHT = 0.20;
const RATING_WEIGHT = 0.35;
const QUALITY_WEIGHT = 0.20;

// ------------------------------------------------------------------
// rankSkills
// ------------------------------------------------------------------

export async function rankSkills(
  category?: string,
  limit = 20,
  offset = 0,
): Promise<{ items: RankedSkill[]; total: number }> {
  const db = getPrisma();

  const where: Prisma.SkillWhereInput = {
    status: { in: DISCOVERABLE_SKILL_STATUSES },
    deleted_at: null,
    ...(category ? { category } : {}),
  };

  const [skills, total] = await Promise.all([
    db.skill.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.skill.count({ where }),
  ]);

  const ranked = await Promise.all(
    skills.map(async (skill) => {
      const compositeScore = await calculateSkillScore(skill.skill_id);
      const components = await getSkillScoreComponents(skill);
      return { ...skill, compositeScore, components };
    }),
  );

  // Sort by composite score descending
  ranked.sort((a, b) => b.compositeScore - a.compositeScore);

  return { items: ranked as unknown as RankedSkill[], total };
}

// ------------------------------------------------------------------
// calculateSkillScore
// ------------------------------------------------------------------

export async function calculateSkillScore(skillId: string): Promise<number> {
  const db = getPrisma();
  const skill = await db.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill || skill.deleted_at) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  const components = await getSkillScoreComponents(skill);

  const composite =
    components.qualityScore * QUALITY_WEIGHT +
    components.popularityScore * POPULARITY_WEIGHT +
    components.recencyScore * RECENCY_WEIGHT +
    components.ratingScore * RATING_WEIGHT;

  return Math.round(composite * 100) / 100;
}

export async function getSkillScoreComponents(
  skill: { updated_at: Date; rating: number; download_count: number; rating_count: number },
): Promise<SkillScoreComponents> {
  const now = Date.now();
  const ageMs = now - new Date(skill.updated_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Quality score from rating (0-100)
  const ratingScore = (skill.rating / 5) * 100;

  // Popularity: downloads vs benchmark (0-100)
  // Benchmark: median skill has ~50 downloads
  const popularityScore = Math.min(100, (skill.download_count / 50) * 100);

  // Recency: exponential decay over 90 days (0-100)
  const recencyScore = Math.max(0, 100 * Math.exp(-ageDays / 90));

  // Quality score: use rating_count as a quality signal
  // More ratings = more confidence in the rating
  const confidenceFactor = Math.min(1, skill.rating_count / 10);
  const qualityScore = (skill.rating * confidenceFactor) * 20;

  return {
    qualityScore: Math.round(Math.min(100, qualityScore)),
    popularityScore: Math.round(popularityScore),
    recencyScore: Math.round(recencyScore),
    ratingScore: Math.round(ratingScore),
  };
}

// ------------------------------------------------------------------
// getTopSkills
// ------------------------------------------------------------------

export async function getTopSkills(
  limit = 10,
  category?: string,
): Promise<RankedSkill[]> {
  const { items } = await rankSkills(category, limit, 0);
  return items.slice(0, limit);
}

// ------------------------------------------------------------------
// compareSkills
// ------------------------------------------------------------------

export async function compareSkills(
  skillIdA: string,
  skillIdB: string,
): Promise<SkillComparison> {
  const db = getPrisma();

  const [skillA, skillB] = await Promise.all([
    db.skill.findUnique({ where: { skill_id: skillIdA } }),
    db.skill.findUnique({ where: { skill_id: skillIdB } }),
  ]);

  if (!skillA || skillA.deleted_at) {
    throw new Error(`Skill not found: ${skillIdA}`);
  }
  if (!skillB || skillB.deleted_at) {
    throw new Error(`Skill not found: ${skillIdB}`);
  }

  const [scoresA, scoresB] = await Promise.all([
    getSkillScoreComponents(skillA),
    getSkillScoreComponents(skillB),
  ]);

  const scoreA =
    scoresA.qualityScore * QUALITY_WEIGHT +
    scoresA.popularityScore * POPULARITY_WEIGHT +
    scoresA.recencyScore * RECENCY_WEIGHT +
    scoresA.ratingScore * RATING_WEIGHT;

  const scoreB =
    scoresB.qualityScore * QUALITY_WEIGHT +
    scoresB.popularityScore * POPULARITY_WEIGHT +
    scoresB.recencyScore * RECENCY_WEIGHT +
    scoresB.ratingScore * RATING_WEIGHT;

  const reasoning = buildComparisonReasoning(scoresA, scoresB, skillA, skillB);

  return {
    skillA: skillIdA,
    skillB: skillIdB,
    scoresA,
    scoresB,
    winner: Math.abs(scoreA - scoreB) < 0.01 ? 'tie' : scoreA > scoreB ? 'A' : 'B',
    reasoning,
  };
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

function buildComparisonReasoning(
  a: SkillScoreComponents,
  b: SkillScoreComponents,
  skillA: Skill,
  skillB: Skill,
): string {
  const parts: string[] = [];

  if (a.ratingScore !== b.ratingScore) {
    const better = a.ratingScore > b.ratingScore ? skillA.name : skillB.name;
    parts.push(`${better} has higher user rating (${Math.max(a.ratingScore, b.ratingScore).toFixed(0)}/100)`);
  }

  if (a.popularityScore !== b.popularityScore) {
    const better = a.popularityScore > b.popularityScore ? skillA.name : skillB.name;
    parts.push(`${better} has more downloads`);
  }

  if (a.recencyScore !== b.recencyScore) {
    const better = a.recencyScore > b.recencyScore ? skillA.name : skillB.name;
    parts.push(`${better} was updated more recently`);
  }

  if (a.qualityScore !== b.qualityScore) {
    const better = a.qualityScore > b.qualityScore ? skillA.name : skillB.name;
    parts.push(`${better} has better quality signals`);
  }

  if (parts.length === 0) {
    parts.push('Both skills are comparable across all dimensions');
  }

  return parts.join('. ') + '.';
}
