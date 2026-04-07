import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

// ===== Constants =====

const DEFAULT_PRIORITY = 50; // 0-100 scale
const PRIORITY_BOOST_GDI = 10; // bonus per 10 GDI points above baseline
const PRIORITY_BOOST_FREQUENCY = 5; // bonus per 10 executions in last 7 days

// ===== Types =====

export interface PriorityScore {
  recipe_id: string;
  priority: number;
  gdi_score: number;
  execution_frequency: number;
  boosted_priority: number;
}

export interface ScheduledExpression {
  recipe_id: string;
  organism_id: string;
  scheduled_at: Date;
  priority: number;
  status: 'scheduled' | 'running' | 'completed' | 'cancelled';
}

export interface ExecutionFrequency {
  recipe_id: string;
  count_7d: number;
  count_30d: number;
}

// ===== Priority Scheduling =====

/**
 * Calculate priority scores for all recipes based on GDI score and execution frequency.
 * Returns sorted array from highest to lowest priority.
 */
export async function prioritizeExpression(
  limit = 20,
): Promise<PriorityScore[]> {
  // Get all published recipes with their GDI scores
  const recipes = await prisma.recipe.findMany({
    where: { status: 'published' },
    include: {
      organisms: {
        where: {
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
    },
  });

  const scores: PriorityScore[] = [];

  for (const recipe of recipes) {
    const gdiScore = await getRecipeGDIScore(recipe.recipe_id);
    const executionCount = recipe.organisms.length;

    const gdiBoost = Math.floor((gdiScore - 50) / 10) * PRIORITY_BOOST_GDI;
    const frequencyBoost = Math.floor(executionCount / 10) * PRIORITY_BOOST_FREQUENCY;

    const priority = Math.min(100, Math.max(0, DEFAULT_PRIORITY + gdiBoost + frequencyBoost));

    scores.push({
      recipe_id: recipe.recipe_id,
      priority,
      gdi_score: gdiScore,
      execution_frequency: executionCount,
      boosted_priority: priority,
    });
  }

  // Sort by priority descending
  scores.sort((a, b) => b.priority - a.priority);

  return scores.slice(0, limit);
}

/**
 * Schedule a Recipe expression with a specific priority.
 * Higher priority expressions are placed ahead in the queue.
 */
export async function scheduleExpression(
  recipeId: string,
  priority?: number,
): Promise<ScheduledExpression> {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  if (recipe.status !== 'published') {
    throw new NotFoundError('Recipe', recipeId);
  }

  const calculatedPriority = priority ?? DEFAULT_PRIORITY;
  const scheduledAt = new Date();

  // In production, this would insert into a BullMQ queue with priority score
  // For now, create an in-memory scheduling record via organism
  const organismId = crypto.randomUUID();

  const organism = await prisma.organism.create({
    data: {
      organism_id: organismId,
      recipe_id: recipeId,
      status: 'assembling',
      genes_expressed: 0,
      genes_total_count: ((recipe.genes as unknown[]) ?? []).length,
      current_position: 0,
      ttl_seconds: 3600,
      created_at: scheduledAt,
      updated_at: scheduledAt,
    },
  });

  void organism;
  void calculatedPriority;

  return {
    recipe_id: recipeId,
    organism_id: organismId,
    scheduled_at: scheduledAt,
    priority: calculatedPriority,
    status: 'scheduled',
  };
}

/**
 * Get execution frequency for a recipe.
 */
export async function getExecutionFrequency(recipeId: string): Promise<ExecutionFrequency> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [count7d, count30d] = await Promise.all([
    prisma.organism.count({
      where: {
        recipe_id: recipeId,
        created_at: { gte: sevenDaysAgo },
      },
    }),
    prisma.organism.count({
      where: {
        recipe_id: recipeId,
        created_at: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  return {
    recipe_id: recipeId,
    count_7d: count7d,
    count_30d: count30d,
  };
}

/**
 * Get the next scheduled expression based on priority.
 */
export async function getNextScheduled(limit = 10): Promise<ScheduledExpression[]> {
  const organisms = await prisma.organism.findMany({
    where: { status: 'assembling' },
    orderBy: { created_at: 'asc' },
    take: limit,
  });

  // In production: query BullMQ priority queue directly
  return organisms.map((org) => ({
    recipe_id: org.recipe_id,
    organism_id: org.organism_id,
    scheduled_at: org.created_at,
    priority: DEFAULT_PRIORITY,
    status: 'scheduled' as const,
  }));
}

/**
 * Cancel a scheduled expression.
 */
export async function cancelScheduled(organismId: string): Promise<ScheduledExpression> {
  const organism = await prisma.organism.findUnique({
    where: { organism_id: organismId },
  });

  if (!organism) {
    throw new NotFoundError('Organism', organismId);
  }

  if (organism.status !== 'assembling') {
    throw new NotFoundError('Organism', organismId);
  }

  await prisma.organism.update({
    where: { organism_id: organismId },
    data: { status: 'expired' },
  });

  return {
    recipe_id: organism.recipe_id,
    organism_id: organismId,
    scheduled_at: organism.created_at,
    priority: DEFAULT_PRIORITY,
    status: 'cancelled',
  };
}

// ===== Internal Helpers =====

async function getRecipeGDIScore(recipeId: string): Promise<number> {
  try {
    const record = await (prisma as any).gDIScoreRecord.findFirst({
      where: { asset_id: recipeId },
      orderBy: { id: 'desc' },
    });
    return record?.total ?? 50;
  } catch {
    return 50; // default GDI score
  }
}
