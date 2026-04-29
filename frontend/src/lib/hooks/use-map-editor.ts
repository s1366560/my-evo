/**
 * use-map-editor.ts
 * React Query hook for the map editor canvas.
 * Bridges the FastAPI backend → editor store → MapCanvas.
 * Handles: fetch + populate, auto-save debounce, loading/error/saving states.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditorStore, type EditorNode, type EditorEdge } from "@/lib/stores/editor-store";

// ─── API types (mirrors FastAPI schemas) ────────────────────────────────────

export interface ApiMapNode {
  id: string; name: string; type: string;
  description?: string; category?: string;
  metadata?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface ApiMapEdge {
  id: string; source: string; target: string;
  type?: string; weight?: number; description?: string;
}

export interface ApiMapDetail {
  id: string; name: string; description?: string; category?: string;
  owner_id: string; nodes: ApiMapNode[]; edges: ApiMapEdge[];
  created_at: string; updated_at: string;
}

export interface ApiMapList {
  items: Array<{
    id: string; name: string; description?: string; category?: string;
    owner_id: string; node_count: number; edge_count: number;
    created_at: string; updated_at: string;
  }>;
  total: number; page: number; page_size: number; total_pages: number;
}

// ─── Mappers: API shape → editor store shape ────────────────────────────────

export function apiNodeToEditorNode(n: ApiMapNode): EditorNode {
  return {
    id: n.id, name: n.name, type: n.type as EditorNode["type"],
    description: n.description,
    position: n.position ?? { x: Math.random() * 600, y: Math.random() * 400 },
  };
}

export function apiEdgeToEditorEdge(e: ApiMapEdge): EditorEdge {
  return { id: e.id, source: e.source, target: e.target,
    weight: e.weight, label: e.description };
}

export function editorNodeToApiNode(n: EditorNode): ApiMapNode {
  return { id: n.id, name: n.name, type: n.type,
    description: n.description, position: n.position };
}

export function editorEdgeToApiEdge(e: EditorEdge): ApiMapEdge {
  return { id: e.id, source: e.source, target: e.target,
    type: "related", weight: e.weight ?? 1, description: e.label };
}

// ─── API fetch helpers ───────────────────────────────────────────────────────

async function fetchMapDetail(mapId: string): Promise<ApiMapDetail> {
  const res = await fetch(`/api/v2/maps/${mapId}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch map ${mapId}: ${res.status}`);
  // Handle BFF {success, data} wrapper or direct {nodes, edges} shape
  const json = await res.json();
  if (json.success && json.data) {
    const mapData = json.data;
    // Backend returns nodes and edges via separate calls; synthesize from GET /map response
    return {
      id: mapData.id,
      name: mapData.name,
      description: mapData.description,
      category: mapData.category,
      owner_id: mapData.userId,
      nodes: [],
      edges: [],
      created_at: mapData.createdAt,
      updated_at: mapData.updatedAt,
    };
  }
  return json as ApiMapDetail;
}

async function fetchMapList(): Promise<ApiMapList> {
  const res = await fetch("/api/v2/maps", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to list maps: ${res.status}`);
  // Handle BFF {success, data: [...]} wrapper
  const json = await res.json();
  if (json.success && Array.isArray(json.data)) {
    return {
      items: json.data.map((m: Record<string, unknown>) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        category: m.category,
        owner_id: m.userId,
        node_count: 0,
        edge_count: 0,
        created_at: m.createdAt,
        updated_at: m.updatedAt,
      })),
      total: json.data.length,
      page: 1,
      page_size: 20,
      total_pages: 1,
    };
  }
  return json as ApiMapList;
}

// ─── Auto-save debounce ──────────────────────────────────────────────────────

export const AUTO_SAVE_DELAY_MS = 1500;

/**
 * useMapEditor — fetches a map, populates the editor store, and auto-saves changes.
 *
 * @param mapId  The map to load (defaults to "default")
 * @param enabled Whether to fetch immediately
 */
export function useMapEditor(mapId = "default", enabled = true) {
  const qc = useQueryClient();
  const store = useEditorStore();
  const hydratedRef = useRef(false);

  const query = useQuery<ApiMapDetail, Error>({
    queryKey: ["map-editor", mapId],
    queryFn: () => fetchMapDetail(mapId),
    enabled, staleTime: 30_000, retry: 1,
  });

  // Sync fetched data → editor store once loaded
  useEffect(() => {
    if (!query.data || hydratedRef.current) return;
    hydratedRef.current = true;
    store.setNodes(query.data.nodes.map(apiNodeToEditorNode));
    store.setEdges(query.data.edges.map(apiEdgeToEditorEdge));
    store.setSelectedNodeId(null);
  }, [query.data, store]);

  const isServerHydrated = hydratedRef.current && !query.isLoading;

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ nodes: EditorNode[]; edges: EditorEdge[] } | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (payload: { nodes: ApiMapNode[]; edges: ApiMapEdge[] }) => {
      // Use dedicated save endpoint that handles nodes/edges batch operations
      const res = await fetch(`/api/v2/maps/${mapId}/save`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => { setIsSaving(false); setSaveError(null); },
    onError: (err: Error) => { setIsSaving(false); setSaveError(err.message); },
  });

  /**
   * Call this after every store mutation to trigger debounced auto-save.
   * Safe to call repeatedly — only the latest state is saved.
   */
  const trackChange = useCallback(
    (nodes: EditorNode[], edges: EditorEdge[]) => {
      if (!isServerHydrated) return;
      pendingRef.current = { nodes, edges };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!pendingRef.current) return;
        setIsSaving(true);
        const apiNodes = pendingRef.current.nodes.map(editorNodeToApiNode);
        const apiEdges = pendingRef.current.edges.map(editorEdgeToApiEdge);
        saveMutation.mutate({ nodes: apiNodes, edges: apiEdges });
      }, AUTO_SAVE_DELAY_MS);
    },
    [isServerHydrated, saveMutation],
  );

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isServerHydrated,
    isSaving,
    saveError,
    refetch: query.refetch,
    trackChange,
  };
}

/** List all maps (paginated) */
export function useMaps() {
  return useQuery<ApiMapList, Error>({
    queryKey: ["maps"],
    queryFn: fetchMapList,
    staleTime: 60_000, retry: 1,
  });
}

