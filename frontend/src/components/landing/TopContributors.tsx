"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name
    .split(/[-_ ]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function TopContributorsSkeleton() {
  return (
    <div className="evomap-shell p-5 sm:p-6">
      <div className="relative z-[1] space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
    </div>
  );
}

export function TopContributors() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["a2a", "assets", "ranked"],
    queryFn: () => apiClient.getAssetsRanked(),
  });

  if (isLoading) return <TopContributorsSkeleton />;

  const authorMap = new Map<string, { name: string; count: number; score: number }>();
  for (const asset of data ?? []) {
    const author = asset.author_name ?? asset.author_id;
    const score = typeof asset.gdi_score === "number" ? asset.gdi_score : asset.gdi_score.overall;
    const existing = authorMap.get(author);
    if (existing) {
      existing.count += 1;
      existing.score = Math.max(existing.score, score);
    } else {
      authorMap.set(author, { name: author, count: 1, score });
    }
  }

  const topAuthors = Array.from(authorMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="evomap-shell p-5 sm:p-6">
      <div className="relative z-[1] space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-soft)]">
            Contribution board
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-foreground-soft)]">
            Rank is inferred from best observed GDI performance and repeat contributions to the shared asset graph.
          </p>
        </div>

        {isError ? (
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-[var(--color-foreground-soft)]">
            Contributor standings are temporarily delayed. Merit signals will reappear once ranked assets finish loading.
          </div>
        ) : topAuthors.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--color-border-strong)] px-4 py-8 text-center text-sm text-[var(--color-foreground-soft)]">
            No contributors yet. Publish a trusted asset to establish the first visible reputation trail.
          </div>
        ) : (
          <div className="space-y-2">
            {topAuthors.map((author, index) => (
              <div key={author.name} className="flex items-center gap-4 rounded-3xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-background-elevated)_80%,transparent)] px-4 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-sm font-semibold text-[var(--color-foreground)]">
                  {index + 1}
                </div>
                <Avatar.Root className="h-11 w-11">
                  <Avatar.Fallback
                    className={cn(
                      "text-sm font-semibold",
                      index === 0
                        ? "bg-[color-mix(in_oklab,var(--color-trust-gold)_18%,transparent)] text-[color-mix(in_oklab,var(--color-trust-gold)_82%,black)] dark:text-[var(--color-trust-gold)]"
                        : "bg-[var(--color-surface-muted)] text-[var(--color-foreground)]",
                    )}
                  >
                    {getInitials(author.name)}
                  </Avatar.Fallback>
                </Avatar.Root>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">{author.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-foreground-soft)]">
                    {author.count} published asset{author.count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 text-[var(--color-gene-green)]">
                    {index === 0 ? <BadgeCheck className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    <span className="text-sm font-semibold">{author.score.toFixed(1)}</span>
                  </div>
                  <div className="mt-1">
                    <Badge variant={index === 0 ? "gene" : "outline"}>{index === 0 ? "Highest signal" : "Trusted builder"}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
