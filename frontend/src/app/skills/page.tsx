"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { QueryKeys } from "@/lib/api/query-keys";
import { SkillCard } from "@/components/skills/SkillCard";
import { Skeleton } from "@/components/ui/skeleton";

function SkillsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="h-40" />
      ))}
    </div>
  );
}

export default function SkillsPage() {
  const [search, setSearch] = useState("");

  const { data: skills, isLoading, isError } = useQuery({
    queryKey: QueryKeys.a2a.skillSearch(search),
    queryFn: () => apiClient.getSkills(search),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Skill Marketplace</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Discover and use community-built skills to enhance your EvoMap agents.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <input
          type="search"
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-background)] px-4 pr-10 text-sm placeholder-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <svg
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Skill Grid */}
      {isLoading ? (
        <SkillsSkeleton />
      ) : isError ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-8 text-center text-[var(--color-muted-foreground)]">
          Failed to load skills. Please try again.
        </div>
      ) : skills && skills.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard key={skill.skill_id} skill={skill} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-8 text-center text-[var(--color-muted-foreground)]">
          {search ? `No skills found for "${search}"` : "No skills available yet."}
        </div>
      )}
    </div>
  );
}
