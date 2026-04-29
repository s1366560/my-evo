"use client";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  Panel,
  BackgroundVariant,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEditorStore, type EditorNode, type EditorNodeData, type EditorEdge, type NodeType } from "@/lib/stores/editor-store";
import { GeneNode } from "./nodes/GeneNode";
import { CapsuleNode } from "./nodes/CapsuleNode";
import { RecipeNode } from "./nodes/RecipeNode";
import { OrganismNode } from "./nodes/OrganismNode";
import { GeneEdge } from "./edges/GeneEdge";
import { useMapEditor } from "@/lib/hooks/use-map-editor";

const TYPE_COLORS: Record<NodeType, string> = {
  Gene: "var(--color-gene-green)",
  Capsule: "var(--color-capsule-blue)",
  Recipe: "var(--color-recipe-amber)",
  Organism: "var(--color-organism-purple)",
};

function editorNodeToFlowNode(en: EditorNode): Node {
  return {
    id: en.id,
    type: en.type,
    position: en.position,
    data: { ...en },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, React.ComponentType<any>> = {
  Gene: GeneNode,
  Capsule: CapsuleNode,
  Recipe: RecipeNode,
  Organism: OrganismNode,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes: Record<string, React.ComponentType<any>> = {
  gene: GeneEdge,
};

interface MapCanvasProps {
  onNodeDoubleClick?: (nodeId: string) => void;
  /** ID of the map to load from the API. Defaults to "default". */
  mapId?: string;
}

export function MapCanvas({ onNodeDoubleClick, mapId = "default" }: MapCanvasProps) {
  const {
    nodes: editorNodes,
    edges: editorEdges,
    addNode,
    updateNode,
    deleteNode,
    addEdge: storeAddEdge,
    deleteEdge,
    setSelectedNodeId,
    isExporting,
  } = useEditorStore();

  // ── Backend integration ─────────────────────────────────────────────────────
  const { isLoading, isError, error, isSaving, trackChange, refetch } = useMapEditor(mapId);

  // Sync from store → React Flow
  const flowNodes = useMemo(
    () => editorNodes.map(editorNodeToFlowNode),
    [editorNodes]
  );
  const flowEdges = useMemo(
    () =>
      editorEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "gene",
        data: { label: e.label, weight: e.weight },
      })),
    [editorEdges]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges as any);

  // Sync store → local on store-driven changes (e.g. AI generate, add).
  // useEffect is correct here; useMemo should never have side effects.
  useEffect(() => { setNodes(flowNodes); }, [flowNodes, setNodes]);
  useEffect(() => { setEdges(flowEdges); }, [flowEdges, setEdges]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          updateNode(change.id, { position: { x: change.position.x, y: change.position.y } });
        }
        if (change.type === "remove") {
          deleteNode(change.id);
        }
        if (change.type === "select") {
          setSelectedNodeId(change.selected ? change.id : null);
        }
      }
      // Debounced auto-save reads fresh state directly from the store
      const { nodes: n, edges: e } = useEditorStore.getState();
      trackChange(n, e);
    },
    [onNodesChange, updateNode, deleteNode, setSelectedNodeId, trackChange]
  );

  const handleEdgesChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (changes: any[]) => {
      onEdgesChange(changes);
      for (const change of changes) {
        if (change.type === "remove") {
          deleteEdge(change.id);
        }
      }
      // Auto-save after edge changes
      const { nodes: n, edges: e } = useEditorStore.getState();
      trackChange(n, e);
    },
    [onEdgesChange, deleteEdge, trackChange]
  );

  const handleConnect: OnConnect = useCallback(
    (params) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEdges((eds) => addEdge(params as any, eds));
      if (params.source && params.target) {
        storeAddEdge({
          id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          source: params.source,
          target: params.target,
        });
      }
      // Auto-save after connect
      const { nodes: n, edges: e } = useEditorStore.getState();
      trackChange(n, e);
    },
    [setEdges, storeAddEdge, trackChange]
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick]
  );

  return (
    <div className="h-full w-full relative">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gene-green border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading map…</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {isError && !isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 max-w-sm text-center p-6">
            <span className="text-2xl">⚠️</span>
            <p className="text-sm text-muted-foreground">
              {error?.message ?? "Failed to load map. Check that the backend is running."}
            </p>
            <button
              className="rounded-lg bg-gene-green px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute top-3 right-3 z-40">
          <div className="flex items-center gap-2 rounded-full bg-card-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-sm border border-border">
            <div className="h-2 w-2 animate-pulse rounded-full bg-gene-green" />
            Saving…
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeDoubleClick={handleNodeDoubleClick}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{ type: "gene" }}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        panOnDrag
        selectionOnDrag
        className="bg-[var(--color-background)]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--color-border)"
        />
        <Controls
          position="bottom-right"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] shadow-lg"
        />
        <MiniMap
          position="top-right"
          nodeColor={(n) => TYPE_COLORS[(n.data as unknown as EditorNodeData).type] ?? "#888"}
          maskColor="rgba(0,0,0,0.6)"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] shadow-lg"
          pannable
          zoomable
        />
        {isExporting && (
          <Panel position="top-center" className="pointer-events-none">
            <div className="rounded-full bg-[var(--color-gene-green)] px-4 py-1.5 text-xs font-medium text-white shadow-lg animate-pulse">
              Exporting PNG…
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
