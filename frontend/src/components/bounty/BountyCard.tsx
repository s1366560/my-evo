"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type BountyStatus = 'open' | 'claimed' | 'submitted' | 'accepted' | 'disputed' | 'resolved' | 'expired' | 'cancelled';

export interface Bounty {
  bounty_id: string;
  title: string;
  description: string;
  requirements: string[];
  amount: number;
  status: BountyStatus;
  creator_id: string;
  creator_name?: string;
  deadline: string;
  created_at: string;
  submissions_count?: number;
}

const statusConfig: Record<BountyStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Open", variant: "default" },
  claimed: { label: "In Progress", variant: "secondary" },
  submitted: { label: "Submitted", variant: "secondary" },
  accepted: { label: "Completed", variant: "default" },
  disputed: { label: "Disputed", variant: "destructive" },
  resolved: { label: "Resolved", variant: "secondary" },
  expired: { label: "Expired", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatReward(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount}`;
}

function getTimeRemaining(deadline: string): string {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff < 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 30) {
    const months = Math.floor(days / 30);
    return `${months}mo left`;
  }
  if (days > 0) return `${days}d left`;
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h left`;
  
  return `${Math.floor(diff / (1000 * 60))}m left`;
}

interface BountyCardProps {
  bounty: Bounty;
  showCreator?: boolean;
}

export function BountyCard({ bounty, showCreator = false }: BountyCardProps) {
  const status = statusConfig[bounty.status];
  const timeRemaining = getTimeRemaining(bounty.deadline);

  return (
    <Link href={`/bounty/${bounty.bounty_id}`}>
      <article className="group cursor-pointer rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all hover:border-[var(--color-gene-green)] hover:shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant={status.variant}>{status.label}</Badge>
              <span className="text-xs text-[var(--color-muted-foreground)]">{timeRemaining}</span>
            </div>
            <h3 className="mt-2 truncate text-lg font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-gene-green)]">
              {bounty.title}
            </h3>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-bold text-[var(--color-gene-green)]">
              {formatReward(bounty.amount)}
            </p>
            <p className="text-xs text-[var(--color-muted-foreground)]">reward</p>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-[var(--color-muted-foreground)]">
          {bounty.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {bounty.requirements.slice(0, 3).map((req, i) => (
              <span
                key={i}
                className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]"
              >
                {req}
              </span>
            ))}
            {bounty.requirements.length > 3 && (
              <span className="text-xs text-[var(--color-muted-foreground)]">
                +{bounty.requirements.length - 3}
              </span>
            )}
          </div>
          {bounty.submissions_count !== undefined && bounty.submissions_count > 0 && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {bounty.submissions_count} submission{bounty.submissions_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {(showCreator || bounty.creator_name) && (
          <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <div className="h-6 w-6 rounded-full bg-[var(--color-surface-muted)]" />
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {bounty.creator_name || "Anonymous"}
            </span>
            <span className="text-xs text-[var(--color-muted-foreground)]">·</span>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {formatDate(bounty.created_at)}
            </span>
          </div>
        )}
      </article>
    </Link>
  );
}

export function BountyCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="h-5 w-20 animate-pulse rounded bg-[var(--color-surface-muted)]" />
        <div className="h-6 w-16 animate-pulse rounded bg-[var(--color-surface-muted)]" />
      </div>
      <div className="mt-3 h-6 w-3/4 animate-pulse rounded bg-[var(--color-surface-muted)]" />
      <div className="mt-3 h-4 w-full animate-pulse rounded bg-[var(--color-surface-muted)]" />
      <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-[var(--color-surface-muted)]" />
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--color-surface-muted)]" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-[var(--color-surface-muted)]" />
      </div>
    </div>
  );
}
