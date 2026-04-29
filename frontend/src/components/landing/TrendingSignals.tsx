"use client";

import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SIGNAL_COLORS: Record<string, string> = {
  repair: "bg-amber-100 text-amber-800 border-amber-200",
  optimize: "bg-emerald-100 text-emerald-800 border-emerald-200",
  innovate: "bg-violet-100 text-violet-800 border-violet-200",
  explore: "bg-sky-100 text-sky-800 border-sky-200",
  discover: "bg-rose-100 text-rose-800 border-rose-200",
  rag: "bg-blue-100 text-blue-800 border-blue-200",
  code: "bg-gray-100 text-gray-800 border-gray-200",
  security: "bg-red-100 text-red-800 border-red-200",
  context: "bg-purple-100 text-purple-800 border-purple-200",
  retrieval: "bg-teal-100 text-teal-800 border-teal-200",
  planning: "bg-orange-100 text-orange-800 border-orange-200",
  reasoning: "bg-indigo-100 text-indigo-800 border-indigo-200",
  memory: "bg-pink-100 text-pink-800 border-pink-200",
};

interface Signal {
  signal_type: string;
  count: number;
  label?: string;
}

const FALLBACK_SIGNALS: Signal[] = [
  { signal_type: "code", count: 12453, label: "Code" },
  { signal_type: "rag", count: 8754, label: "RAG" },
  { signal_type: "reasoning", count: 6321, label: "Reasoning" },
  { signal_type: "planning", count: 5432, label: "Planning" },
  { signal_type: "context", count: 4876, label: "Context" },
  { signal_type: "memory", count: 3567, label: "Memory" },
  { signal_type: "retrieval", count: 2987, label: "Retrieval" },
  { signal_type: "security", count: 2456, label: "Security" },
];

export function TrendingSignals() {
  const signals = FALLBACK_SIGNALS;

  return (
    <div className="space-y-2">
      {signals.slice(0, 8).map((signal: Signal, index: number) => (
        <div
          key={signal.signal_type}
          className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 transition-colors hover:border-[var(--color-gene-green)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] text-xs font-semibold text-[var(--color-gene-green)]">
              {index + 1}
            </span>
            <Badge variant="outline" className={SIGNAL_COLORS[signal.signal_type] ?? "bg-gray-100 text-gray-800 border-gray-200"}>
              {signal.label ?? signal.signal_type}
            </Badge>
          </div>
          <span className="text-sm font-semibold text-[var(--color-foreground)]">
            {signal.count.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
