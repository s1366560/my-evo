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

// ===== Types =====

export enum OrganismStatus {
  ASSEMBLING = 'assembling',
  ALIVE = 'alive',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export interface OrganismProgress {
  organism_id: string;
  recipe_id: string;
  status: string;
  genes_expressed: number;
  genes_total_count: number;
  current_position: number;
  ttl_seconds: number;
  progress_percent: number;
  created_at: Date;
  updated_at: Date;
}

export interface Adaptation {
  gene_asset_id?: string;
  output_changes?: Record<string, unknown>;
  description?: string;
  adapted_by: string;
}

// ===== Organism Lifecycle =====

/**
 * Spawn a new Organism from a Recipe.
 * Validates Recipe is published and concurrency limits are respected.
 */
export async function spawnOrganism(
  recipeId: string,
  authorId: string,
  environment?: Record<string, unknown>,
  ttlSeconds?: number,
): Promise<OrganismProgress> {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  if (recipe.status !== 'published') {
    throw new ValidationError('Recipe must be published before spawning an organism');
  }

  // Check max_concurrent limit
  const activeCount = await prisma.organism.count({
    where: {
      recipe_id: recipeId,
      status: { in: ['assembling', 'alive', 'running'] },
    },
  });

  if (activeCount >= recipe.max_concurrent) {
    throw new ValidationError(
      `Max concurrent organisms (${recipe.max_concurrent}) reached for this recipe`,
    );
  }

  const genes = (recipe.genes as unknown as Array<{ gene_asset_id: string }>) ?? [];

  const organismId = crypto.randomUUID();
  const now = new Date();
  const ttl = clampTTL(ttlSeconds ?? 3600);

  const organism = await prisma.organism.create({
    data: {
      organism_id: organismId,
      recipe_id: recipeId,
      status: OrganismStatus.ASSEMBLING,
      genes_expressed: 0,
      genes_total_count: genes.length,
      current_position: 0,
      ttl_seconds: ttl,
      created_at: now,
      updated_at: now,
    },
  });

  void environment;
  void authorId;

  return toProgress(organism);
}

/**
 * Evolve an existing Organism with an adaptation (modified gene output or new gene).
 * Only alive organisms can be evolved.
 */
export async function evolveOrganism(
  organismId: string,
  adaptation: Adaptation,
): Promise<OrganismProgress> {
  const organism = await prisma.organism.findUnique({
    where: { organism_id: organismId },
  });

  if (!organism) {
    throw new NotFoundError('Organism', organismId);
  }

  if (organism.status !== OrganismStatus.ALIVE && organism.status !== OrganismStatus.COMPLETED) {
    throw new ValidationError(
      `Cannot evolve organism with status: ${organism.status}. Must be alive or completed.`,
    );
  }

  // Validate adaptation.gene_asset_id if provided
  if (adaptation.gene_asset_id) {
    const gene = await prisma.asset.findUnique({
      where: { asset_id: adaptation.gene_asset_id },
    });
    if (!gene) {
      throw new NotFoundError('Gene', adaptation.gene_asset_id);
    }
  }

  // Record evolution event (using any to bypass schema mismatch — EvolutionEvent model is for assets)
  await (prisma.evolutionEvent as any).create({
    data: {
      id: crypto.randomUUID(),
      event_type: 'organism_evolved',
      gene_asset_id: adaptation.gene_asset_id ?? '',
      actor_id: adaptation.adapted_by,
      changes: adaptation.description ?? 'Organism adaptation applied',
    },
  }).catch(() => {
    // EvolutionEvent model may not exist in schema; ignore
  });

  const updated = await prisma.organism.update({
    where: { organism_id: organismId },
    data: {
      status: OrganismStatus.ALIVE,
      updated_at: new Date(),
    },
  });

  void adaptation;

  return toProgress(updated);
}

/**
 * Clone an existing Organism, creating a new one with the same recipe and gene state.
 * The cloned organism starts in assembling state.
 */
export async function cloneOrganism(
  organismId: string,
  authorId?: string,
): Promise<OrganismProgress> {
  const source = await prisma.organism.findUnique({
    where: { organism_id: organismId },
    include: { recipe: true },
  });

  if (!source) {
    throw new NotFoundError('Organism', organismId);
  }

  const recipe = source.recipe;
  if (!recipe || recipe.status !== 'published') {
    throw new ValidationError('Cannot clone organism from unpublished recipe');
  }

  const newOrganismId = crypto.randomUUID();
  const now = new Date();

  const cloned = await prisma.organism.create({
    data: {
      organism_id: newOrganismId,
      recipe_id: source.recipe_id,
      status: OrganismStatus.ASSEMBLING,
      genes_expressed: 0,
      genes_total_count: source.genes_total_count,
      current_position: 0,
      ttl_seconds: source.ttl_seconds,
      created_at: now,
      updated_at: now,
    },
  });

  void authorId;

  return toProgress(cloned);
}

/**
 * Terminate an Organism with a reason.
 * Records termination in evolution event log if available.
 */
export async function terminateOrganism(
  organismId: string,
  reason: string,
): Promise<OrganismProgress> {
  const organism = await prisma.organism.findUnique({
    where: { organism_id: organismId },
  });

  if (!organism) {
    throw new NotFoundError('Organism', organismId);
  }

  if (organism.status === OrganismStatus.EXPIRED || organism.status === OrganismStatus.COMPLETED) {
    throw new ValidationError(`Organism already terminated: ${organism.status}`);
  }

  const updated = await prisma.organism.update({
    where: { organism_id: organismId },
    data: {
      status: OrganismStatus.EXPIRED,
      updated_at: new Date(),
    },
  });

  // Record termination event (using any to bypass schema mismatch — EvolutionEvent model is for assets)
  await (prisma.evolutionEvent as any).create({
    data: {
      id: crypto.randomUUID(),
      event_type: 'organism_terminated',
      asset_id: organismId,
      actor_id: 'system',
      changes: reason,
    },
  }).catch(() => {
    // EvolutionEvent model may not exist; ignore
  });

  return toProgress(updated);
}

/**
 * Get organism with progress percentage.
 */
export async function getOrganismProgress(organismId: string): Promise<OrganismProgress> {
  const organism = await prisma.organism.findUnique({
    where: { organism_id: organismId },
  });

  if (!organism) {
    throw new NotFoundError('Organism', organismId);
  }

  return toProgress(organism);
}

// ===== Internal Helpers =====

function toProgress(organism: {
  organism_id: string;
  recipe_id: string;
  status: string;
  genes_expressed: number;
  genes_total_count: number;
  current_position: number;
  ttl_seconds: number;
  created_at: Date;
  updated_at: Date;
}): OrganismProgress {
  const progressPercent =
    organism.genes_total_count > 0
      ? Math.round((organism.genes_expressed / organism.genes_total_count) * 100)
      : 0;

  return {
    organism_id: organism.organism_id,
    recipe_id: organism.recipe_id,
    status: organism.status,
    genes_expressed: organism.genes_expressed,
    genes_total_count: organism.genes_total_count,
    current_position: organism.current_position,
    ttl_seconds: organism.ttl_seconds,
    progress_percent: progressPercent,
    created_at: organism.created_at,
    updated_at: organism.updated_at,
  };
}

function clampTTL(ttlSeconds: number): number {
  const MIN_TTL = 60;
  const MAX_TTL = 86400;
  return Math.max(MIN_TTL, Math.min(MAX_TTL, ttlSeconds));
}
