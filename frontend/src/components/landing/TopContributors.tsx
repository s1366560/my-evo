"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name
    .split(/[-_ ]/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function TopContributorsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--color-border)]" />
          <div className="h-4 flex-1 animate-pulse rounded bg-[var(--color-border)]/30" />
        </div>
      ))}
    </div>
  );
}

export function TopContributors() {
  const { data, isLoading } = useQuery({
    queryKey: ["a2a", "assets", "ranked"],
    queryFn: () => apiClient.getAssetsRanked(),
  });

  if (isLoading) return <TopContributorsSkeleton />;

  // Aggregate top authors from ranked assets
  const authorMap = new Map<string, { name: string; count: number; score: number }>();
  for (const asset of data?.assets ?? []) {
    const author = asset.author_name ?? asset.author_id;
    const score =
      typeof asset.gdi_score === "number"
        ? asset.gdi_score
        : asset.gdi_score.overall;
    const existing = authorMap.get(author);
    if (!existing) {
      authorMap.set(author, { name: author, count: 1, score });
    } else {
      existing.count += 1;
      existing.score = Math.max(existing.score, score);
    }
  }

  const topAuthors = Array.from(authorMap.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">
        Top Contributors
      </h2>
      <div className="space-y-2">
        {topAuthors.map(([author, info], index) => (
          <div
            key={author}
            className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-[var(--color-border)]"
          >
            <span className="w-5 text-center text-sm font-medium tabular-nums text-[var(--color-muted-foreground)]">
              {index + 1}
            </span>
            <Avatar.Root className="h-8 w-8">
              <Avatar.Fallback
                className={cn(
                  "text-xs font-medium",
                  index === 0 && "bg-[var(--color-trust-gold)]/20 text-[var(--color-trust-gold)]"
                )}
              >
                {getInitials(info.name)}
              </Avatar.Fallback>
            </Avatar.Root>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium text-[var(--color-foreground)]">
                {info.name}
              </span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {info.count} asset{info.count !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="text-right">
              <span
                className="text-sm font-bold tabular-nums text-[var(--color-gene-green)]"
                style={{
                  color:
                    info.score >= 90
                      ? "var(--color-gene-green)"
                      : info.score >= 80
                        ? "var(--color-capsule-blue)"
                        : "var(--color-recipe-amber)",
                }}
              >
                {info.score}
              </span>
              <div className="text-xs text-[var(--color-muted-foreground)]">GDI</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
