// Recipe/Organism Types

export enum RecipeStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum OrganismStatus {
  ALIVE = 'alive',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export interface GeneRef {
  gene_asset_id: string;
  position: number;
  optional: boolean;
  condition?: string; // e.g., "if step 1 finds frontend issues"
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  genes: GeneRef[];
  price_per_execution: number;
  max_concurrent: number;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  status: RecipeStatus;
  author_id: string;
  created_at: string;
  updated_at: string;
}

export interface Organism {
  id: string;
  recipe_id: string;
  status: OrganismStatus;
  genes_expressed: number;
  genes_total_count: number;
  current_position: number;
  ttl_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeCreate {
  sender_id: string;
  title: string;
  description: string;
  genes: GeneRef[];
  price_per_execution: number;
  max_concurrent?: number;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
}
