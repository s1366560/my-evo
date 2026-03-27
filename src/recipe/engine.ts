// Recipe/Organism System - Composable Gene Pipelines and Instance Execution
// Recipe: Gene composition pipeline (Draft → Published → Versioned → Deprecated → Archived)
// Organism: Instantiated execution of a Recipe (PENDING → INITIALIZING → RUNNING → COMPLETED/FAILED/CANCELLED)

import { SubTaskStatus } from '../swarm/types.js';

export enum RecipeState {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  VERSIONED = 'VERSIONED',
  DEPRECATED = 'DEPRECATED',
  ARCHIVED = 'ARCHIVED'
}

export enum OrganismState {
  PENDING = 'PENDING',
  INITIALIZING = 'INITIALIZING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface GeneRef {
  gene_id: string;
  version?: string;
  pinned?: boolean;
}

export interface RecipeConstraint {
  type: 'min_version' | 'max_version' | 'required_signal' | 'forbidden_signal';
  value: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  genes: GeneRef[];           // Ordered list of Gene IDs
  constraints: RecipeConstraint[];
  state: RecipeState;
  version: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  deprecated_at?: string;
  archived_at?: string;
  previous_versions: string[]; // Previous version IDs
  usage_count: number;
}

export interface Checkpoint {
  id: string;
  organism_id: string;
  step: number;
  state: 'success' | 'partial' | 'failed';
  snapshot: Record<string, any>;
  created_at: string;
}

export interface Organism {
  id: string;
  recipe_id: string;
  recipe_version: string;
  state: OrganismState;
  context: Record<string, any>;     // Execution context / input
  current_step: number;
  steps_total: number;
  checkpoints: Checkpoint[];
  result?: any;                     // Final result
  error?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  created_by: string;
}

export interface ExecutionResult {
  organism_id: string;
  state: OrganismState;
  result?: any;
  error?: string;
  steps_executed: number;
  checkpoints_saved: number;
}

export class RecipeEngine {
  private recipes: Map<string, Recipe> = new Map();
  private organisms: Map<string, Organism> = new Map();

  /**
   * Create a new Recipe (in DRAFT state)
   */
  createRecipe(params: {
    id: string;
    title: string;
    description: string;
    genes: GeneRef[];
    constraints?: RecipeConstraint[];
    author_id: string;
  }): Recipe {
    const now = new Date().toISOString();
    const recipe: Recipe = {
      id: params.id,
      title: params.title,
      description: params.description,
      genes: params.genes,
      constraints: params.constraints || [],
      state: RecipeState.DRAFT,
      version: '1.0.0',
      author_id: params.author_id,
      created_at: now,
      updated_at: now,
      previous_versions: [],
      usage_count: 0
    };
    this.recipes.set(params.id, recipe);
    return recipe;
  }

  /**
   * Get a recipe by ID
   */
  getRecipe(recipe_id: string): Recipe | undefined {
    return this.recipes.get(recipe_id);
  }

  /**
   * Update a draft recipe
   */
  updateRecipe(recipe_id: string, updates: Partial<Pick<Recipe, 'title' | 'description' | 'genes' | 'constraints'>>): Recipe | null {
    const recipe = this.recipes.get(recipe_id);
    if (!recipe) return null;
    if (recipe.state !== RecipeState.DRAFT) return null;

    Object.assign(recipe, updates, { updated_at: new Date().toISOString() });
    this.recipes.set(recipe_id, recipe);
    return recipe;
  }

  /**
   * Publish a recipe (DRAFT → PUBLISHED)
   */
  publishRecipe(recipe_id: string): Recipe | null {
    const recipe = this.recipes.get(recipe_id);
    if (!recipe) return null;
    if (recipe.state !== RecipeState.DRAFT) return null;
    if (recipe.genes.length === 0) return null; // Must have at least one gene

    recipe.state = RecipeState.PUBLISHED;
    recipe.published_at = new Date().toISOString();
    recipe.updated_at = recipe.published_at;
    this.recipes.set(recipe_id, recipe);
    return recipe;
  }

  /**
   * Version a recipe (PUBLISHED → VERSIONED)
   */
  versionRecipe(recipe_id: string, new_genes?: GeneRef[], new_constraints?: RecipeConstraint[]): Recipe | null {
    const recipe = this.recipes.get(recipe_id);
    if (!recipe) return null;
    if (recipe.state !== RecipeState.PUBLISHED && recipe.state !== RecipeState.VERSIONED) return null;

    // Archive old version
    recipe.previous_versions.push(`${recipe.id}@${recipe.version}`);
    recipe.state = RecipeState.VERSIONED;
    recipe.deprecated_at = new Date().toISOString();
    recipe.updated_at = recipe.deprecated_at;

    // Create new version
    const [major, minor] = recipe.version.split('.').map(Number);
    const newVersion = `${major}.${minor + 1}.0`;
    const newRecipe: Recipe = {
      ...recipe,
      id: recipe.id,
      version: newVersion,
      state: RecipeState.PUBLISHED,
      genes: new_genes || recipe.genes,
      constraints: new_constraints || recipe.constraints,
      previous_versions: [...recipe.previous_versions],
      published_at: new Date().toISOString(),
      deprecated_at: undefined,
      updated_at: new Date().toISOString()
    };
    newRecipe.previous_versions = recipe.previous_versions; // from the now-old version

    this.recipes.set(recipe.id, newRecipe);
    return newRecipe;
  }

  /**
   * Deprecate a recipe (PUBLISHED/VERSIONED → DEPRECATED)
   */
  deprecateRecipe(recipe_id: string): Recipe | null {
    const recipe = this.recipes.get(recipe_id);
    if (!recipe) return null;
    if (![RecipeState.PUBLISHED, RecipeState.VERSIONED].includes(recipe.state)) return null;

    recipe.state = RecipeState.DEPRECATED;
    recipe.deprecated_at = new Date().toISOString();
    recipe.updated_at = recipe.deprecated_at;
    this.recipes.set(recipe_id, recipe);
    return recipe;
  }

  /**
   * Archive a recipe (any state → ARCHIVED)
   */
  archiveRecipe(recipe_id: string): Recipe | null {
    const recipe = this.recipes.get(recipe_id);
    if (!recipe) return null;

    recipe.state = RecipeState.ARCHIVED;
    recipe.archived_at = new Date().toISOString();
    recipe.updated_at = recipe.archived_at;
    this.recipes.set(recipe_id, recipe);
    return recipe;
  }

  /**
   * Instantiate a Recipe as an Organism
   */
  instantiate(recipe_id: string, organism_id: string, context: Record<string, any>, creator_id: string): Organism | null {
    const recipe = this.recipes.get(recipe_id);
    if (!recipe) return null;
    if (recipe.state === RecipeState.ARCHIVED || recipe.state === RecipeState.DEPRECATED) return null;

    const now = new Date().toISOString();
    const organism: Organism = {
      id: organism_id,
      recipe_id,
      recipe_version: recipe.version,
      state: OrganismState.PENDING,
      context,
      current_step: 0,
      steps_total: recipe.genes.length,
      checkpoints: [],
      created_at: now,
      updated_at: now,
      created_by: creator_id
    };

    // Increment recipe usage
    recipe.usage_count++;
    this.recipes.set(recipe_id, recipe);

    this.organisms.set(organism_id, organism);
    return organism;
  }

  /**
   * Get organism by ID
   */
  getOrganism(organism_id: string): Organism | undefined {
    return this.organisms.get(organism_id);
  }

  /**
   * Transition organism state
   */
  private transitionOrganism(organism_id: string, newState: OrganismState, error?: string): Organism | null {
    const organism = this.organisms.get(organism_id);
    if (!organism) return null;

    const validTransitions: Record<OrganismState, OrganismState[]> = {
      [OrganismState.PENDING]: [OrganismState.INITIALIZING, OrganismState.CANCELLED],
      [OrganismState.INITIALIZING]: [OrganismState.RUNNING, OrganismState.FAILED, OrganismState.CANCELLED],
      [OrganismState.RUNNING]: [OrganismState.COMPLETED, OrganismState.FAILED, OrganismState.CANCELLED],
      [OrganismState.COMPLETED]: [],
      [OrganismState.FAILED]: [],
      [OrganismState.CANCELLED]: []
    };

    if (!validTransitions[organism.state].includes(newState)) {
      return null;
    }

    organism.state = newState;
    organism.updated_at = new Date().toISOString();
    if (newState === OrganismState.COMPLETED || newState === OrganismState.FAILED || newState === OrganismState.CANCELLED) {
      organism.completed_at = organism.updated_at;
    }
    if (error) organism.error = error;

    this.organisms.set(organism_id, organism);
    return organism;
  }

  /**
   * Start organism execution
   */
  startOrganism(organism_id: string): Organism | null {
    return this.transitionOrganism(organism_id, OrganismState.INITIALIZING);
  }

  /**
   * Run organism (advance to next step)
   */
  runStep(organism_id: string, step_result: any): Organism | null {
    const organism = this.organisms.get(organism_id);
    if (!organism) return null;
    if (organism.state !== OrganismState.INITIALIZING && organism.state !== OrganismState.RUNNING) return null;

    if (organism.state === OrganismState.INITIALIZING) {
      this.transitionOrganism(organism_id, OrganismState.RUNNING);
    }

    // Save checkpoint
    const checkpoint: Checkpoint = {
      id: `${organism_id}-cp-${organism.current_step}`,
      organism_id,
      step: organism.current_step,
      state: step_result?.error ? 'partial' : 'success',
      snapshot: step_result || {},
      created_at: new Date().toISOString()
    };
    organism.checkpoints.push(checkpoint);
    organism.current_step++;
    organism.updated_at = new Date().toISOString();

    // Check if complete
    if (organism.current_step >= organism.steps_total) {
      organism.result = step_result;
      this.transitionOrganism(organism_id, OrganismState.COMPLETED);
    } else {
      this.organisms.set(organism_id, organism);
    }

    return organism;
  }

  /**
   * Fail organism at current step
   */
  failOrganism(organism_id: string, error: string): Organism | null {
    const organism = this.organisms.get(organism_id);
    if (!organism) return null;

    // Save failure checkpoint
    const checkpoint: Checkpoint = {
      id: `${organism_id}-cp-${organism.current_step}`,
      organism_id,
      step: organism.current_step,
      state: 'failed',
      snapshot: { error },
      created_at: new Date().toISOString()
    };
    organism.checkpoints.push(checkpoint);
    return this.transitionOrganism(organism_id, OrganismState.FAILED, error);
  }

  /**
   * Cancel organism execution
   */
  cancelOrganism(organism_id: string): Organism | null {
    return this.transitionOrganism(organism_id, OrganismState.CANCELLED);
  }

  /**
   * Rollback organism to a checkpoint
   */
  rollbackToCheckpoint(organism_id: string, checkpoint_id: string): Organism | null {
    const organism = this.organisms.get(organism_id);
    if (!organism) return null;
    if (organism.state !== OrganismState.RUNNING && organism.state !== OrganismState.FAILED) return null;

    const cp = organism.checkpoints.find(c => c.id === checkpoint_id);
    if (!cp) return null;

    // Remove checkpoints after the rollback point
    const cpIndex = organism.checkpoints.indexOf(cp);
    organism.checkpoints = organism.checkpoints.slice(0, cpIndex + 1);
    organism.current_step = cp.step;
    organism.state = OrganismState.RUNNING;
    organism.result = undefined;
    organism.error = undefined;
    organism.updated_at = new Date().toISOString();
    this.organisms.set(organism_id, organism);
    return organism;
  }

  /**
   * Get execution result
   */
  getExecutionResult(organism_id: string): ExecutionResult | null {
    const organism = this.organisms.get(organism_id);
    if (!organism) return null;
    return {
      organism_id,
      state: organism.state,
      result: organism.result,
      error: organism.error,
      steps_executed: organism.current_step,
      checkpoints_saved: organism.checkpoints.length
    };
  }

  /**
   * List published recipes
   */
  listPublishedRecipes(): Recipe[] {
    return Array.from(this.recipes.values()).filter(r => r.state === RecipeState.PUBLISHED);
  }

  /**
   * List organisms by state
   */
  listOrganisms(state?: OrganismState): Organism[] {
    const all = Array.from(this.organisms.values());
    if (state) return all.filter(o => o.state === state);
    return all;
  }
}

export default RecipeEngine;
