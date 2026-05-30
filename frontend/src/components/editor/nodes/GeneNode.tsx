"use client";
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Dna, ChevronRight } from "lucide-react";
import type { EditorNodeData } from "@/lib/stores/editor-store";

// @xyflow/react v12 removed NodeProps; declare it as any to accept React Flow's internal node shape.
type NodeProps<T = EditorNodeData> = {
  data: T;
  selected?: boolean;
};
function GeneNodeComponent({ data, selected }: NodeProps) {
  const node = data as EditorNodeData;
  return (
    <div
      className={[
        "group relative min-w-[140px] max-w-[200px] cursor-pointer rounded-xl border bg-[var(--color-card-background)] shadow-md transition-all duration-150",
        selected
          ? "border-[var(--color-gene-green)] shadow-[0_0_0_2px_var(--color-gene-green)]"
          : "border-[var(--color-border)] hover:border-[var(--color-gene-green)]/50",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 rounded-t-xl border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-gene-green)_10%,transparent)] px-3 py-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-gene-green)]/20">
          <Dna className="h-3 w-3 text-[var(--color-gene-green)]" />
        </span>
        <span className="text-xs font-semibold text-[var(--color-foreground)]">{node.name}</span>
      </div>

      {/* Body */}
      {node.description && (
        <div className="px-3 py-2">
          <p className="line-clamp-2 text-xs text-[var(--color-muted-foreground)]">{node.description}</p>
        </div>
      )}

      {/* Footer */}
      {(node.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 rounded-b-xl">
          {node.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-[var(--color-gene-green)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-gene-green)]">{tag}</span>
          ))}
          {(node.tags?.length ?? 0) > 3 && (
            <span className="text-[10px] text-[var(--color-muted-foreground)]">+{node.tags!.length - 3}</span>
          )}
        </div>
      )}

      {/* GDI Score badge */}
      {node.gdi_score !== undefined && (
        <div className="absolute -top-2 -right-2 rounded-full bg-[var(--color-gene-green)] px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
          {node.gdi_score.toFixed(0)}
        </div>
      )}

      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-[var(--color-gene-green)] !bg-[var(--color-background)]" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-[var(--color-gene-green)] !bg-[var(--color-background)]" />
      <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-[var(--color-gene-green)] !bg-[var(--color-background)]" />
      <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-[var(--color-gene-green)] !bg-[var(--color-background)]" />
    </div>
  );
}

export const GeneNode = memo(GeneNodeComponent);
