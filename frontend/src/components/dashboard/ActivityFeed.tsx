"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";

interface ActivityFeedProps {
  nodeId: string;
}

const FALLBACK_ACTIVITIES = [
  { id: "1", text: "Published Gene 'context-scheduler'", time: "2h ago" },
  { id: "2", text: "Earned 50 credits from downloads", time: "1d ago" },
  { id: "3", text: "Joined Swarm 'code-analysis-team'", time: "3d ago" },
  { id: "4", text: "Published Capsule 'data-parser'", time: "5d ago" },
  { id: "5", text: "Voted on Council proposal #42", time: "1w ago" },
];

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${diffWeeks}w ago`;
  } catch {
    return dateStr;
  }
}

export function ActivityFeed({ nodeId }: ActivityFeedProps) {
  const { data: creditsHistory, isLoading: creditsLoading } = useQuery({
    queryKey: ["credits", "history", nodeId],
    queryFn: () => apiClient.getCreditsHistory(nodeId),
    enabled: !!nodeId,
  });

  const { data: repHistory, isLoading: repLoading } = useQuery({
    queryKey: ["reputation", "history", nodeId],
    queryFn: () => apiClient.getReputationHistory(nodeId),
    enabled: !!nodeId,
  });

  const isLoading = creditsLoading || repLoading;

  const activities = (() => {
    if (isLoading) return null;

    // Merge and sort by date
    const items: { id: string; text: string; time: string; created_at: string }[] = [];

    creditsHistory?.items?.forEach((t) => {
      items.push({
        id: `credit-${t.id}`,
        text: t.description ?? `${t.type === "earn" ? "+" : "-"}${t.amount} credits`,
        time: formatTime(t.created_at),
        created_at: t.created_at,
      });
    });

    repHistory?.items?.forEach((e) => {
      items.push({
        id: `rep-${e.id}`,
        text: e.description ?? `Reputation ${e.delta > 0 ? "+" : ""}${e.delta}`,
        time: formatTime(e.created_at),
        created_at: e.created_at,
      });
    });

    if (items.length === 0) return FALLBACK_ACTIVITIES;

    // Deduplicate by id, sort newest first, take top 5
    const seen = new Set<string>();
    return items
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 5);
  })();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
              Recent Activity
            </p>
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2">
                <Skeleton className="mt-1.5 h-1.5 w-1.5 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-12" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
              Recent Activity
            </p>
          </div>
          <div className="flex items-center gap-1 text-sm text-[var(--color-destructive)]">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Failed to load activity</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
            Recent Activity
          </p>
        </div>
        <ul className="space-y-2.5">
          {activities.map((activity) => (
            <li key={activity.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-gene-green)]" />
              <div className="flex-1">
                <p className="text-[var(--color-card-foreground)]">{activity.text}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{activity.time}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
