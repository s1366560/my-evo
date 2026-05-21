"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Scale, ThumbsUp, ThumbsDown, Minus, Filter } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function CouncilPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="evomap-display text-3xl font-bold text-[var(--color-foreground)] sm:text-4xl">
          Council
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
          Participate in governance. Review proposals, cast your vote, and shape the protocol.
        </p>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap items-center gap-2" data-testid="filter-buttons">
        {["all", "active", "passed", "rejected"].map((status) => (
          <button
            key={status}
            data-testid="filter-button"
            onClick={() => setStatusFilter(status)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === status
                ? "bg-[var(--color-gene-green)] text-[var(--color-background)]"
                : "border border-[var(--color-border)] text-[var(--color-foreground-soft)] hover:border-[var(--color-gene-green)] hover:text-[var(--color-foreground)]"
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Proposals List */}
      <section data-testid="proposals-list">
        <ProposalsList statusFilter={statusFilter} />
      </section>
    </div>
  );
}

interface Proposal {
  proposal_id: string;
  title: string;
  description: string;
  status: "active" | "passed" | "rejected" | "pending";
  votes_for: number;
  votes_against: number;
  created_at: string;
  author?: string;
}

function ProposalsList({ statusFilter }: { statusFilter: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["council-proposals"],
    queryFn: () => apiClient.getCouncilProposals(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-[var(--color-foreground-soft)]">
        Unable to load proposals. Please try again later.
      </p>
    );
  }

  const proposals: Proposal[] = data.proposals ?? [];

  const filtered = statusFilter === "all"
    ? proposals
    : proposals.filter((p) => p.status === statusFilter);

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <p className="text-sm text-[var(--color-foreground-soft)]">No proposals found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filtered.map((proposal) => (
        <ProposalCard key={proposal.proposal_id} proposal={proposal} />
      ))}
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const queryClient = useQueryClient();
  const totalVotes = proposal.votes_for + proposal.votes_against;
  const forPct = totalVotes > 0 ? (proposal.votes_for / totalVotes) * 100 : 50;

  const voteMutation = useMutation({
    mutationFn: (vote: "approve" | "reject" | "abstain") =>
      apiClient.castVote(proposal.proposal_id, vote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["council-proposals"] });
    },
  });

  return (
    <div
      data-testid="proposal-card"
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--color-foreground)]">{proposal.title}</h3>
            <StatusBadge status={proposal.status} />
          </div>
          <p className="mt-1 text-sm text-[var(--color-foreground-soft)]">{proposal.description}</p>
          {proposal.author && (
            <p className="mt-2 text-xs text-[var(--color-foreground-soft)]">
              Proposed by {proposal.author}
            </p>
          )}
        </div>
      </div>

      {/* Vote Stats */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-[var(--color-gene-green)]">
              <ThumbsUp className="h-3 w-3" /> {proposal.votes_for}
            </span>
            <span className="flex items-center gap-1 text-[var(--color-recipe-amber)]">
              <ThumbsDown className="h-3 w-3" /> {proposal.votes_against}
            </span>
          </div>
          <span className="text-[var(--color-foreground-soft)]">{totalVotes} votes</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
          <div
            className="h-full rounded-full bg-[var(--color-gene-green)]"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>

      {/* Vote Buttons */}
      {proposal.status === "active" && (
        <div className="mt-4 flex items-center gap-2" data-testid="vote-buttons">
          <button
            data-testid="vote-for-button"
            onClick={() => voteMutation.mutate("approve")}
            disabled={voteMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--color-gene-green)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-gene-green)_20%,transparent)] disabled:opacity-50"
          >
            <ThumbsUp className="h-3 w-3" />
            Vote For
          </button>
          <button
            data-testid="vote-against-button"
            onClick={() => voteMutation.mutate("reject")}
            disabled={voteMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--color-recipe-amber)_12%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--color-recipe-amber)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-recipe-amber)_20%,transparent)] disabled:opacity-50"
          >
            <ThumbsDown className="h-3 w-3" />
            Vote Against
          </button>
          <button
            data-testid="abstain-button"
            onClick={() => voteMutation.mutate("abstain")}
            disabled={voteMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground-soft)] transition-colors hover:border-[var(--color-foreground-soft)] disabled:opacity-50"
          >
            <Minus className="h-3 w-3" />
            Abstain
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Proposal["status"] }) {
  return (
    <span
      data-testid="proposal-status"
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "active" && "bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] text-[var(--color-gene-green)]",
        status === "passed" && "bg-[color-mix(in_oklab,var(--color-capsule-blue)_12%,transparent)] text-[var(--color-capsule-blue)]",
        status === "rejected" && "bg-[color-mix(in_oklab,var(--color-recipe-amber)_12%,transparent)] text-[var(--color-recipe-amber)]",
        status === "pending" && "bg-[var(--color-surface-muted)] text-[var(--color-foreground-soft)]"
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
