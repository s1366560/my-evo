// Graph layout engine types
export interface LayoutNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  nodeType?: string;
  metadata?: Record<string, unknown>;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  edgeType?: string;
  weight?: number;
  label?: string;
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  clusters?: Array<{ id: string; nodeIds: string[]; center: { x: number; y: number } }>;
  iterations: number;
  elapsedMs: number;
}

export interface ForceOptions {
  iterations?: number;
  gravity?: number;
  repulsion?: number;
  attraction?: number;
  maxMovement?: number;
  width?: number;
  height?: number;
}

export interface RadialOptions {
  centerX?: number;
  centerY?: number;
  nodeRadius?: number;
  levelGap?: number;
  rootNodeId?: string;
}

export interface TreeOptions {
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  levelGap?: number;
  rootNodeId?: string;
}
