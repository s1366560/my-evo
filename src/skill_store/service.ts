import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import type { Skill, SkillRating } from '@prisma/client';
import { NotFoundError, ValidationError } from '../shared/errors';
import * as ranking from './ranking';
import * as recommendation from './recommendation';
import * as distillation from './distillation';
import * as quality from './quality';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
  ranking.setPrisma(client);
  recommendation.setPrisma(client);
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

// ------------------------------------------------------------------
// List / Get
// ------------------------------------------------------------------

export async function listSkills(
  category?: string,
  tags?: string[],
  search?: string,
  limit = 20,
  offset = 0,
  sort = 'recent',
  prismaClient?: PrismaClient,
): Promise<{ items: Skill[]; total: number }> {
  const client = getPrismaClient(prismaClient);
  const where: Record<string, unknown> = {
    status: 'published',
    deleted_at: null,
  };

  if (category) {
    where.category = category;
  }

  if (tags && tags.length > 0) {
    where.tags = { hasSome: tags };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  let orderBy: Record<string, string> = { updated_at: 'desc' };
  if (sort === 'rating') {
    orderBy = { rating: 'desc' };
  } else if (sort === 'downloads') {
    orderBy = { download_count: 'desc' };
  } else if (sort === 'price_asc') {
    orderBy = { price_credits: 'asc' };
  } else if (sort === 'price_desc') {
    orderBy = { price_credits: 'desc' };
  }

  const [items, total] = await Promise.all([
    client.skill.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    }),
    client.skill.count({ where }),
  ]);

  return { items: items as unknown as Skill[], total };
}

export async function getSkill(skillId: string, prismaClient?: PrismaClient): Promise<Skill | null> {
  const client = getPrismaClient(prismaClient);
  const skill = await client.skill.findUnique({
    where: { skill_id: skillId },
  });

  if (skill && skill.deleted_at) {
    return null;
  }

  return skill as unknown as Skill | null;
}

// ------------------------------------------------------------------
// Create
// ------------------------------------------------------------------

interface CreateSkillData {
  name: string;
  description: string;
  category: string;
  price_credits?: number;
  code_template?: string;
  parameters?: Record<string, unknown>;
  steps?: string[];
  examples?: string[];
  tags?: string[];
  source_capsules?: string[];
}

export async function createSkill(
  authorId: string,
  data: CreateSkillData,
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  if (!data.name || data.name.trim().length === 0) {
    throw new ValidationError('name is required');
  }
  if (!data.description || data.description.trim().length === 0) {
    throw new ValidationError('description is required');
  }
  if (!data.category || data.category.trim().length === 0) {
    throw new ValidationError('category is required');
  }

  const skill = await client.skill.create({
    data: {
      skill_id: crypto.randomUUID(),
      name: data.name.trim(),
      description: data.description.trim(),
      category: data.category.trim(),
      author_id: authorId,
      status: 'pending',
      price_credits: data.price_credits ?? 5,
      code_template: data.code_template ?? null,
      parameters: (data.parameters as unknown as Prisma.InputJsonValue) ?? null,
      steps: data.steps ?? [],
      examples: data.examples ?? [],
      tags: data.tags ?? [],
      source_capsules: data.source_capsules ?? [],
    },
  });

  return skill as unknown as Skill;
}

// ------------------------------------------------------------------
// Update
// ------------------------------------------------------------------

interface UpdateSkillData {
  name?: string;
  description?: string;
  category?: string;
  price_credits?: number;
  code_template?: string | null;
  parameters?: Record<string, unknown> | null;
  steps?: string[];
  examples?: string[];
  tags?: string[];
  source_capsules?: string[];
}

function buildSkillUpdateData(updates: UpdateSkillData): Prisma.SkillUpdateInput {
  const data: Prisma.SkillUpdateInput = {};

  if (updates.name !== undefined) {
    data.name = updates.name.trim();
  }
  if (updates.description !== undefined) {
    data.description = updates.description.trim();
  }
  if (updates.category !== undefined) {
    const category = updates.category.trim();
    if (!category) {
      throw new ValidationError('category is required');
    }
    data.category = category;
  }
  if (updates.price_credits !== undefined) {
    if (!Number.isInteger(updates.price_credits) || updates.price_credits < 0) {
      throw new ValidationError('price_credits must be a non-negative integer');
    }
    data.price_credits = updates.price_credits;
  }
  if (updates.code_template !== undefined) {
    data.code_template = updates.code_template;
  }
  if (updates.parameters !== undefined) {
    data.parameters = updates.parameters as unknown as Prisma.InputJsonValue;
  }
  if (updates.steps !== undefined) {
    data.steps = updates.steps;
  }
  if (updates.examples !== undefined) {
    data.examples = updates.examples;
  }
  if (updates.tags !== undefined) {
    data.tags = updates.tags;
  }
  if (updates.source_capsules !== undefined) {
    data.source_capsules = updates.source_capsules;
  }

  return data;
}

export async function updateSkill(
  skillId: string,
  authorId: string,
  updates: UpdateSkillData,
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.deleted_at) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.author_id !== authorId) {
    throw new ValidationError('You can only update your own skills');
  }

  const updated = await client.skill.update({
    where: { skill_id: skillId },
    data: buildSkillUpdateData(updates),
  });

  return updated as unknown as Skill;
}

// ------------------------------------------------------------------
// Delete (soft)
// ------------------------------------------------------------------

export async function deleteSkill(
  skillId: string,
  authorId: string,
  prismaClient?: PrismaClient,
): Promise<void> {
  const client = getPrismaClient(prismaClient);
  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.deleted_at) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.author_id !== authorId) {
    throw new ValidationError('You can only delete your own skills');
  }

  await client.skill.update({
    where: { skill_id: skillId },
    data: { deleted_at: new Date() },
  });
}

// ------------------------------------------------------------------
// Publish
// ------------------------------------------------------------------

export async function publishSkill(
  skillId: string,
  authorId: string,
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.deleted_at) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.author_id !== authorId) {
    throw new ValidationError('You can only publish your own skills');
  }

  if (skill.status === 'published') {
    throw new ValidationError('Skill is already published');
  }

  const updated = await client.skill.update({
    where: { skill_id: skillId },
    data: { status: 'published' },
  });

  return updated as unknown as Skill;
}

export async function publishSkillWithUpdates(
  skillId: string,
  authorId: string,
  updates: UpdateSkillData = {},
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  const updateData = buildSkillUpdateData(updates);

  const published = await client.$transaction(async (tx) => {
    const skill = await tx.skill.findUnique({ where: { skill_id: skillId } });

    if (!skill) {
      throw new NotFoundError('Skill', skillId);
    }

    if (skill.deleted_at) {
      throw new NotFoundError('Skill', skillId);
    }

    if (skill.author_id !== authorId) {
      throw new ValidationError('You can only publish your own skills');
    }

    if (skill.status === 'published') {
      throw new ValidationError('Skill is already published');
    }

    return tx.skill.update({
      where: { skill_id: skillId },
      data: {
        ...updateData,
        status: 'published',
      },
    });
  });

  return published as unknown as Skill;
}

// ------------------------------------------------------------------
// Rate
// ------------------------------------------------------------------

export async function rateSkill(
  skillId: string,
  raterId: string,
  rating: number,
  prismaClient?: PrismaClient,
): Promise<SkillRating> {
  const client = getPrismaClient(prismaClient);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError('rating must be an integer between 1 and 5');
  }

  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });
  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }
  if (skill.deleted_at) {
    throw new NotFoundError('Skill', skillId);
  }

  // Upsert rating
  const skillRating = await client.skillRating.upsert({
    where: { skill_id_rater_id: { skill_id: skillId, rater_id: raterId } },
    update: { rating },
    create: { skill_id: skillId, rater_id: raterId, rating },
  });

  // Recalculate aggregate rating
  const agg = await client.skillRating.aggregate({
    where: { skill_id: skillId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await client.skill.update({
    where: { skill_id: skillId },
    data: {
      rating: agg._avg.rating ?? 0,
      rating_count: agg._count.rating,
    },
  });

  return skillRating as unknown as SkillRating;
}

// ------------------------------------------------------------------
// Download
// ------------------------------------------------------------------

export async function downloadSkill(
  skillId: string,
  nodeId: string,
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.deleted_at) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.status !== 'published') {
    throw new ValidationError('Only published skills can be downloaded');
  }

  const updated = await client.skill.update({
    where: { skill_id: skillId },
    data: { download_count: { increment: 1 } },
  });

  return updated as unknown as Skill;
}

// ------------------------------------------------------------------
// Categories
// ------------------------------------------------------------------

export async function getCategories(prismaClient?: PrismaClient): Promise<Array<{ category: string; count: number }>> {
  const client = getPrismaClient(prismaClient);
  const result = await client.skill.groupBy({
    by: ['category'],
    where: { status: 'published', deleted_at: null },
    _count: { category: true },
    orderBy: { _count: { category: 'desc' } },
  });

  return result.map((r) => ({
    category: r.category,
    count: r._count.category,
  }));
}

// ------------------------------------------------------------------
// Featured
// ------------------------------------------------------------------

export async function getFeaturedSkills(limit = 10, prismaClient?: PrismaClient): Promise<Skill[]> {
  const client = getPrismaClient(prismaClient);
  const skills = await client.skill.findMany({
    where: { status: 'published', deleted_at: null },
    orderBy: [{ rating: 'desc' }, { download_count: 'desc' }],
    take: limit,
  });

  return skills as unknown as Skill[];
}

// ------------------------------------------------------------------
// Integrated Distillation, Ranking, Recommendation, Quality
// ------------------------------------------------------------------

// --- Distillation ---

export async function distillFromCapsules(
  nodeId: string,
  capsules: distillation.SuccessfulPractice[],
  cooldownAfter?: number,
  prismaClient?: PrismaClient,
): Promise<distillation.DistillationResult> {
  return distillation.extractSkill({ nodeId, capsules, cooldownAfter }, prismaClient);
}

export function checkDistillationEligibility(
  capsules: distillation.SuccessfulPractice[],
  cooldownAfter?: number,
): distillation.ExtractionMetrics {
  return distillation.canDistill({ nodeId: '', capsules, cooldownAfter });
}

export function validateSkillContent(
  skill: Parameters<typeof distillation.validateDistilledSkill>[0],
): distillation.ValidationResult {
  return distillation.validateDistilledSkill(skill);
}

// --- Ranking ---

export async function rankSkillsByCategory(
  category?: string,
  limit = 20,
  offset = 0,
): Promise<{ items: ranking.RankedSkill[]; total: number }> {
  return ranking.rankSkills(category, limit, offset);
}

export async function calculateCompositeSkillScore(skillId: string): Promise<number> {
  return ranking.calculateSkillScore(skillId);
}

export async function getTopRankedSkills(
  limit = 10,
  category?: string,
): Promise<ranking.RankedSkill[]> {
  return ranking.getTopSkills(limit, category);
}

export async function compareTwoSkills(
  skillIdA: string,
  skillIdB: string,
): Promise<ranking.SkillComparison> {
  return ranking.compareSkills(skillIdA, skillIdB);
}

// --- Recommendation ---

export async function getRecommendedSkills(
  userId: string,
  limit = 10,
): Promise<recommendation.SkillRecommendation[]> {
  return recommendation.recommendSkills(userId, limit);
}

export function getSkillImprovements(
  skill: Parameters<typeof recommendation.suggestImprovements>[0],
): recommendation.ImprovementSuggestion[] {
  return recommendation.suggestImprovements(skill);
}

export async function getComplementarySkills(
  skillId: string,
  limit = 5,
): Promise<recommendation.ComplementarySkill[]> {
  return recommendation.findComplementarySkills(skillId, limit);
}

// --- Quality ---

export function assessSkillQuality(
  skill: quality.SkillContent,
): quality.QualityAssessment {
  return quality.assessQuality(skill);
}

export function gradeFromScore(score: number): quality.QualityGrade {
  return quality.computeGrade(score);
}

// ------------------------------------------------------------------
// Restore (soft-delete recovery)
// ------------------------------------------------------------------

export async function restoreSkill(
  skillId: string,
  authorId: string,
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }

  if (!skill.deleted_at) {
    throw new ValidationError('Skill is not deleted');
  }

  if (skill.author_id !== authorId) {
    throw new ValidationError('You can only restore your own skills');
  }

  const updated = await client.skill.update({
    where: { skill_id: skillId },
    data: { deleted_at: null, status: 'published' },
  });

  return updated as unknown as Skill;
}

// ------------------------------------------------------------------
// My Skills
// ------------------------------------------------------------------

export async function getMySkills(
  authorId: string,
  limit = 20,
  offset = 0,
  prismaClient?: PrismaClient,
): Promise<{ items: Skill[]; total: number }> {
  const client = getPrismaClient(prismaClient);
  const [items, total] = await Promise.all([
    client.skill.findMany({
      where: { author_id: authorId, deleted_at: null },
      orderBy: { updated_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    client.skill.count({ where: { author_id: authorId, deleted_at: null } }),
  ]);

  return { items: items as unknown as Skill[], total };
}
