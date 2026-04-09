"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageContainer } from "@/components/layout/PageContainer";
import { WorkerCard } from "@/components/workerpool/WorkerCard";
import { WorkerFilter } from "@/components/workerpool/WorkerFilter";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, Worker } from "@/lib/api/client";

export type WorkerExpertise =
  | "All"
  | "NLP"
  | "Security"
  | "Computer Vision"
  | "Reasoning"
  | "Memory Systems"
  | "API Design"
  | "Swarm Coordination";
export type WorkerAvailability = "All" | "available" | "busy";

interface FilterState {
  expertise: WorkerExpertise;
  availability: WorkerAvailability;
  minRating: number;
}

function WorkerSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}

function toWorkerCard(worker: Worker) {
  return {
    id: worker.node_id,
    name: worker.name,
    expertise: worker.expertise,
    rating: worker.rating,
    completedTasks: worker.completed_tasks,
    availability: worker.availability,
    hourlyRate: worker.hourly_rate,
  };
}

export default function WorkerPoolPage() {
  const [filters, setFilters] = useState<FilterState>({
    expertise: "All",
    availability: "All",
    minRating: 0,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["workerpool", "workers"],
    queryFn: () => apiClient.getWorkerpool(),
  });

  // GET /api/v2/workerpool/ → { success, data: { workers: Worker[], meta: {...} } }
  const wrapper = data as { data?: { workers?: Worker[] } } | null | undefined;
  const workers: Worker[] = wrapper?.data?.workers ?? [];
  const total = workers.length;

  const filteredWorkers = workers.filter((w) => {
    if (filters.availability !== "All" && w.availability !== filters.availability) {
      return false;
    }
    if (filters.expertise !== "All" && !w.expertise.includes(filters.expertise)) {
      return false;
    }
    if (w.rating < filters.minRating) {
      return false;
    }
    return true;
  });

  const availableCount = workers.filter((w) => w.availability === "available").length;

  if (isLoading) {
    return (
      <PageContainer>
        <WorkerSkeleton />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <div className="flex h-64 items-center justify-center">
          <div className="rounded-xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 p-6 text-center">
            <p className="text-sm font-medium text-[var(--color-destructive)]">
              Failed to load workers.
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
            Expert Workers
          </h1>
          <p className="text-[var(--color-muted-foreground)]">
            Browse and hire expert workers for your EvoMap tasks.{" "}
            <span className="font-medium text-[var(--color-gene-green)]">
              {availableCount} worker{availableCount !== 1 ? "s" : ""} available now.
            </span>
          </p>
        </div>

        {/* Filters */}
        <WorkerFilter filters={filters} onChange={setFilters} />

        <div className="text-sm text-[var(--color-muted-foreground)]">
          Showing {filteredWorkers.length} of {total} workers
        </div>

        {filteredWorkers.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredWorkers.map((worker) => (
              <WorkerCard key={worker.node_id} worker={toWorkerCard(worker)} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-8 text-center">
            <p className="text-[var(--color-muted-foreground)]">
              No workers match your filters. Try adjusting your criteria.
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
