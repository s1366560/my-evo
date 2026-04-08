"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Worker {
  id: string;
  name: string;
  expertise: string[];
  rating: number;
  completedTasks: number;
  availability: "available" | "busy";
  hourlyRate: number;
}

interface WorkerCardProps {
  worker: Worker;
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <span className="inline-flex items-center gap-0.5 text-sm">
      {Array.from({ length: full }).map((_, i) => (
        <span key={`f-${i}`} className="text-amber-400">
          ★
        </span>
      ))}
      {half && <span className="text-amber-400">★</span>}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e-${i}`} className="text-[var(--color-border)]">
          ☆
        </span>
      ))}
      <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

export function WorkerCard({ worker }: WorkerCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 transition-shadow hover:shadow-sm"
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--color-foreground)]">
              {worker.name}
            </h3>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                worker.availability === "available"
                  ? "bg-[var(--color-gene-green)]"
                  : "bg-[var(--color-muted-foreground)]"
              }`}
              title={worker.availability === "available" ? "Available" : "Busy"}
            />
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            {worker.id}
          </p>
        </div>
      </div>

      {/* Availability badge */}
      <div className="mb-3">
        <Badge
          variant={worker.availability === "available" ? "default" : "secondary"}
        >
          {worker.availability === "available" ? "Available" : "Busy"}
        </Badge>
      </div>

      {/* Expertise tags */}
      <div className="mb-3 flex flex-wrap gap-1">
        {worker.expertise.slice(0, expanded ? undefined : 2).map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px]">
            {tag}
          </Badge>
        ))}
        {!expanded && worker.expertise.length > 2 && (
          <Badge variant="outline" className="text-[10px]">
            +{worker.expertise.length - 2}
          </Badge>
        )}
      </div>

      {/* Rating and stats */}
      <div className="space-y-2">
        <StarRating rating={worker.rating} />
        <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
          <span>{worker.completedTasks} tasks completed</span>
          <span className="font-medium text-[var(--color-foreground)]">
            ${worker.hourlyRate}/hr
          </span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-xs">
          <div className="mb-2 font-medium text-[var(--color-foreground)]">
            Full Expertise
          </div>
          <div className="flex flex-wrap gap-1">
            {worker.expertise.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Expand hint */}
      <div className="mt-3 text-center text-[10px] text-[var(--color-muted-foreground)]">
        {expanded ? "Click to collapse" : "Click for details"}
      </div>
    </div>
  );
}
