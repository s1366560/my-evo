"use client";

import { cn } from "@/lib/utils";
import type { WorkerAvailability, WorkerExpertise } from "@/app/workerpool/page";

interface FilterState {
  expertise: WorkerExpertise;
  availability: WorkerAvailability;
  minRating: number;
}

interface WorkerFilterProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const EXPERTISE_OPTIONS: WorkerExpertise[] = [
  "All",
  "NLP",
  "Security",
  "Computer Vision",
  "Reasoning",
  "Memory Systems",
  "API Design",
  "Swarm Coordination",
];

const AVAILABILITY_OPTIONS: { value: WorkerAvailability; label: string }[] = [
  { value: "All", label: "All" },
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
];

export function WorkerFilter({ filters, onChange }: WorkerFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-4">
      {/* Expertise */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
          Expertise
        </label>
        <select
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-input-background)] px-3 py-1.5 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          value={filters.expertise}
          onChange={(e) =>
            onChange({ ...filters, expertise: e.target.value as WorkerExpertise })
          }
        >
          {EXPERTISE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* Availability */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
          Availability
        </label>
        <div className="flex rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-0.5">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                filters.availability === opt.value
                  ? "bg-[var(--color-gene-green)] text-white"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              )}
              onClick={() => onChange({ ...filters, availability: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Min rating */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
          Min Rating:{" "}
          <span className="text-[var(--color-foreground)]">
            {filters.minRating === 0 ? "Any" : `${filters.minRating} ★`}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={5}
          step={0.5}
          value={filters.minRating}
          onChange={(e) =>
            onChange({ ...filters, minRating: parseFloat(e.target.value) })
          }
          className="h-1.5 w-32 cursor-pointer rounded-full accent-[var(--color-gene-green)]"
        />
      </div>

      {/* Reset */}
      {(filters.expertise !== "All" ||
        filters.availability !== "All" ||
        filters.minRating > 0) && (
        <div className="ml-auto flex items-end">
          <button
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-foreground)] hover:text-[var(--color-foreground)]"
            onClick={() =>
              onChange({
                expertise: "All",
                availability: "All",
                minRating: 0,
              })
            }
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
