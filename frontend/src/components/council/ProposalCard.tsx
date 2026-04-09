"use client";

import { VotePanel } from "@/components/council/VotePanel";
import { cn } from "@/lib/utils";

type ProposalStatus = "draft" | "active" | "passed" | "rejected";

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  author: string;
  createdAt: string;
}

const statusConfig: Record<
  ProposalStatus,
  { label: string; color: string; bg: string }
> = {
  draft: {
    label: "Draft",
    color: "text-[var(--color-muted-foreground)]",
    bg: "bg-[var(--color-muted-foreground)]/10",
  },
  active: {
    label: "Active",
    color: "text-[var(--color-capsule-blue)]",
    bg: "bg-[var(--color-capsule-blue)]/10",
  },
  passed: {
    label: "Passed",
    color: "text-[var(--color-success)]",
    bg: "bg-[var(--color-success)]/10",
  },
  rejected: {
    label: "Rejected",
    color: "text-[var(--color-destructive)]",
    bg: "bg-[var(--color-destructive)]/10",
  },
};

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { label, color, bg } = statusConfig[proposal.status];
  const total = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;

  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: info */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{proposal.title}</h3>
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                bg,
                color
              )}
            >
              {label}
            </span>
          </div>
          <p
            className="line-clamp-2 text-sm text-[var(--color-muted-foreground)]"
            title={proposal.description}
          >
            {proposal.description}
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            By <span className="font-medium">{proposal.author}</span> &middot;{" "}
            {proposal.createdAt}
          </p>
        </div>

        {/* Right: vote panel */}
        <div className="sm:w-48">
          <VotePanel
            proposalId={proposal.id}
            status={proposal.status}
            votesFor={proposal.votesFor}
            votesAgainst={proposal.votesAgainst}
          />
        </div>
      </div>

      {/* Vote tally bars */}
      {total > 0 && (
        <div className="mt-4 space-y-1">
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
            {proposal.votesFor > 0 && (
              <div
                className="bg-[var(--color-success)]"
                style={{ width: `${pct(proposal.votesFor)}%` }}
                title={`For: ${proposal.votesFor} (${pct(proposal.votesFor)}%)`}
              />
            )}
            {proposal.votesAgainst > 0 && (
              <div
                className="bg-[var(--color-destructive)]"
                style={{ width: `${pct(proposal.votesAgainst)}%` }}
                title={`Against: ${proposal.votesAgainst} (${pct(proposal.votesAgainst)}%)`}
              />
            )}
            {proposal.votesAbstain > 0 && (
              <div
                className="bg-[var(--color-muted-foreground)]"
                style={{ width: `${pct(proposal.votesAbstain)}%` }}
                title={`Abstain: ${proposal.votesAbstain} (${pct(proposal.votesAbstain)}%)`}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
            <span>
              <span className="text-[var(--color-success)]">{proposal.votesFor}</span> For
            </span>
            <span>
              <span className="text-[var(--color-destructive)]">{proposal.votesAgainst}</span>{" "}
              Against
            </span>
            <span>
              <span className="text-[var(--color-muted-foreground)]">{proposal.votesAbstain}</span>{" "}
              Abstain
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
