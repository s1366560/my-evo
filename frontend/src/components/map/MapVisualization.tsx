"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef, useMemo } from "react";
import dynamic from "next/dynamic";
import type { MapNode, MapGraph } from "@/lib/hooks/use-map-data";
import type { MapConfig } from "./MapConfigPanel";
import { DEFAULT_CONFIG } from "./MapConfigPanel";

// Dynamically import force-graph to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface MapVisualizationProps {
  data: MapGraph;
  onNodeClick?: (node: MapNode) => void;
  highlightedNodeId?: string;
  config?: Partial<MapConfig>;
  physicsStrength?: number; // 0-100
  onZoomInRef?: React.MutableRefObject<(() => void) | null>;
  onZoomOutRef?: React.MutableRefObject<(() => void) | null>;
  onFitViewRef?: React.MutableRefObject<(() => void) | null>;
  onResetRef?: React.MutableRefObject<(() => void) | null>;
}

export interface MapVisualizationHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  reset: () => void;
  getZoomLevel: () => number;
}

const BASE_TYPE_COLORS: Record<string, string> = {
  Gene: "#22c55e",
  Capsule: "#3b82f6",
  Recipe: "#f59e0b",
  Organism: "#a855f7",
  default: "#6b7280",
};

const COLOR_SCHEMES: Record<string, Record<string, string>> = {
  default: BASE_TYPE_COLORS,
  monochrome: { Gene: "#6b7280", Capsule: "#9ca3af", Recipe: "#d1d5db", Organism: "#e5e7eb", default: "#6b7280" },
  vibrant: { Gene: "#10b981", Capsule: "#6366f1", Recipe: "#f97316", Organism: "#ec4899", default: "#6b7280" },
  warm: { Gene: "#f59e0b", Capsule: "#ef4444", Recipe: "#fbbf24", Organism: "#dc2626", default: "#6b7280" },
  cool: { Gene: "#06b6d4", Capsule: "#3b82f6", Recipe: "#8b5cf6", Organism: "#06b6d4", default: "#6b7280" },
};

function getNodeColor(node: MapNode, scheme: string): string {
  const colors = COLOR_SCHEMES[scheme] ?? COLOR_SCHEMES.default;
  return colors[node.type] ?? colors.default;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ForceGraphRef = any;

export const MapVisualization = forwardRef<MapVisualizationHandle, MapVisualizationProps>(
  function MapVisualization(
    {
      data,
      onNodeClick,
      highlightedNodeId,
      config = {},
      physicsStrength = 50,
      onZoomInRef,
      onZoomOutRef,
      onFitViewRef,
      onResetRef,
    },
    ref
  ) {
    const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);

    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
    const [zoomLevel, setZoomLevel] = useState(1);

    // Track container size
    useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setContainerSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, []);

    // Physics settings derived from strength (0-100)
    const d3AlphaDecay = useMemo(() => {
      // strength 0 → very slow decay (static), strength 100 → fast decay (dynamic)
      return 0.005 + (physicsStrength / 100) * 0.04;
    }, [physicsStrength]);

    const d3VelocityDecay = useMemo(() => {
      // strength 0 → high friction (static), strength 100 → low friction (dynamic)
      return 0.6 - (physicsStrength / 100) * 0.45;
    }, [physicsStrength]);

    // Center on highlighted node when it changes
    useEffect(() => {
      if (highlightedNodeId && graphRef.current) {
        const nodes = graphRef.current.nodes();
        const target = nodes.find((n: MapNode) => n.id === highlightedNodeId);
        if (target && target.x !== undefined && target.y !== undefined) {
          graphRef.current.centerAt(target.x, target.y, 500);
          graphRef.current.zoom(2, 500);
          setZoomLevel(2);
        }
      }
    }, [highlightedNodeId]);

    const handleNodeClick = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node: any) => {
        onNodeClick?.(node as MapNode);
      },
      [onNodeClick]
    );

    const handleZoomIn = useCallback(() => {
      if (graphRef.current) {
        const currentZoom = graphRef.current.zoom();
        graphRef.current.zoom(currentZoom * 1.3, 300);
        setZoomLevel((z) => z * 1.3);
      }
    }, []);

    const handleZoomOut = useCallback(() => {
      if (graphRef.current) {
        const currentZoom = graphRef.current.zoom();
        graphRef.current.zoom(currentZoom / 1.3, 300);
        setZoomLevel((z) => z / 1.3);
      }
    }, []);

    const handleFitView = useCallback(() => {
      if (graphRef.current) {
        graphRef.current.zoomToFit(400, 40);
        setZoomLevel(1);
      }
    }, []);

    const handleReset = useCallback(() => {
      if (graphRef.current) {
        graphRef.current.d3ReheatSimulation();
        graphRef.current.zoomToFit(400, 40);
        setZoomLevel(1);
      }
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      fitView: handleFitView,
      reset: handleReset,
      getZoomLevel: () => zoomLevel,
    }));

    // Wire up external refs
    useEffect(() => {
      if (onZoomInRef) onZoomInRef.current = handleZoomIn;
      if (onZoomOutRef) onZoomOutRef.current = handleZoomOut;
      if (onFitViewRef) onFitViewRef.current = handleFitView;
      if (onResetRef) onResetRef.current = handleReset;
    }, [onZoomInRef, onZoomOutRef, onFitViewRef, onResetRef, handleZoomIn, handleZoomOut, handleFitView, handleReset]);

    // Normalize nodes for force-graph (fx/fy must be number | undefined, not null)
    const fgNodes = data.nodes.map((n) => ({
      ...n,
      fx: n.fx ?? undefined,
      fy: n.fy ?? undefined,
    }));

    if (!data.nodes.length) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-lg border border-[var(--color-border)]">
          <p className="text-[var(--color-muted-foreground)]">No assets to display on the map.</p>
        </div>
      );
    }

    const scheme = mergedConfig.colorScheme;
    const colorFn = (node: MapNode) => {
      if (node.id === highlightedNodeId) return "#facc15";
      if (node.id === hoveredNode) return "#fb923c";
      return getNodeColor(node, scheme);
    };

    const valFn = (node: MapNode) => {
      if (mergedConfig.nodeSizeBy === "gdi") {
        return Math.max(2, Math.sqrt(node.gdi_score) * 1.5);
      }
      if (mergedConfig.nodeSizeBy === "type") {
        return node.type === "Organism" ? 10 : node.type === "Recipe" ? 7 : 5;
      }
      return 5;
    };

    return (
      <div ref={containerRef} className="relative h-full w-full">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ForceGraph2D
          ref={graphRef as React.MutableRefObject<ForceGraphRef>}
          graphData={{
            nodes: fgNodes,
            links: mergedConfig.showEdges ? data.edges : [],
          }}
          width={containerSize.width}
          height={containerSize.height}
          nodeColor={(node) => colorFn(node as MapNode)}
          nodeLabel={(node) => {
            const n = node as MapNode;
            return `${n.name} (${n.type}) — GDI: ${n.gdi_score}`;
          }}
          nodeRelSize={6}
          nodeVal={(node) => valFn(node as MapNode)}
          linkColor={() => `rgba(107,114,128,${mergedConfig.edgeOpacity / 100})`}
          linkWidth={mergedConfig.showEdges ? 1 : 0}
          onNodeClick={(node) => handleNodeClick(node as MapNode)}
          onNodeHover={(node) => setHoveredNode(node ? (node as MapNode).id : null)}
          backgroundColor={mergedConfig.backgroundColor === "transparent" ? "transparent" : mergedConfig.backgroundColor}
          cooldownTicks={physicsStrength > 0 ? 100 : 0}
          d3AlphaDecay={d3AlphaDecay}
          d3VelocityDecay={d3VelocityDecay}
          onZoom={({ k }) => setZoomLevel(k)}
        />
        {/* Zoom level indicator */}
        <div className="absolute right-4 top-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)]/80 px-2 py-1 text-xs text-[var(--color-muted-foreground)] backdrop-blur-sm">
          {Math.round(zoomLevel * 100)}%
        </div>
      </div>
    );
  }
);
