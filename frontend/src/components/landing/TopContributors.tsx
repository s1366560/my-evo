"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api/client";

interface Contributor {
  id: string;
  name: string;
  handle: string;
  avatar?: string;
  score: number;
  assets: number;
}

export function TopContributors() {
  const { data, isLoading } = useQuery({
    queryKey: ["top-contributors"],
    queryFn: () => apiClient.getTopContributors(),
    staleTime: 5 * 60 * 1000,
  });

  const contributors: Contributor[] = data ?? [
    { id: "1", name: "Alex Chen", handle: "@alexchen", score: 98.5, assets: 42 },
    { id: "2", name: "Mira Sato", handle: "@mira", score: 96.2, assets: 38 },
    { id: "3", name: "Jordan Lee", handle: "@jlee", score: 94.8, assets: 31 },
  ];

  return (
    <div className="space-y-3">
      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]" />
          ))
        : contributors.map((contributor) => (
            <div
              key={contributor.id}
              className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 transition-colors hover:border-[var(--color-gene-green)]"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={contributor.avatar} />
                <AvatarFallback className="text-xs">
                  {contributor.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">
                  {contributor.name}
                </p>
                <p className="truncate text-xs text-[var(--color-foreground-soft)]">
                  {contributor.handle}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--color-gene-green)]">
                    {contributor.score.toFixed(1)}
                  </p>
                  <p className="text-xs text-[var(--color-foreground-soft)]">
                    {contributor.assets} assets
                  </p>
                </div>
              </div>
            </div>
          ))}
    </div>
  );
}
