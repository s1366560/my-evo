"use client";

import { useState } from "react";
import { ChevronDown, Filter, Search } from "lucide-react";
import { BountyCard } from "@/components/bounty/BountyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface BountyListProps {
  bounties?: Array<{
    id: string;
    title: string;
    description: string;
    reward: number;
    deadline: string;
    difficulty: "easy" | "medium" | "hard";
    status: "open" | "in_progress" | "closed";
    tags: string[];
    author: { name: string; avatar?: string };
    submissionsCount?: number;
  }>;
  showSearch?: boolean;
  showFilters?: boolean;
  showCreator?: boolean;
  emptyMessage?: string;
}

export function BountyList({
  bounties = [],
  showSearch = true,
  showFilters = true,
  showCreator = false,
  emptyMessage = "No bounties found matching your criteria.",
}: BountyListProps) {
  const [search, setSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);

  const filtered = bounties.filter((bounty) => {
    const matchesSearch = bounty.title.toLowerCase().includes(search.toLowerCase()) ||
      bounty.description.toLowerCase().includes(search.toLowerCase());
    const matchesDifficulty = !selectedDifficulty || bounty.difficulty === selectedDifficulty;
    return matchesSearch && matchesDifficulty;
  });

  return (
    <div className="space-y-6">
      {(showSearch || showFilters) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {showSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-foreground-soft)]" />
              <Input
                placeholder="Search bounties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {showFilters && (
            <div className="flex gap-2">
              {["easy", "medium", "hard"].map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={selectedDifficulty === d ? "default" : "outline"}
                  onClick={() => setSelectedDifficulty(selectedDifficulty === d ? null : d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-12 text-center">
          <p className="text-sm text-[var(--color-foreground-soft)]">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} />
          ))}
        </div>
      )}
    </div>
  );
}
