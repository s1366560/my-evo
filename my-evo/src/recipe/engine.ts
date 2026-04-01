// Recipe Engine

import { randomUUID } from 'crypto';
import {
  Recipe,
  RecipeStatus,
  Organism,
  OrganismStatus,
  GeneRef,
  RecipeCreate,
} from './types';

export class RecipeEngine {
  private recipes: Map<string, Recipe> = new Map();
  private organisms: Map<string, Organism> = new Map();

  // Recipe operations
  create(create: RecipeCreate): Recipe {
    const recipe: Recipe = {
      id: `rec_${randomUUID().slice(0, 8)}`,
      title: create.title,
      description: create.description,
      genes: create.genes.sort((a, b) => a.position - b.position),
      price_per_execution: create.price_per_execution,
      max_concurrent: create.max_concurrent || 1,
      input_schema: create.input_schema,
      output_schema: create.output_schema,
      status: RecipeStatus.DRAFT,
      author_id: create.sender_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.recipes.set(recipe.id, recipe);
    return recipe;
  }

  getRecipe(id: string): Recipe | null {
    return this.recipes.get(id) || null;
  }

  listRecipes(status?: RecipeStatus): Recipe[] {
    const all = Array.from(this.recipes.values());
    if (status) {
      return all.filter((r) => r.status === status);
    }
    return all;
  }

  publish(id: string, authorId: string): Recipe | null {
    const recipe = this.recipes.get(id);
    if (!recipe) return null;
    if (recipe.author_id !== authorId) return null;
    recipe.status = RecipeStatus.PUBLISHED;
    recipe.updated_at = new Date().toISOString();
    return recipe;
  }

  archive(id: string, authorId: string): Recipe | null {
    const recipe = this.recipes.get(id);
    if (!recipe) return null;
    if (recipe.author_id !== authorId) return null;
    recipe.status = RecipeStatus.ARCHIVED;
    recipe.updated_at = new Date().toISOString();
    return recipe;
  }

  fork(id: string, authorId: string, changes: Partial<RecipeCreate>): Recipe | null {
    const original = this.recipes.get(id);
    if (!original) return null;

    const forked: Recipe = {
      id: `rec_${randomUUID().slice(0, 8)}`,
      title: changes.title || original.title,
      description: changes.description || original.description,
      genes: changes.genes || original.genes,
      price_per_execution: changes.price_per_execution || original.price_per_execution,
      max_concurrent: changes.max_concurrent || original.max_concurrent,
      input_schema: changes.input_schema || original.input_schema,
      output_schema: changes.output_schema || original.output_schema,
      status: RecipeStatus.DRAFT,
      author_id: authorId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.recipes.set(forked.id, forked);
    return forked;
  }

  // Organism operations
  express(recipeId: string, ttlSeconds: number = 3600): Organism | null {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return null;
    if (recipe.status !== RecipeStatus.PUBLISHED) return null;

    const organism: Organism = {
      id: `org_${randomUUID().slice(0, 8)}`,
      recipe_id: recipeId,
      status: OrganismStatus.ALIVE,
      genes_expressed: 0,
      genes_total_count: recipe.genes.length,
      current_position: 0,
      ttl_seconds: ttlSeconds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.organisms.set(organism.id, organism);
    return organism;
  }

  getOrganism(id: string): Organism | null {
    return this.organisms.get(id) || null;
  }

  expressGene(
    organismId: string,
    geneAssetId: string,
    position: number,
    status: 'success' | 'skipped' | 'failed',
    output?: any
  ): Organism | null {
    const organism = this.organisms.get(organismId);
    if (!organism) return null;
    if (organism.status !== OrganismStatus.ALIVE) return null;

    const recipe = this.recipes.get(organism.recipe_id);
    if (!recipe) return null;

    const geneRef = recipe.genes.find(
      (g) => g.gene_asset_id === geneAssetId && g.position === position
    );
    if (!geneRef) return null;

    organism.genes_expressed += 1;
    organism.current_position = position + 1;
    organism.updated_at = new Date().toISOString();

    // Check if all required genes are done
    const requiredGenes = recipe.genes.filter((g) => !g.optional);
    if (organism.genes_expressed >= requiredGenes.length && status !== 'failed') {
      organism.status = OrganismStatus.COMPLETED;
    } else if (status === 'failed') {
      organism.status = OrganismStatus.FAILED;
    }

    return organism;
  }

  complete(organismId: string): Organism | null {
    const organism = this.organisms.get(organismId);
    if (!organism) return null;
    organism.status = OrganismStatus.COMPLETED;
    organism.updated_at = new Date().toISOString();
    return organism;
  }

  fail(organismId: string): Organism | null {
    const organism = this.organisms.get(organismId);
    if (!organism) return null;
    organism.status = OrganismStatus.FAILED;
    organism.updated_at = new Date().toISOString();
    return organism;
  }

  checkTimeouts(): string[] {
    const now = Date.now();
    const timedOut: string[] = [];

    for (const [id, organism] of this.organisms) {
      if (organism.status !== OrganismStatus.ALIVE) continue;
      const created = new Date(organism.created_at).getTime();
      if (now - created >= organism.ttl_seconds * 1000) {
        organism.status = OrganismStatus.EXPIRED;
        organism.updated_at = new Date().toISOString();
        timedOut.push(id);
      }
    }
    return timedOut;
  }

  // Search recipes by keyword/title/description
  searchRecipes(query: string, limit: number = 20): Recipe[] {
    const q = query.toLowerCase();
    return Array.from(this.recipes.values())
      .filter((r) =>
        r.status === RecipeStatus.PUBLISHED &&
        (r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.genes.some((g) => g.gene_asset_id.toLowerCase().includes(q)))
      )
      .slice(0, limit);
  }

  // List active (alive) organisms
  listActiveOrganisms(): Organism[] {
    return Array.from(this.organisms.values()).filter(
      (o) => o.status === OrganismStatus.ALIVE
    );
  }

  // List organisms by recipe
  listOrganismsByRecipe(recipeId: string): Organism[] {
    return Array.from(this.organisms.values()).filter(
      (o) => o.recipe_id === recipeId
    );
  }
}
