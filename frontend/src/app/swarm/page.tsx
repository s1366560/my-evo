"use client";

import { useQuery } from "@tanstack/react-query";
import { PageContainer } from "@/components/layout/PageContainer";
import { SwarmTaskCard } from "@/components/swarm/SwarmTaskCard";
import { SwarmSessionTimeline } from "@/components/swarm/SwarmSessionTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { QueryKeys } from "@/lib/api/query-keys";
import type { SwarmMode } from "@/components/swarm/SwarmTaskCard";

export default function SwarmPage() {
  const { data: swarmData, isLoading, isError } = useQuery({
    queryKey: QueryKeys.swarm.list(),
    queryFn: () => apiClient.getSwarmTasks(),
  });

  const swarms = swarmData?.swarms ?? [];

  const activeSwarms = swarms.filter((s) => s.status === "active");
  const completedSwarms = swarms.filter((s) => s.status === "completed");
  const failedSwarms = swarms.filter((s) => s.status === "failed");

  const tasks = swarms.map((s) => ({
    id: s.swarm_id,
    name: s.name,
    status: s.status,
    participantCount: s.participant_count,
    mode: s.mode as SwarmMode,
    createdAt: s.created_at,
    progress: s.progress ?? 0,
  }));

  // Derive session timeline from real swarm data
  const timelineData = swarms.length > 0
    ? swarms.slice(0, 30).map((s, i) => ({
        hour: Math.floor((i / Math.max(swarms.length, 1)) * 24),
        participants: s.participant_count,
        tasks: Math.max(1, Math.round(s.participant_count * 0.4)),
      }))
    : [];

  // Loading state
  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div>
            <Skeleton className="mb-2 h-9 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
        </div>
      </PageContainer>
    );
  }

  // Error state
  if (isError) {
    return (
      <PageContainer>
        <div className="flex h-64 items-center justify-center">
          <div className="rounded-xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 p-6 text-center">
            <p className="text-sm font-medium text-[var(--color-destructive)]">
              Failed to load swarm data.
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Please try refreshing the page.
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="mb-1 text-3xl font-bold text-[var(--color-foreground)]">
            Active Swarms
          </h1>
          <p className="text-[var(--color-muted-foreground)]">
            Multi-agent collaboration sessions in the EvoMap ecosystem.{" "}
            <span className="font-medium text-[var(--color-gene-green)]">
              {activeSwarms.length} active swarm{activeSwarms.length !== 1 ? "s" : ""} detected.
            </span>
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatPill label="Active" value={activeSwarms.length} color="var(--color-gene-green)" />
          <StatPill label="Completed" value={completedSwarms.length} color="var(--color-capsule-blue)" />
          <StatPill
            label="Total Participants"
            value={swarms.reduce((s, t) => s + t.participant_count, 0)}
            color="var(--color-recipe-amber)"
          />
          <StatPill
            label="Failed"
            value={failedSwarms.length}
            color="var(--color-destructive)"
          />
        </div>

        {/* Task cards grid */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
            Swarm Tasks
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          ) : tasks.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tasks.map((task) => (
                <SwarmTaskCard key={task.id} task={task} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-8 text-center text-[var(--color-muted-foreground)]">
              No swarm tasks available yet.
            </div>
          )}
        </div>

        {/* Session timeline */}
        {timelineData.length > 0 && (
          <SwarmSessionTimeline data={timelineData} />
        )}
      </div>
    </PageContainer>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 text-center">
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
    </div>
  );
}
