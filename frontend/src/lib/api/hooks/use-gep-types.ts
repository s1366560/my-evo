/**
 * GEP Hook Types
 * Response and request types for GEP publish API hooks
 */

// ── Core GEP Types (defined locally — backend src/gep/types.ts not bundled in frontend) ─

export type GeneCategory = 'repair' | 'optimize' | 'innovate' | 'explore';

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

export interface Capsule {
  id: string;
  name: string;
  description: string;
  gene_ids: string[];
  strategy: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GepNode {
  node_id: string;
  node_name: string;
  status: 'active' | 'inactive' | 'deprecated';
  capabilities: GeneCategory[];
  reputation: number;
  total_genes: number;
  total_capsules: number;
  registered_at: string;
  last_heartbeat?: string;
}

export interface RegisterGeneRequest {
  name: string;
  description: string;
  category: GeneCategory;
  validation?: string[];
  strategy?: string[];
  signals?: string[];
}

export interface RegisterCapsuleRequest {
  name: string;
  description: string;
  gene_ids?: string[];
  strategy?: string[];
  signals?: string[];
}

// ── Generic API Response wrapper ────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string; code: string }>;
  };
  meta?: { timestamp: string; request_id?: string };
}

// ── Gene Response ─────────────────────────────────────────────────────────────

export interface GeneResponse extends Gene {
  id: string;
  node_id: string;
  bundle_id?: string;
}

export interface GepPublishGeneResponse {
  success: boolean;
  data?: GeneResponse;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string; code: string }>;
  };
  meta?: { timestamp: string; request_id?: string };
}

// ── Capsule Response ───────────────────────────────────────────────────────────

export interface CapsuleResponse extends Capsule {
  id: string;
  node_id: string;
  asset_id?: string;
  gene_ids: string[];
}

export interface GepPublishCapsuleResponse {
  success: boolean;
  data?: CapsuleResponse;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string; code: string }>;
  };
  meta?: { timestamp: string; request_id?: string };
}

// ── Node Responses ─────────────────────────────────────────────────────────────

export interface GepNodesResponse {
  success: boolean;
  data?: GepNode[];
  error?: { code: string; message: string };
  meta?: { timestamp: string; request_id?: string };
}

export interface GepNodeResponse {
  success: boolean;
  data?: GepNode;
  error?: { code: string; message: string };
  meta?: { timestamp: string; request_id?: string };
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface GepValidationRequest {
  type: "gene" | "capsule";
  data: Partial<RegisterGeneRequest> | Partial<RegisterCapsuleRequest>;
}

export interface GepValidationResponse {
  success: boolean;
  data?: ValidationResult;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string; code: string }>;
  };
  meta?: { timestamp: string; request_id?: string };
}

// ── Query Params ──────────────────────────────────────────────────────────────

export interface GepGenesParams {
  node_id?: string;
  category?: GeneCategory;
}

export interface GepNodesParams {
  capabilities?: GeneCategory[];
  min_reputation?: number;
  status?: "active" | "inactive" | "deprecated";
  limit?: number;
}
