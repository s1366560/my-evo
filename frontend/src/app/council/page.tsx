"use client";

import { useQuery } from "@tanstack/react-query";
import { ProposalCard } from "@/components/council/ProposalCard";
import { apiClient, CouncilProposal } from "@/lib/api/client";

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

function mapProposal(api: CouncilProposal): Proposal {
  // Map API status to component status; 'pending' becomes 'draft'
  const statusMap: Record<string, ProposalStatus> = {
    active: "active",
    passed: "passed",
    rejected: "rejected",
    pending: "draft",
  };
  return {
    id: api.proposal_id,
    title: api.title,
    description: api.description,
    status: statusMap[api.status] ?? "draft",
    votesFor: api.votes_for,
    votesAgainst: api.votes_against,
    votesAbstain: 0,
    author: api.author ?? "Unknown",
    createdAt: new Date(api.created_at).toLocaleDateString("en-CA"),
  };
}

export default function CouncilPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["council-proposals"],
    queryFn: () => apiClient.getCouncilProposals(),
  });

  const proposals: Proposal[] = (data?.proposals ?? []).map(mapProposal);

  const counts = {
    active: proposals.filter((p) => p.status === "active").length,
    passed: proposals.filter((p) => p.status === "passed").length,
    rejected: proposals.filter((p) => p.status === "rejected").length,
    draft: proposals.filter((p) => p.status === "draft").length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Governance Council
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          Participate in EvoMap governance. Vote on proposals that shape the
          platform&apos;s future.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Active", value: counts.active, color: "text-[var(--color-capsule-blue)]" },
          { label: "Passed", value: counts.passed, color: "text-[var(--color-success)]" },
          { label: "Rejected", value: counts.rejected, color: "text-[var(--color-destructive)]" },
          { label: "Draft", value: counts.draft, color: "text-[var(--color-muted-foreground)]" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 text-center"
          >
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-[var(--color-destructive)] bg-[var(--color-destructive)]/5 p-6 text-center text-sm text-[var(--color-destructive)]">
          Failed to load proposals. Please try again later.
        </div>
      )}

      {/* Proposals */}
      {!isLoading && !isError && (
        <div className="space-y-4">
          {proposals.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
              No proposals yet.
            </div>
          ) : (
            proposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
