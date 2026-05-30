/**
 * GEP (Genome Evolution Protocol) Type Definitions
 * Standard types for gene, capsule, and node registry
 */

// Gene categories per GEP specification
export type GeneCategory = 'repair' | 'optimize' | 'innovate' | 'explore';

// Gene validation result structure
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

// Gene represents an actionable AI capability unit
export interface Gene {
  id: string;
  name: string;
  description: string;
  category: GeneCategory;
  validation: string[];
  strategy: string[];
  capability_profile?: {
    level: number;
    reputation: number;
    avg_confidence?: number;
  };
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Capsule represents a composed solution/expression
export interface Capsule {
  id: string;
  name: string;
  description: string;
  content: string;
  strategy: string[];
  genes?: string[];
  organism_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// GEP Node registry entry
export interface GepNode {
  node_id: string;
  name: string;
  endpoint: string;
  reputation: number;
  capability_profile?: {
    level: number;
    total_published: number;
    total_promoted: number;
    avg_confidence?: number;
  };
  status: 'active' | 'inactive' | 'deprecated';
  last_heartbeat?: string;
  supported_adapters?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Registry record for persistence
export interface GeneRegistryRecord extends Gene {
  node_id: string;
  bundle_id?: string;
}

export interface CapsuleRegistryRecord extends Capsule {
  node_id: string;
  gene_ids: string[];
}

// Adapter interface
export interface Adapter {
  name: string;
  ecosystem: string;
  toGepGene(asset: unknown): Promise<Partial<Gene>>;
  toGepCapsule(asset: unknown): Promise<Partial<Capsule>>;
  fromGepGene(gene: Gene): Promise<unknown>;
  fromGepCapsule(capsule: Capsule): Promise<unknown>;
}

// Request/Response types
export interface RegisterGeneRequest {
  name: string;
  description: string;
  category: GeneCategory;
  validation: string[];
  strategy: string[];
  capability_profile?: Gene['capability_profile'];
  metadata?: Record<string, unknown>;
}

export interface RegisterCapsuleRequest {
  name: string;
  description: string;
  content: string;
  strategy: string[];
  gene_ids?: string[];
  organism_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidateGepRequest {
  type: 'gene' | 'capsule';
  data: Partial<Gene> | Partial<Capsule>;
}

export interface NodeDiscoveryRequest {
  capabilities?: GeneCategory[];
  min_reputation?: number;
  status?: GepNode['status'];
  limit?: number;
}

export interface GepApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: ValidationError[];
  };
  meta?: {
    timestamp: string;
    request_id?: string;
  };
}
