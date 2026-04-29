/**
 * Map Input Types
 */
export interface CreateMapInput {
  name: string;
  description?: string;
  map_type?: string;
  layout_type?: string;
  is_public?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateMapInput {
  name?: string;
  description?: string;
  layout_type?: string;
  is_public?: boolean;
  config?: Record<string, unknown>;
}

export interface AddNodeInput {
  node_id: string;
  label: string;
  description?: string;
  node_type?: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  icon?: string;
  asset_id?: string;
}

export interface AddEdgeInput {
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type?: string;
  label?: string;
  weight?: number;
}

export interface ListMapsOptions {
  public?: boolean;
  limit?: number;
  offset?: number;
}

export interface MapResponse {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  meta: { timestamp: string; request_id: string };
}

export interface LayoutComputeOptions {
  iterations?: number;
  gravity?: number;
  repulsion?: number;
  attraction?: number;
  maxMovement?: number;
  width?: number;
  height?: number;
}
