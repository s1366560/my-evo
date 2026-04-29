/**
 * Editor Store — manages map/graph editor state: nodes, edges, history (undo/redo).
 */
import { create } from "zustand";

export type NodeType = "Gene" | "Capsule" | "Recipe" | "Organism";

/** Data fields for a node (position/id handled by React Flow separately) */
export interface EditorNodeData {
  name: string;
  type: NodeType;
  description?: string;
  author_id?: string;
  author_name?: string;
  gdi_score?: number;
  tags?: string[];
}

export interface EditorNode extends EditorNodeData {
  id: string;
  position: { x: number; y: number };
}

export interface EditorEdge {
  id: string;
  source: string;
  target: string;
  weight?: number;
  label?: string;
}

interface HistoryEntry {
  nodes: EditorNode[];
  edges: EditorEdge[];
}

interface EditorState {
  nodes: EditorNode[];
  edges: EditorEdge[];
  selectedNodeId: string | null;
  isDragging: boolean;
  history: HistoryEntry[];
  historyIndex: number;
  isExporting: boolean;
  isAiGenerating: boolean;

  // Actions
  setNodes: (nodes: EditorNode[]) => void;
  setEdges: (edges: EditorEdge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  addNode: (node: EditorNode) => void;
  updateNode: (id: string, updates: Partial<EditorNode>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: EditorEdge) => void;
  deleteEdge: (id: string) => void;
  updateEdge: (id: string, updates: Partial<EditorEdge>) => void;
  undo: () => void;
  redo: () => void;
  saveSnapshot: () => void;
  exportAsJson: () => void;
  exportAsPng: () => void;
  importFromJson: (data: { nodes: EditorNode[]; edges: EditorEdge[] }) => void;
  setIsAiGenerating: (v: boolean) => void;
  clearAll: () => void;
}

function uid(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDragging: false,
  history: [],
  historyIndex: -1,
  isExporting: false,
  isAiGenerating: false,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  addNode: (node) => {
    const state = get();
    state.saveSnapshot();
    set({ nodes: [...state.nodes, { ...node, id: node.id || uid() }] });
  },

  updateNode: (id, updates) => {
    const state = get();
    state.saveSnapshot();
    set({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    });
  },

  deleteNode: (id) => {
    const state = get();
    state.saveSnapshot();
    set({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    });
  },

  addEdge: (edge) => {
    const state = get();
    state.saveSnapshot();
    set({ edges: [...state.edges, edge] });
  },

  deleteEdge: (id) => {
    const state = get();
    state.saveSnapshot();
    set({ edges: state.edges.filter((e) => e.id !== id) });
  },

  updateEdge: (id, updates) => {
    const state = get();
    state.saveSnapshot();
    set({
      edges: state.edges.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    });
  },

  saveSnapshot: () => {
    const { nodes, edges, history, historyIndex } = get();
    // Truncate redo history when a new action is taken
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });
    // Keep max 50 entries
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    set({ nodes: prev.nodes, edges: prev.edges, historyIndex: historyIndex - 1 });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    set({ nodes: next.nodes, edges: next.edges, historyIndex: historyIndex + 1 });
  },

  exportAsJson: () => {
    const { nodes, edges } = get();
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-evo-map-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportAsPng: () => {
    // Delegate to component; here we just signal intent
    set({ isExporting: true });
    setTimeout(() => set({ isExporting: false }), 2000);
  },

  importFromJson: (data) => {
    const state = get();
    state.saveSnapshot();
    set({
      nodes: data.nodes ?? [],
      edges: data.edges ?? [],
      selectedNodeId: null,
    });
  },

  setIsAiGenerating: (v) => set({ isAiGenerating: v }),

  clearAll: () => {
    const state = get();
    state.saveSnapshot();
    set({ nodes: [], edges: [], selectedNodeId: null });
  },
}));
