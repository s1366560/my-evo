/**
 * Assets Module Types
 * Asset publishing and management types
 */

export type AssetType = 'capsule' | 'gene' | 'workflow' | 'template' | 'skill';

export type AssetStatus = 'draft' | 'published' | 'archived' | 'quarantined';

export interface Asset {
  id: string;
  asset_id: string;
  asset_type: string;
  name: string;
  description: string;
  content: string | null;
  signals: string[];
  tags: string[];
  author_id: string;
  status: string;
  gdi_score: number;
  gdi_mean?: number;
  gdi_lower?: number;
  downloads: number;
  rating: number;
  version: number;
  carbon_cost: number;
  parent_id: string | null;
  generation: number;
  ancestors: string[];
  fork_count: number;
  config: Record<string, unknown> | null;
  gene_ids: string | null;
  confidence: number;
  execution_count: number;
  last_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAssetInput {
  asset_type: AssetType;
  name: string;
  description: string;
  content?: string;
  signals?: string[];
  tags?: string[];
  config?: Record<string, unknown>;
  gene_ids?: string[];
  parent_id?: string;
}

export interface UpdateAssetInput {
  name?: string;
  description?: string;
  content?: string;
  signals?: string[];
  tags?: string[];
  config?: Record<string, unknown>;
  status?: AssetStatus;
}

export interface ListAssetsInput {
  asset_type?: string;
  status?: string;
  author_id?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PublishAssetInput {
  asset_id: string;
  publish_metadata?: Record<string, unknown>;
}

export interface AssetCategory {
  id: string;
  name: string;
  description: string;
  asset_count: number;
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  { id: 'capsule', name: 'Capsules', description: 'AI agent capsules', asset_count: 0 },
  { id: 'gene', name: 'Genes', description: 'Evolution genes', asset_count: 0 },
  { id: 'workflow', name: 'Workflows', description: 'Automation workflows', asset_count: 0 },
  { id: 'template', name: 'Templates', description: 'Project templates', asset_count: 0 },
  { id: 'skill', name: 'Skills', description: 'AI agent skills', asset_count: 0 },
];
