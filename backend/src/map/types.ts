// Map Types for My Evo Backend
export interface MapNode {
  id: string; mapId: string; label: string; type: NodeType;
  positionX: number; positionY: number; color?: string; icon?: string;
  size: number; weight: number; level: number; data?: Record<string, unknown>;
  createdAt: Date; updatedAt: Date;
}
export interface MapEdge {
  id: string; mapId: string; sourceId: string; targetId: string;
  label?: string; type: EdgeType; weight: number; color?: string;
  style: EdgeStyle; arrowHead: ArrowHead; bidirectional: boolean;
  createdAt: Date; updatedAt: Date;
}
export interface Map {
  id: string; userId: string; name: string; description?: string;
  version: string; layout: LayoutType; tags?: string; isPublic: boolean;
  nodeCount: number; edgeCount: number; createdAt: Date; updatedAt: Date;
}
export interface MapWithDetails extends Map { nodes: MapNode[]; edges: MapEdge[]; }
export interface CreateMapInput {
  name: string; description?: string; version?: string;
  layout?: LayoutType; tags?: string; isPublic?: boolean;
}
export interface UpdateMapInput {
  name?: string; description?: string; version?: string;
  layout?: LayoutType; tags?: string; isPublic?: boolean;
}
export interface CreateMapNodeInput {
  label: string; type: NodeType; positionX: number; positionY: number;
  color?: string; icon?: string; size?: number; weight?: number; level?: number;
  data?: Record<string, unknown>;
}
export interface UpdateMapNodeInput {
  label?: string; type?: NodeType; positionX?: number; positionY?: number;
  color?: string; icon?: string; size?: number; weight?: number; level?: number;
  data?: Record<string, unknown>;
}
export interface CreateMapEdgeInput {
  sourceId: string; targetId: string; label?: string; type?: EdgeType;
  weight?: number; color?: string; style?: EdgeStyle;
  arrowHead?: ArrowHead; bidirectional?: boolean;
}
export interface UpdateMapEdgeInput {
  label?: string; type?: EdgeType; weight?: number; color?: string;
  style?: EdgeStyle; arrowHead?: ArrowHead; bidirectional?: boolean;
}
export interface ImportMapInput {
  name: string; description?: string; tags?: string; isPublic?: boolean;
  nodes: Array<{ label: string; type: NodeType; positionX: number; positionY: number;
    color?: string; icon?: string; size?: number; weight?: number; level?: number;
    data?: Record<string, unknown> }>;
  edges: Array<{ sourceLabel: string; targetLabel: string; label?: string;
    type?: EdgeType; weight?: number; color?: string; style?: EdgeStyle;
    arrowHead?: ArrowHead; bidirectional?: boolean }>;
}
export interface MapExportData {
  map: { id: string; name: string; description?: string; version: string;
    layout: string; tags?: string; isPublic: boolean; createdAt: string; updatedAt: string };
  nodes: Array<{ id: string; label: string; type: string; positionX: number;
    positionY: number; color?: string; icon?: string; size: number; weight: number;
    level: number; data?: Record<string, unknown> }>;
  edges: Array<{ id: string; sourceId: string; targetId: string; label?: string;
    type: string; weight: number; color?: string; style: string;
    arrowHead: string; bidirectional: boolean }>;
  metadata: { exportedAt: string; exporter: string; nodeCount: number; edgeCount: number };
}
export type NodeType = 'concept' | 'agent' | 'action' | 'resource' | 'event' | 'milestone';
export type EdgeType = 'dependency' | 'association' | 'composition' | 'inheritance' | 'communication';
export type LayoutType = 'force' | 'hierarchical' | 'circular' | 'grid';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';
export type ArrowHead = 'none' | 'arrow' | 'diamond' | 'circle';
export interface GraphMetrics {
  nodeCount: number; edgeCount: number; density: number; avgDegree: number;
  diameter?: number; connectedComponents: number; isAcyclic: boolean; levels: number[];
}
export interface NodeMetrics {
  inDegree: number; outDegree: number; centrality: number;
  betweenness?: number; pagerank?: number;
}
export interface MapListParams {
  page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc';
  isPublic?: boolean; tags?: string; search?: string;
}
