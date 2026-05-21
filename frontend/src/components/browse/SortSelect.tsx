"use client";

import { ChevronDown } from "lucide-react";

export type AssetSort = "trending" | "newest" | "gdi" | "downloads" | "relevance" | "gdi_desc";

interface SortSelectProps {
  value: string;
  onChange: (value: AssetSort) => void;
}

const SORT_OPTIONS: { value: AssetSort; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "gdi", label: "GDI Score" },
  { value: "downloads", label: "Most Downloaded" },
];

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AssetSort)}
        className="appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 pr-8 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gene-green)]"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-foreground-soft)]" />
    </div>
  );
}
