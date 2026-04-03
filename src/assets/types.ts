import type {
  AssetType,
  AssetStatus,
  PublishPayload,
  PublishResponse,
  GDIScore,
  SimilarityResult,
} from '../shared/types';

export { AssetType, AssetStatus, PublishPayload, PublishResponse, GDIScore, SimilarityResult };

export interface AssetRecord {
  asset_id: string;
  asset_type: AssetType;
  name: string;
  description: string;
  content: string | null;
  signals: string[];
  tags: string[];
  author_id: string;
  status: AssetStatus;
  gdi_score: number;
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
  created_at: string;
  updated_at: string;
}

export interface SearchResultItem {
  asset_id: string;
  asset_type: AssetType;
  name: string;
  description: string;
  gdi_score: number;
  downloads: number;
  author_id: string;
  signals: string[];
  tags: string[];
}
