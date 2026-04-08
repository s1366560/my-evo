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

import type { LineageNode } from "@/lib/api/client";

interface LineageEdge {
  from: string;
  to: string;
}

interface LineageData {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

interface LineageTreeProps {
  data: LineageData;
  assetId: string;
}

const MAX_NODES = 200;

export function LineageTree({ data, assetId }: LineageTreeProps) {
  const nodesToShow = useMemo(
    () => data.nodes.slice(0, MAX_NODES),
    [data.nodes]
  );

  const flowNodes: Node[] = useMemo(
    () =>
      nodesToShow.map((node) => ({
        id: node.asset_id,
        position: { x: Math.random() * 600, y: Math.random() * 400 },
        data: { label: node.name || node.asset_id },
        style: {
          padding: "8px 12px",
          borderRadius: "6px",
          border: node.asset_id === assetId
            ? "2px solid var(--color-gene-green)"
            : "1px solid var(--color-border)",
          backgroundColor: node.asset_id === assetId
            ? "color-mix(in srgb, var(--color-gene-green) 15%, white)"
            : "var(--color-card)",
          color: "var(--color-foreground)",
          fontSize: "12px",
          fontWeight: node.asset_id === assetId ? 600 : 400,
        },
      })),
    [nodesToShow, assetId]
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      data.edges
        .filter(
          (e) =>
            nodesToShow.some((n) => n.asset_id === e.from) &&
            nodesToShow.some((n) => n.asset_id === e.to)
        )
        .map((edge) => ({
          id: `${edge.from}-${edge.to}`,
          source: edge.from,
          target: edge.to,
          type: "smoothstep",
          style: { stroke: "var(--color-border)", strokeWidth: 1.5 },
          animated: false,
        })),
    [data.edges, nodesToShow]
  );

  const [nodes, , onNodesChange] = useNodesState(flowNodes);
  const [edges, , onEdgesChange] = useEdgesState(flowEdges);


  if (nodesToShow.length === 0) {
    return (
      <p className="text-[var(--color-muted-foreground)]">
        No lineage data available.
      </p>
    );
  }

  return (
    <div className="h-[480px] w-full rounded-lg border border-[var(--color-border)] overflow-hidden">
      {data.nodes.length > MAX_NODES && (
        <p className="p-2 text-xs text-[var(--color-muted-foreground)] bg-[var(--color-muted)]">
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
          nodeColor="var(--color-gene-green)"
          maskColor="color-mix(in srgb, var(--color-background) 80%, transparent)"
        />
      </ReactFlow>
    </div>
  );
}
