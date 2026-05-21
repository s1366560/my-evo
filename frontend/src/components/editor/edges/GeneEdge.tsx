"use client";
import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

export interface GeneEdgeData extends Record<string, unknown> {
  label?: string;
  weight?: number;
}

function GeneEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as GeneEdgeData | undefined;

  return (
    <>
      <BaseEdge
        path={edgePath}
        className={[
          "transition-all duration-150",
          selected
            ? "[&>path]:stroke-[var(--color-gene-green)] [&>path]:stroke-[3px]"
            : "[&>path]:stroke-[var(--color-border-strong)] [&>path]:stroke-[2px]",
        ].join(" ")}
      />
      {(edgeData?.label || edgeData?.weight) && (
        <EdgeLabelRenderer>
          <div
            className={[
              "pointer-events-none rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm",
              selected
                ? "border-[var(--color-gene-green)] bg-[var(--color-gene-green)] text-white"
                : "border-[var(--color-border)] bg-[var(--color-card-background)] text-[var(--color-muted-foreground)]",
            ].join(" ")}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              position: "absolute",
            }}
          >
            {edgeData?.weight !== undefined ? `${edgeData.weight.toFixed(2)}` : edgeData?.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const GeneEdge = memo(GeneEdgeComponent);
