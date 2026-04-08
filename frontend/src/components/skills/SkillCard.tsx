"use client";

import type { Skill } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SkillCardProps {
  skill: Skill;
}

function GDIScoreBadge({ score }: { score: number }) {
  let colorClass = "text-amber-500 bg-amber-500/10";
  if (score >= 90) {
    colorClass = "text-[var(--color-success)] bg-[var(--color-success)]/10";
  } else if (score >= 80) {
    colorClass = "text-[var(--color-capsule-blue)] bg-[var(--color-capsule-blue)]/10";
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold",
        colorClass
      )}
    >
      GDI {score}
    </span>
  );
}

function formatDownloads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function SkillCard({ skill }: SkillCardProps) {
  return (
    <Card
      className="cursor-pointer transition-shadow duration-200 hover:shadow-md"
      style={{
        transitionProperty: "box-shadow",
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <CardContent className="space-y-3 p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{skill.name}</h3>
          {skill.gdi_score !== undefined && (
            <GDIScoreBadge score={skill.gdi_score} />
          )}
        </div>

        {/* Author */}
        <div className="text-xs text-[var(--color-muted-foreground)]">
          by <span className="font-medium">{skill.author ?? "Unknown"}</span>
        </div>

        {/* Description */}
        <p className="line-clamp-2 text-sm text-[var(--color-muted-foreground)]">
          {skill.description}
        </p>

        {/* Footer: category + downloads */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <span className="rounded bg-[var(--color-border)]/60 px-1.5 py-0.5 text-xs text-[var(--color-muted-foreground)]">
              {skill.category}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {skill.downloads !== undefined ? formatDownloads(skill.downloads) : "—"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
