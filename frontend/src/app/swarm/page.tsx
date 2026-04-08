"use client";

import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SwarmTaskCard } from "@/components/swarm/SwarmTaskCard";
import { SwarmSessionTimeline } from "@/components/swarm/SwarmSessionTimeline";
import { Skeleton } from "@/components/ui/skeleton";

// Mock swarm task data
const mockSwarmTasks = [
  {
    id: "swarm-001",
    name: "Security Audit Pipeline",
    status: "active" as const,
    participantCount: 5,
    mode: "gather" as const,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    progress: 68,
  },
  {
    id: "swarm-002",
    name: "NLP Text Classification",
    status: "active" as const,
    participantCount: 8,
    mode: "explore" as const,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    progress: 42,
  },
  {
    id: "swarm-003",
    name: "Vision Model Benchmark",
    status: "completed" as const,
    participantCount: 3,
    mode: "elect" as const,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    progress: 100,
  },
  {
    id: "swarm-004",
    name: "Reasoning Agent Stack",
    status: "active" as const,
    participantCount: 12,
    mode: "specialize" as const,
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    progress: 25,
  },
  {
    id: "swarm-005",
    name: "API Rate Limiter",
    status: "failed" as const,
    participantCount: 2,
    mode: "pool" as const,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    progress: 0,
  },
  {
    id: "swarm-006",
    name: "Memory Graph Indexer",
    status: "completed" as const,
    participantCount: 4,
    mode: "merge" as const,
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    progress: 100,
  },
];

// Mock timeline: 30 data points over 24 hours
const mockTimeline = Array.from({ length: 30 }, (_, i) => {
  const hour = Math.floor((i / 30) * 24);
  const participants = Math.max(
    0,
    Math.round(8 + 6 * Math.sin((i / 30) * Math.PI * 2 + 1) + (Math.random() - 0.5) * 4)
  );
  return {
    hour,
    participants,
    tasks: Math.max(1, Math.round(participants * 0.4)),
  };
});

function SwarmSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <Skeleton className="h-[300px]" />
    </div>
  );
}

export default function SwarmPage() {
  const [isLoading] = useState(true);

  if (isLoading) {
    return (
      <PageContainer>
        <SwarmSkeleton />
      </PageContainer>
    );
  }

  const activeTasks = mockSwarmTasks.filter((t) => t.status === "active");
  const completedTasks = mockSwarmTasks.filter((t) => t.status === "completed");

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
              {activeTasks.length} active swarm{activeTasks.length !== 1 ? "s" : ""} detected.
            </span>
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatPill label="Active" value={activeTasks.length} color="var(--color-gene-green)" />
          <StatPill label="Completed" value={completedTasks.length} color="var(--color-capsule-blue)" />
          <StatPill
            label="Total Participants"
            value={mockSwarmTasks.reduce((s, t) => s + t.participantCount, 0)}
            color="var(--color-recipe-amber)"
          />
          <StatPill
            label="Failed"
            value={mockSwarmTasks.filter((t) => t.status === "failed").length}
            color="var(--color-destructive)"
          />
        </div>

        {/* Task cards grid */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
            Swarm Tasks
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockSwarmTasks.map((task) => (
              <SwarmTaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>

        {/* Session timeline */}
        <SwarmSessionTimeline data={mockTimeline} />
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
