import { create } from 'zustand';

export interface MapNode {
  id: string;
  label: string;
  type: 'gene' | 'capsule' | 'recipe';
  score: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

export interface MapEdge {
  source: string;
  target: string;
  strength: number;
}

export interface MapConfig {
  layout: 'force' | 'radial' | 'hierarchical';
  nodeSize: 'score' | 'fixed' | 'calls';
  edgeStyle: 'line' | 'curve' | 'arrow';
  colorScheme: 'default' | 'heatmap' | 'categorical';
  showLabels: boolean;
  showScores: boolean;
  showEdges: boolean;
  animation: 'none' | 'gentle' | 'dynamic';
}

interface MapState {
  nodes: MapNode[];
  edges: MapEdge[];
  config: MapConfig;
  selectedNodeId: string | null;
  isPlaying: boolean;
  zoom: number;
  offset: { x: number; y: number };

  setNodes: (nodes: MapNode[]) => void;
  setEdges: (edges: MapEdge[]) => void;
  updateNode: (id: string, updates: Partial<MapNode>) => void;
  setConfig: (config: Partial<MapConfig>) => void;
  setSelectedNodeId: (id: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  setOffset: (offset: { x: number; y: number }) => void;
  loadMapData: (nodes: MapNode[], edges: MapEdge[]) => void;
}

const defaultConfig: MapConfig = {
  layout: 'force',
  nodeSize: 'score',
  edgeStyle: 'line',
  colorScheme: 'default',
  showLabels: true,
  showScores: true,
  showEdges: true,
  animation: 'gentle',
};

const defaultNodes: MapNode[] = [
  { id: '1', label: 'Root Gene', type: 'gene', score: 95, x: 400, y: 300, vx: 0, vy: 0 },
  { id: '2', label: 'Child A', type: 'gene', score: 85, x: 250, y: 200, vx: 0, vy: 0 },
  { id: '3', label: 'Child B', type: 'gene', score: 78, x: 550, y: 200, vx: 0, vy: 0 },
  { id: '4', label: 'Capsule A1', type: 'capsule', score: 72, x: 150, y: 120, vx: 0, vy: 0 },
  { id: '5', label: 'Capsule B1', type: 'capsule', score: 68, x: 650, y: 120, vx: 0, vy: 0 },
  { id: '6', label: 'Recipe A', type: 'recipe', score: 88, x: 300, y: 450, vx: 0, vy: 0 },
  { id: '7', label: 'Recipe B', type: 'recipe', score: 82, x: 500, y: 450, vx: 0, vy: 0 },
  { id: '8', label: 'Deep Gene', type: 'gene', score: 91, x: 200, y: 380, vx: 0, vy: 0 },
  { id: '9', label: 'Deep Gene 2', type: 'gene', score: 75, x: 600, y: 380, vx: 0, vy: 0 },
];

const defaultEdges: MapEdge[] = [
  { source: '1', target: '2', strength: 0.9 },
  { source: '1', target: '3', strength: 0.8 },
  { source: '2', target: '4', strength: 0.7 },
  { source: '3', target: '5', strength: 0.6 },
  { source: '2', target: '6', strength: 0.5 },
  { source: '3', target: '7', strength: 0.5 },
  { source: '6', target: '8', strength: 0.4 },
  { source: '7', target: '9', strength: 0.4 },
];

export const useMapStore = create<MapState>((set) => ({
  nodes: defaultNodes,
  edges: defaultEdges,
  config: defaultConfig,
  selectedNodeId: null,
  isPlaying: true,
  zoom: 1,
  offset: { x: 0, y: 0 },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  updateNode: (id, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  setConfig: (config) =>
    set((state) => ({ config: { ...state.config, ...config } })),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setZoom: (zoom) => set({ zoom }),
  setOffset: (offset) => set({ offset }),
  loadMapData: (nodes, edges) => set({ nodes, edges }),
}));
