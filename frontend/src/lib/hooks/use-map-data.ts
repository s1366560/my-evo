import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { Asset } from "@/lib/api/client";

export interface MapNode {
  id: string;
  name: string;
  type: "Gene" | "Capsule" | "Recipe" | "Organism";
  author_id: string;
  author_name?: string;
  gdi_score: number;
  x?: number;
  y?: number;
  // graph position (force-directed layout will compute these)
  vx?: number;
  vy?: number;
  fx?: number | null; // fixed x (pinned by user)
  fy?: number | null; // fixed y (pinned by user)
}

export interface MapEdge {
  source: string;
  target: string;
  weight: number;
}

export interface MapGraph {
  nodes: MapNode[];
  edges: MapEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    geneCount: number;
    capsuleCount: number;
    recipeCount: number;
    avgGdi: number;
  };
}

export interface MapFilters {
  type?: "Gene" | "Capsule" | "Recipe" | "Organism" | "all";
  minGdi?: number;
  authorId?: string;
  search?: string;
}

/** Fetch graph data for the map visualization */
export function useMapGraph(filters?: MapFilters) {
  return useQuery<MapGraph>({
    queryKey: ["map", "graph", filters],
    queryFn: async () => {
      // Fetch all assets for graph — backend may paginate
      const assets = await apiClient.getAssetsRanked();
      const filtered = filterAssets(assets, filters);

      // Build nodes from assets
      const nodes: MapNode[] = filtered.map((asset) => ({
        id: asset.asset_id,
        name: asset.name,
        type: asset.type,
        author_id: asset.author_id,
        author_name: asset.author_name,
        gdi_score: typeof asset.gdi_score === "number"
          ? asset.gdi_score
          : (asset.gdi_score as unknown as { overall?: number })?.overall ?? 0,
      }));

      // Build synthetic edges (in a real system, these come from lineage)
      const edges: MapEdge[] = buildEdges(nodes);

      const types = { Gene: 0, Capsule: 0, Recipe: 0, Organism: 0 };
      for (const n of nodes) {
        if (n.type in types) types[n.type as keyof typeof types]++;
      }
      const avgGdi = nodes.length
        ? nodes.reduce((s, n) => s + n.gdi_score, 0) / nodes.length
        : 0;

      return {
        nodes,
        edges,
        stats: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          geneCount: types.Gene,
          capsuleCount: types.Capsule,
          recipeCount: types.Recipe,
          avgGdi: Math.round(avgGdi * 10) / 10,
        },
      };
    },
    staleTime: 60_000,
  });
}

function filterAssets(assets: Asset[], filters?: MapFilters): Asset[] {
  if (!filters) return assets;
  return assets.filter((a) => {
    if (filters.type && filters.type !== "all" && a.type !== filters.type) return false;
    if (filters.minGdi !== undefined) {
      const score = typeof a.gdi_score === "number" ? a.gdi_score : 0;
      if (score < filters.minGdi) return false;
    }
    if (filters.authorId && a.author_id !== filters.authorId) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !(a.description ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });
}

function buildEdges(nodes: MapNode[]): MapEdge[] {
  // In production, edges come from the lineage API.
  // For demo, connect similar-type nodes with weight based on GDI proximity.
  const edges: MapEdge[] = [];
  const byType = new Map<string, MapNode[]>();
  for (const node of nodes) {
    const list = byType.get(node.type) ?? [];
    list.push(node);
    byType.set(node.type, list);
  }
  for (const [, list] of byType) {
    // Connect nearest neighbors per type (max 3 edges per node to keep graph sparse)
    for (let i = 0; i < list.length; i++) {
      const sorted = list
        .filter((n) => n.id !== list[i].id)
        .sort((a, b) => Math.abs(a.gdi_score - list[i].gdi_score) - Math.abs(b.gdi_score - list[i].gdi_score));
      for (let j = 0; j < Math.min(3, sorted.length); j++) {
        edges.push({
          source: list[i].id,
          target: sorted[j].id,
          weight: 1 / (1 + Math.abs(sorted[j].gdi_score - list[i].gdi_score)),
        });
      }
    }
  }
  return edges;
}
