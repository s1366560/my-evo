"use client";

import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { type Bounty } from "@/lib/api/client";
import { formatReward, getTimeRemaining } from "./types";

// Primary featured card with full details
export function FeaturedBountyCard({ bounty }: { bounty: Bounty }) {
  return (
    <Link href={`/bounty/${bounty.bounty_id}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-gene-green)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-muted)] p-6 transition-all hover:shadow-[0_0_24px_rgba(34,197,94,0.15)]">
        <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-[var(--color-gene-green)]/10 px-3 py-1">
          <Star className="h-3 w-3 fill-[var(--color-gene-green)] text-[var(--color-gene-green)]" />
          <span className="text-xs font-semibold text-[var(--color-gene-green)]">Featured</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[var(--color-gene-green)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--color-gene-green)]">
                {bounty.status}
              </span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {getTimeRemaining(bounty.deadline)}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-bold text-[var(--color-foreground)] group-hover:text-[var(--color-gene-green)]">
              {bounty.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              {bounty.description}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-bold text-[var(--color-gene-green)]">
              {formatReward(bounty.amount)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">reward</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {bounty.requirements.slice(0, 4).map((req, i) => (
            <span key={i} className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-muted-foreground)]">
              {req}
            </span>
          ))}
          {bounty.requirements.length > 4 && (
            <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-muted-foreground)]">
              +{bounty.requirements.length - 4} more
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
            {bounty.creator_name && <><span>{bounty.creator_name}</span><span>·</span></>}
            <span>{bounty.submissions_count ?? 0} submission{(bounty.submissions_count ?? 0) !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-[var(--color-gene-green)]">
            View details <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

// Compact secondary featured card for grid
export function SecondaryFeaturedCard({ bounty }: { bounty: Bounty }) {
  return (
    <Link href={`/bounty/${bounty.bounty_id}`} className="group block">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all hover:border-[var(--color-gene-green)]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Star className="h-3 w-3 fill-[var(--color-gene-green)] text-[var(--color-gene-green)]" />
            <span className="text-xs font-medium text-[var(--color-gene-green)]">Featured</span>
          </div>
          <p className="mt-1.5 truncate text-sm font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-gene-green)]">
            {bounty.title}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-[var(--color-muted-foreground)]">
            {bounty.description}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-[var(--color-gene-green)]">{formatReward(bounty.amount)}</p>
        </div>
      </div>
    </Link>
  );
}
