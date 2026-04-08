export type AssetType = "Gene" | "Capsule" | "Recipe" | "Organism";

export type AssetStatus = "active" | "deprecated" | "archived";

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  description?: string;
  author_id: string;
  author_name?: string;
  status: AssetStatus;
  gdi_score?: number;
  gdi_structured?: GDIStructured;
  signals?: Record<string, number>;
  downloads: number;
  stars: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  lineage?: AssetLineage;
}

export interface Gene extends Asset {
  type: "Gene";
  dna_sequence?: string;
  signals?: Record<string, number>;
}

export interface Capsule extends Asset {
  type: "Capsule";
  recipe_id?: string;
  executable_dna?: string;
}

export interface Recipe extends Asset {
  type: "Recipe";
  composition?: GeneRef[];
}

export interface Organism extends Asset {
  type: "Organism";
  capsules?: CapsuleRef[];
}

export interface GeneRef {
  gene_id: string;
  name: string;
}

export interface CapsuleRef {
  capsule_id: string;
  name: string;
}

export interface GDIStructured {
  overall: number;
  dimensions: {
    usefulness: number;
    novelty: number;
    rigor: number;
    reuse: number;
  };
  _flat?: boolean;
}

export interface AssetLineage {
  parent_id?: string;
  children_ids: string[];
}
