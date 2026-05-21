"use client";

import { useState, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { BountyStatus } from "@/lib/api/client";

const STATUS_OPTIONS: { value: BountyStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "open", label: "Open" },
  { value: "claimed", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "accepted", label: "Completed" },
  { value: "disputed", label: "Disputed" },
  { value: "expired", label: "Expired" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "reward_desc", label: "Highest Reward" },
  { value: "reward_asc", label: "Lowest Reward" },
  { value: "deadline", label: "Deadline Soon" },
];

interface BountyFiltersProps {
  onStatusChange?: (status: BountyStatus | "all") => void;
  onSortChange?: (sort: string) => void;
  onSearchChange?: (search: string) => void;
  defaultStatus?: BountyStatus | "all";
  defaultSort?: string;
  showSearch?: boolean;
}

export function BountyFilters({
  onStatusChange,
  onSortChange,
  onSearchChange,
  defaultStatus = "all",
  defaultSort = "newest",
  showSearch = true,
}: BountyFiltersProps) {
  const [status, setStatus] = useState<BountyStatus | "all">(defaultStatus);
  const [sort, setSort] = useState(defaultSort);
  const [search, setSearch] = useState("");

  const handleStatusChange = useCallback((value: string) => {
    setStatus(value as BountyStatus | "all");
    onStatusChange?.(value as BountyStatus | "all");
  }, [onStatusChange]);

  const handleSortChange = useCallback((value: string) => {
    setSort(value);
    onSortChange?.(value);
  }, [onSortChange]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      onSearchChange?.(value);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [onSearchChange]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showSearch && (
        <div className="flex-1 min-w-[200px]">
          <Input
            type="search"
            placeholder="Search bounties..."
            value={search}
            onChange={handleSearchChange}
            className="w-full"
          />
        </div>
      )}

      <Select value={status} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
