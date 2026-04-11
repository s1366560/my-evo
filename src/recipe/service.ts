import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

export interface ListRecipesInput {
  status?: string;
  author?: string;
  limit?: number;
  offset?: number;
}

export async function listRecipes(
  status?: string,
  author?: string,
  limit = 20,
  offset = 0,
) {
  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }
  if (author) {
    where.author_id = author;
  }

  const [items, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.recipe.count({ where }),
  ]);

  return { items, total };
}

export async function getRecipe(recipeId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
    include: { organisms: true },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  return recipe;
}

export async function createRecipe(
  authorId: string,
  title: string,
  description: string,
  genes?: unknown,
  pricePerExecution?: number,
  maxConcurrent?: number,
  inputSchema?: unknown,
  outputSchema?: unknown,
) {
  const recipeId = crypto.randomUUID();
  const now = new Date();

  const recipe = await prisma.recipe.create({
    data: {
      recipe_id: recipeId,
      title,
      description,
      genes: (genes ?? []) as import('@prisma/client').Prisma.InputJsonValue,
      price_per_execution: pricePerExecution ?? 1,
      max_concurrent: maxConcurrent ?? 1,
      input_schema: (inputSchema ?? null) as import('@prisma/client').Prisma.InputJsonValue,
      output_schema: (outputSchema ?? null) as import('@prisma/client').Prisma.InputJsonValue,
      status: 'draft',
      author_id: authorId,
      created_at: now,
      updated_at: now,
    },
  });

  return recipe;
}

export async function updateRecipe(
  recipeId: string,
  authorId: string,
  updates: {
    title?: string;
    description?: string;
    genes?: unknown;
    price_per_execution?: number;
    max_concurrent?: number;
    input_schema?: unknown;
    output_schema?: unknown;
  },
) {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  if (recipe.author_id !== authorId) {
    throw new ForbiddenError('Only the author can update a recipe');
  }

  if (recipe.status !== 'draft') {
    throw new ValidationError('Only draft recipes can be updated');
  }

  const updated = await prisma.recipe.update({
    where: { recipe_id: recipeId },
    data: {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.genes !== undefined ? { genes: updates.genes as import('@prisma/client').Prisma.InputJsonValue } : {}),
      ...(updates.price_per_execution !== undefined ? { price_per_execution: updates.price_per_execution } : {}),
      ...(updates.max_concurrent !== undefined ? { max_concurrent: updates.max_concurrent } : {}),
      ...(updates.input_schema !== undefined ? { input_schema: updates.input_schema as import('@prisma/client').Prisma.InputJsonValue } : {}),
      ...(updates.output_schema !== undefined ? { output_schema: updates.output_schema as import('@prisma/client').Prisma.InputJsonValue } : {}),
      updated_at: new Date(),
    },
  });

  return updated;
}

export async function publishRecipe(recipeId: string, authorId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  if (recipe.author_id !== authorId) {
    throw new ForbiddenError('Only the author can publish a recipe');
  }

  if (recipe.status !== 'draft') {
    throw new ValidationError('Only draft recipes can be published');
  }

  const updated = await prisma.recipe.update({
    where: { recipe_id: recipeId },
    data: {
      status: 'published',
      updated_at: new Date(),
    },
  });

  return updated;
}

export async function archiveRecipe(recipeId: string, authorId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  if (recipe.author_id !== authorId) {
    throw new ForbiddenError('Only the author can archive a recipe');
  }

  if (recipe.status !== 'published' && recipe.status !== 'draft') {
    throw new ValidationError('Only published or draft recipes can be archived');
  }

  return prisma.recipe.update({
    where: { recipe_id: recipeId },
    data: {
      status: 'archived',
      updated_at: new Date(),
    },
  });
}

export async function forkRecipe(recipeId: string, authorId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  const canFork = recipe.status === 'published'
    || (recipe.status === 'draft' && recipe.author_id === authorId);

  if (!canFork) {
    throw new ForbiddenError('Only published recipes or your own drafts can be forked');
  }

  const now = new Date();
  return prisma.recipe.create({
    data: {
      recipe_id: crypto.randomUUID(),
      title: `${recipe.title} (fork)`,
      description: recipe.description,
      genes: recipe.genes as import('@prisma/client').Prisma.InputJsonValue,
      price_per_execution: recipe.price_per_execution,
      max_concurrent: recipe.max_concurrent,
      input_schema: recipe.input_schema as import('@prisma/client').Prisma.InputJsonValue,
      output_schema: recipe.output_schema as import('@prisma/client').Prisma.InputJsonValue,
      status: 'draft',
      author_id: authorId,
      created_at: now,
      updated_at: now,
    },
  });
}

export async function deleteRecipe(recipeId: string, authorId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  if (recipe.author_id !== authorId) {
    throw new ForbiddenError('Only the author can delete a recipe');
  }

  if (recipe.status !== 'draft') {
    throw new ValidationError('Only draft recipes can be deleted');
  }

  await prisma.organism.deleteMany({ where: { recipe_id: recipeId } });
  await prisma.recipe.delete({ where: { recipe_id: recipeId } });
}

export async function listOrganisms(recipeId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  return prisma.organism.findMany({
    where: { recipe_id: recipeId },
    orderBy: { created_at: 'desc' },
  });
}

export async function createOrganism(
  recipeId: string,
  authorId: string,
  geneIds?: string[],
  ttlSeconds?: number,
) {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  if (recipe.author_id !== authorId) {
    throw new ForbiddenError('Only the author can create an organism');
  }

  if (recipe.status !== 'published') {
    throw new ValidationError('Only published recipes can be instantiated');
  }

  const organismId = crypto.randomUUID();
  const now = new Date();
  const genes = (geneIds ?? []) as string[];
  const genesTotalCount = genes.length;

  const organism = await prisma.organism.create({
    data: {
      organism_id: organismId,
      recipe_id: recipeId,
      status: 'assembling',
      genes_expressed: 0,
      genes_total_count: genesTotalCount,
      current_position: 0,
      ttl_seconds: ttlSeconds ?? 3600,
      created_at: now,
      updated_at: now,
    },
  });

  return organism;
}

export async function getOrganism(organismId: string) {
  const organism = await prisma.organism.findUnique({
    where: { organism_id: organismId },
  });

  if (!organism) {
    throw new NotFoundError('Organism', organismId);
  }

  return organism;
}

export async function executeOrganism(
  organismId: string,
  inputs?: unknown,
) {
  const organism = await prisma.organism.findUnique({
    where: { organism_id: organismId },
  });

  if (!organism) {
    throw new NotFoundError('Organism', organismId);
  }

  if (organism.status === 'completed') {
    throw new ValidationError('Organism has already been executed');
  }

  if (organism.status === 'failed') {
    throw new ValidationError('Organism has failed and cannot be executed');
  }

  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: organism.recipe_id },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', organism.recipe_id);
  }

  const now = new Date();
  const genesTotalCount = organism.genes_total_count;
  const genesExpressed = Math.min(
    organism.genes_expressed + 1,
    genesTotalCount,
  );
  const newPosition = organism.current_position + 1;
  const isComplete = genesExpressed >= genesTotalCount;

  const updated = await prisma.organism.update({
    where: { organism_id: organismId },
    data: {
      status: isComplete ? 'completed' : 'running',
      genes_expressed: genesExpressed,
      current_position: newPosition,
      updated_at: now,
    },
  });

  void recipe;
  void inputs;

  return {
    result: {
      organism_id: updated.organism_id,
      recipe_id: updated.recipe_id,
      status: updated.status,
      position: updated.current_position,
      inputs: inputs ?? null,
    },
    genes_expressed: updated.genes_expressed,
    genes_total_count: updated.genes_total_count,
  };
}
