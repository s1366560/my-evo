"use client";

import { Badge } from "@/components/ui/badge";

type SwarmStatus = "active" | "completed" | "failed";
export type SwarmMode =
  | "gather"
  | "explore"
  | "specialize"
  | "elect"
  | "merge"
  | "pool";

interface SwarmTask {
  id: string;
  name: string;
  status: SwarmStatus;
  participantCount: number;
  mode: SwarmMode;
  createdAt: string;
  progress: number;
}

interface SwarmTaskCardProps {
  task: SwarmTask;
}

const STATUS_CONFIG: Record<
  SwarmStatus,
  { variant: "default" | "secondary" | "destructive"; label: string }
> = {
  active: { variant: "default", label: "Active" },
  completed: { variant: "secondary", label: "Completed" },
  failed: { variant: "destructive", label: "Failed" },
};

const MODE_COLORS: Record<SwarmMode, string> = {
  gather: "var(--color-gene-green)",
  explore: "var(--color-capsule-blue)",
  specialize: "var(--color-recipe-amber)",
  elect: "var(--color-trust-gold)",
  merge: "var(--color-trust-silver)",
  pool: "var(--color-muted-foreground)",
};

function formatAge(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SwarmTaskCard({ task }: SwarmTaskCardProps) {
  const statusConfig = STATUS_CONFIG[task.status];
  const modeColor = MODE_COLORS[task.mode];

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 transition-shadow hover:shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[var(--color-foreground)]">
            {task.name}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            {task.id}
          </p>
        </div>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </div>

      {/* Mode tag */}
      <div className="mb-3">
        <span
          className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
          style={{
            borderColor: modeColor,
            color: modeColor,
            backgroundColor: `color-mix(in oklab, ${modeColor} 10%, transparent)`,
          }}
        >
          {task.mode}
        </span>
      </div>

      {/* Progress bar */}
      {task.status === "active" && (
        <div className="mb-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-muted-foreground)]">Progress</span>
            <span className="font-medium" style={{ color: "var(--color-gene-green)" }}>
              {task.progress}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full rounded-full transition-all will-change-transform"
              style={{
                transform: `scaleX(${task.progress / 100})`,
                transformOrigin: "left",
                backgroundColor: "var(--color-gene-green)",
              }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span className="flex items-center gap-1">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          {task.participantCount} participants
        </span>
        <span>{formatAge(task.createdAt)}</span>
      </div>
    </div>
  );
}
