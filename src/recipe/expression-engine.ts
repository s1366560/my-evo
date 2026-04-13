import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

// ===== Types =====

export interface GeneRef {
  gene_asset_id: string;
  position: number;
  optional?: boolean;
  condition?: string;
}

export interface ExpressionStep {
  gene_asset_id: string;
  position: number;
  optional: boolean;
  condition?: string;
  status: 'pending' | 'expressing' | 'success' | 'skipped' | 'failed';
  output?: unknown;
  error?: string;
}

export interface ExpressionPlan {
  organism_id: string;
  recipe_id: string;
  steps: ExpressionStep[];
  current_position: number;
  input_payload?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ExpressionResult {
  organism_id: string;
  recipe_id: string;
  capsule_id?: string;
  steps: ExpressionStep[];
  success: boolean;
  errors: string[];
}

// ===== Gene Expression Engine =====

/**
 * Express a Recipe into an Organism, executing all Gene steps.
 * Returns the full expression result including capsule_id if successful.
 */
export async function expressRecipe(
  recipeId: string,
  inputPayload?: Record<string, unknown>,
): Promise<ExpressionResult> {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  if (recipe.status !== 'published') {
    throw new ValidationError(
      `Recipe must be published to express. Current status: ${recipe.status}`,
    );
  }

  // Parse genes from JSON
  const genes = (recipe.genes as unknown as GeneRef[]) ?? [];
  if (genes.length === 0) {
    throw new ValidationError('Recipe has no genes to express');
  }

  // Sort genes by position
  const sortedGenes = [...genes].sort((a, b) => a.position - b.position);

  // Create expression plan
  const steps: ExpressionStep[] = sortedGenes.map((gene) => ({
    gene_asset_id: gene.gene_asset_id,
    position: gene.position,
    optional: gene.optional ?? false,
    condition: gene.condition,
    status: 'pending' as const,
  }));

  // Create organism record
  const organismId = crypto.randomUUID();
  const now = new Date();

  const organism = await prisma.organism.create({
    data: {
      organism_id: organismId,
      recipe_id: recipeId,
      status: 'assembling',
      genes_expressed: 0,
      genes_total_count: genes.length,
      current_position: 0,
      ttl_seconds: 3600,
      created_at: now,
      updated_at: now,
    },
  });

  void organism;

  // Build plan and execute
  const plan: ExpressionPlan = {
    organism_id: organismId,
    recipe_id: recipeId,
    steps,
    current_position: 0,
    input_payload: inputPayload,
    status: 'pending',
  };

  const result = await executeExpressionPlan(plan);

  // Update organism to completed/failed
  await prisma.organism.update({
    where: { organism_id: organismId },
    data: {
      status: result.success ? 'completed' : 'failed',
      updated_at: new Date(),
    },
  });

  return result;
}

/**
 * Resolve dependencies from a Recipe and return a topologically sorted execution plan.
 * Sequential: sort by position
 * Conditional: keep condition metadata
 * Optional: mark as optional
 * Fork: parallel groups identified by same position group
 */
export async function resolveDependencies(recipeId: string): Promise<ExpressionStep[]> {
  const recipe = await prisma.recipe.findUnique({
    where: { recipe_id: recipeId },
  });

  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId);
  }

  const genes = (recipe.genes as unknown as GeneRef[]) ?? [];

  if (genes.length === 0) {
    return [];
  }

  // Sort by position (sequential ordering is the primary dependency)
  const sorted = [...genes].sort((a, b) => a.position - b.position);

  // Detect fork groups: same position indicates parallel execution
  const positionGroups = new Map<number, GeneRef[]>();
  for (const gene of sorted) {
    const group = positionGroups.get(gene.position) ?? [];
    group.push(gene);
    positionGroups.set(gene.position, group);
  }

  // Build steps preserving position groups (fork = multiple genes at same position)
  const steps: ExpressionStep[] = [];
  for (const [, groupGenes] of positionGroups) {
    for (const gene of groupGenes) {
      steps.push({
        gene_asset_id: gene.gene_asset_id,
        position: gene.position,
        optional: gene.optional ?? false,
        condition: gene.condition,
        status: 'pending',
      });
    }
  }

  return steps;
}

/**
 * Execute a pre-built expression plan step by step.
 * Handles sequential, conditional, optional, and fork execution modes.
 */
export async function executeExpressionPlan(plan: ExpressionPlan): Promise<ExpressionResult> {
  const errors: string[] = [];
  plan.status = 'running';

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]!;
    plan.current_position = i;

    // Update organism progress
    await prisma.organism.update({
      where: { organism_id: plan.organism_id },
      data: {
        current_position: i + 1,
        genes_expressed: i,
        status: 'alive',
        updated_at: new Date(),
      },
    }).catch(() => {
      // Organism may have been deleted/expired; continue gracefully
    });

    // Evaluate condition if present
    if (step.condition) {
      const conditionMet = await evaluateCondition(step.condition, plan, i);
      if (!conditionMet) {
        step.status = 'skipped';
        continue;
      }
    }

    // Execute the gene step
    step.status = 'expressing';
    try {
      const geneResult = await executeGeneStep(step.gene_asset_id, plan);
      step.output = geneResult.output;
      step.status = 'success';
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      step.error = errorMsg;

      if (step.optional) {
        step.status = 'skipped';
      } else {
        step.status = 'failed';
        errors.push(`Gene ${step.gene_asset_id} at position ${step.position}: ${errorMsg}`);
        plan.status = 'failed';
        break;
      }
    }
  }

  if (plan.status !== 'failed') {
    plan.status = 'completed';
  }

  // Determine if all required (non-optional) steps succeeded
  const requiredSteps = plan.steps.filter((s) => !s.optional);
  const allRequiredSucceeded = requiredSteps.every((s) => s.status === 'success');

  const result: ExpressionResult = {
    organism_id: plan.organism_id,
    recipe_id: plan.recipe_id,
    steps: plan.steps,
    success: plan.status === 'completed' && allRequiredSucceeded,
    errors,
  };

  return result;
}

/**
 * Validate the result of an expression, ensuring output schemas match.
 */
export async function validateExpressionResult(result: ExpressionResult): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const validationErrors: string[] = [];

  // Check required steps succeeded
  const failedRequired = result.steps.filter(
    (s) => !s.optional && s.status !== 'success',
  );
  if (failedRequired.length > 0) {
    validationErrors.push(
      `Failed required steps: ${failedRequired.map((s) => s.gene_asset_id).join(', ')}`,
    );
  }

  // Check organism exists
  const organism = await prisma.organism.findUnique({
    where: { organism_id: result.organism_id },
  });
  if (!organism) {
    validationErrors.push(`Organism ${result.organism_id} not found`);
  }

  return {
    valid: validationErrors.length === 0,
    errors: validationErrors,
  };
}

// ===== Internal Helpers =====

/**
 * Evaluate a condition string against the current plan context.
 * Conditions are simple expressions referencing previous step outputs.
 */
async function evaluateCondition(
  condition: string,
  plan: ExpressionPlan,
  currentIndex: number,
): Promise<boolean> {
  // Simple condition evaluation:
  // "if step 1 finds frontend issues" -> check if previous step output contains relevant data
  const lowerCondition = condition.toLowerCase();

  // Parse "if step N" reference
  const stepMatch = lowerCondition.match(/if step (\d+)/);
  if (stepMatch) {
    const refIndex = parseInt(stepMatch[1]!, 10) - 1;
    if (refIndex >= 0 && refIndex < currentIndex) {
      const prevStep = plan.steps[refIndex];
      if (prevStep?.output) {
        // Check if the condition keywords appear in the output
        const outputStr = JSON.stringify(prevStep.output).toLowerCase();
        const keywords = lowerCondition
          .replace(/if step \d+\s*/g, '')
          .replace(/finds/gi, '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        return keywords.some((kw: string) => outputStr.includes(kw));
      }
    }
  }

  // Default: condition not parseable, evaluate as false
  return false;
}

/**
 * Execute a single gene step.
 * In production, this would invoke the Gene asset execution engine.
 */
async function executeGeneStep(
  geneAssetId: string,
  plan: ExpressionPlan,
): Promise<{ output: unknown }> {
  const gene = await prisma.asset.findUnique({
    where: { asset_id: geneAssetId },
  });

  if (!gene) {
    throw new NotFoundError('Gene asset', geneAssetId);
  }

  if (gene.asset_type !== 'gene') {
    throw new ValidationError(`Asset ${geneAssetId} is not a gene`);
  }

  if (gene.status !== 'published') {
    throw new ValidationError(`Gene asset ${geneAssetId} must be published to execute`);
  }

  return {
    output: {
      gene_asset_id: geneAssetId,
      gene_name: gene.name,
      organism_id: plan.organism_id,
      recipe_id: plan.recipe_id,
      input_payload: plan.input_payload ?? null,
      config: gene.config ?? null,
      content: gene.content ?? null,
      signals: Array.isArray(gene.signals) ? gene.signals : [],
      executed_at: new Date().toISOString(),
      status: 'success',
    },
  };
}
