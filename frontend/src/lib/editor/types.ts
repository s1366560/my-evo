// ─── Editor Core Types ─────────────────────────────────────────────────────────

export type NodeType = "Gene" | "Capsule" | "Recipe" | "Organism" | "Custom";
export type EditorMode = "select" | "pan" | "add-node" | "add-edge" | "delete";
export type EdgeStyle = "solid" | "dashed" | "dotted";

export interface EditorNode {
  id: string;
  name: string;
  type: NodeType;
  author_id: string;
  author_name?: string;
  gdi_score: number;
  description?: string;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
  color?: string;
  size?: number;
  metadata?: Record<string, string>;
}

export interface EditorEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  weight?: number;
  style?: EdgeStyle;
  color?: string;
}

export interface EditorMap {
  id: string;
  name: string;
  description?: string;
  nodes: EditorNode[];
  edges: EditorEdge[];
  created_at: string;
  updated_at: string;
  owner_id: string;
}

export interface EditorState {
  map: EditorMap | null;
  isDirty: boolean;
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  mode: EditorMode;
  connectingFrom: string | null;
  undoStack: string[];
  redoStack: string[];
  showNodePanel: boolean;
  showExportDialog: boolean;
  showAiDialog: boolean;
  savedMaps: EditorMap[];
}
