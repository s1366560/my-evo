"use client";

import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { WorkerCard } from "@/components/workerpool/WorkerCard";
import { WorkerFilter } from "@/components/workerpool/WorkerFilter";
import { Skeleton } from "@/components/ui/skeleton";

// Mock worker data
const allWorkers = [
  {
    id: "worker-001",
    name: "Alice Chen",
    expertise: ["NLP", "Text Classification", "Sentiment Analysis"],
    rating: 4.8,
    completedTasks: 312,
    availability: "available" as const,
    hourlyRate: 45,
  },
  {
    id: "worker-002",
    name: "Bob Martinez",
    expertise: ["Security", "Penetration Testing", "Vulnerability Assessment"],
    rating: 4.9,
    completedTasks: 278,
    availability: "busy" as const,
    hourlyRate: 60,
  },
  {
    id: "worker-003",
    name: "Carol Kim",
    expertise: ["Computer Vision", "Object Detection", "Image Processing"],
    rating: 4.6,
    completedTasks: 189,
    availability: "available" as const,
    hourlyRate: 50,
  },
  {
    id: "worker-004",
    name: "David Lee",
    expertise: ["Reasoning", "Planning", "Agent Architecture"],
    rating: 4.7,
    completedTasks: 421,
    availability: "available" as const,
    hourlyRate: 55,
  },
  {
    id: "worker-005",
    name: "Emma Wilson",
    expertise: ["Memory Systems", "Graph Databases", "Knowledge Graphs"],
    rating: 4.5,
    completedTasks: 156,
    availability: "busy" as const,
    hourlyRate: 40,
  },
  {
    id: "worker-006",
    name: "Frank Brown",
    expertise: ["API Design", "Rate Limiting", "Load Balancing"],
    rating: 4.3,
    completedTasks: 98,
    availability: "available" as const,
    hourlyRate: 35,
  },
  {
    id: "worker-007",
    name: "Grace Taylor",
    expertise: ["NLP", "Machine Translation", "Text Summarization"],
    rating: 4.9,
    completedTasks: 503,
    availability: "available" as const,
    hourlyRate: 65,
  },
  {
    id: "worker-008",
    name: "Henry Johnson",
    expertise: ["Swarm Coordination", "Multi-Agent Systems", "Distributed AI"],
    rating: 4.8,
    completedTasks: 267,
    availability: "busy" as const,
    hourlyRate: 70,
  },
];

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

export default function WorkerPoolPage() {
  const [filters, setFilters] = useState<FilterState>({
    expertise: "All",
    availability: "All",
    minRating: 0,
  });

  const filteredWorkers = allWorkers.filter((w) => {
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

  const availableCount = allWorkers.filter((w) => w.availability === "available").length;

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

        {/* Results count */}
        <div className="text-sm text-[var(--color-muted-foreground)]">
          Showing {filteredWorkers.length} of {allWorkers.length} workers
        </div>

        {/* Worker grid */}
        {filteredWorkers.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredWorkers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} />
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
