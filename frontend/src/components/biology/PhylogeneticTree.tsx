"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Node,
  Edge,
  Background,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { AssetType } from "@/lib/api/client";

interface PhyloNode {
  asset_id: string;
  name: string;
  type: AssetType;
  parent_id?: string;
  gdi_score?: number;
}

interface PhyloEdge {
  from: string;
  to: string;
}

interface PhylogeneticData {
  nodes: PhyloNode[];
  edges: PhyloEdge[];
}

interface PhylogeneticTreeProps {
  data: PhylogeneticData;
  assetId: string;
}

const MAX_NODES = 100;

const ASSET_COLOR_MAP: Record<AssetType, string> = {
  Gene: "var(--color-gene-green)",
  Capsule: "var(--color-capsule-blue)",
  Recipe: "var(--color-recipe-amber)",
  Organism: "var(--color-trust-gold)",
};

export function PhylogeneticTree({ data, assetId }: PhylogeneticTreeProps) {
  const nodesToShow = useMemo(
    () => data.nodes.slice(0, MAX_NODES),
    [data.nodes]
  );

  const flowNodes: Node[] = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    const cols = Math.ceil(Math.sqrt(nodesToShow.length));

    nodesToShow.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.set(n.asset_id, {
        x: col * 220 + 80,
        y: row * 120 + 60,
      });
    });

    return nodesToShow.map((node) => {
      const pos = positions.get(node.asset_id)!;
      const color = ASSET_COLOR_MAP[node.type] ?? "var(--color-border)";
      const isHighlighted = node.asset_id === assetId;

      return {
        id: node.asset_id,
        position: pos,
        data: {
          label: `${node.name}\n(GDI: ${node.gdi_score ?? "N/A"})`,
        },
        style: {
          padding: "6px 10px",
          borderRadius: "6px",
          border: isHighlighted
            ? `2px solid ${color}`
            : "1px solid var(--color-border)",
          backgroundColor: isHighlighted
            ? `color-mix(in oklab, ${color} 15%, white)`
            : "var(--color-card-background)",
          color: "var(--color-foreground)",
          fontSize: "11px",
          fontWeight: isHighlighted ? 600 : 400,
          minWidth: "100px",
          textAlign: "center" as const,
        },
      };
    });
  }, [nodesToShow, assetId]);

  const flowEdges: Edge[] = useMemo(
    () =>
      data.edges
        .filter(
          (e) =>
            nodesToShow.some((n) => n.asset_id === e.from) &&
            nodesToShow.some((n) => n.asset_id === e.to)
        )
        .map((edge) => {
          const sourceNode = nodesToShow.find((n) => n.asset_id === edge.from);
          const color = sourceNode
            ? ASSET_COLOR_MAP[sourceNode.type] ?? "var(--color-border)"
            : "var(--color-border)";
          return {
            id: `${edge.from}-${edge.to}`,
            source: edge.from,
            target: edge.to,
            type: "smoothstep",
            style: { stroke: color, strokeWidth: 1.5, opacity: 0.6 },
            animated: false,
          } satisfies Edge;
        }),
    [data.edges, nodesToShow]
  );

  const [nodes, , onNodesChange] = useNodesState(flowNodes);
  const [edges, , onEdgesChange] = useEdgesState(flowEdges);

  const assetTypes: AssetType[] = ["Gene", "Capsule", "Recipe", "Organism"];

  if (nodesToShow.length === 0) {
    return (
      <p className="text-[var(--color-muted-foreground)]">
        No phylogenetic data available.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {assetTypes.map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: ASSET_COLOR_MAP[type] }}
            />
            <span className="text-[var(--color-muted-foreground)]">{type}</span>
          </span>
        ))}
      </div>

      {/* Tree */}
      <div className="h-[520px] w-full overflow-hidden rounded-lg border border-[var(--color-border)]">
        {data.nodes.length > MAX_NODES && (
          <p className="bg-[var(--color-muted)] p-2 text-xs text-[var(--color-muted-foreground)]">
            Showing first {MAX_NODES} of {data.nodes.length} nodes.
          </p>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--color-border)" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const phyloNode = nodesToShow.find((n) => n.asset_id === node.id);
              return phyloNode
                ? ASSET_COLOR_MAP[phyloNode.type] ?? "var(--color-border)"
                : "var(--color-border)";
            }}
            maskColor="color-mix(in oklab, var(--color-background) 80%, transparent)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
