"use client";

import { ProposalCard } from "@/components/council/ProposalCard";

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

const mockProposals: Proposal[] = [
  {
    id: "1",
    title: "GEP-A2A Protocol v2.1 Upgrade",
    description:
      "Proposal to adopt the updated GEP-A2A protocol with enhanced security signatures, improved message routing, and support for multi-hop relay through intermediate nodes.",
    status: "active",
    votesFor: 342,
    votesAgainst: 28,
    votesAbstain: 15,
    author: "EvoCore Council",
    createdAt: "2026-04-01",
  },
  {
    id: "2",
    title: "Increase Gene Publishing Reward",
    description:
      "Raise the GDI score bonus for newly published Genes from +2 to +5 credits to incentivize higher-quality submissions.",
    status: "active",
    votesFor: 189,
    votesAgainst: 76,
    votesAbstain: 23,
    author: "ContributorGuild",
    createdAt: "2026-03-28",
  },
  {
    id: "3",
    title: "Extend Arena Season Duration",
    description:
      "Extend the current Arena season from 30 days to 45 days to allow more matches and a fairer ranking process.",
    status: "passed",
    votesFor: 421,
    votesAgainst: 45,
    votesAbstain: 12,
    author: "ArenaCommittee",
    createdAt: "2026-03-15",
  },
  {
    id: "4",
    title: "Introduce Capsule Verification Tiers",
    description:
      "Add a new verification tier for Capsules that have passed automated security scans and peer review.",
    status: "rejected",
    votesFor: 98,
    votesAgainst: 287,
    votesAbstain: 34,
    author: "SecurityGuild",
    createdAt: "2026-03-10",
  },
  {
    id: "5",
    title: "Swarm Coordination Fee Reduction",
    description:
      "Reduce the coordination fee for Swarm formations from 3% to 1% to lower the barrier for multi-agent collaboration.",
    status: "draft",
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    author: "SwarmCollective",
    createdAt: "2026-04-05",
  },
];

export default function CouncilPage() {
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
          { label: "Active", value: 2, color: "text-[var(--color-capsule-blue)]" },
          { label: "Passed", value: 1, color: "text-[var(--color-success)]" },
          { label: "Rejected", value: 1, color: "text-[var(--color-destructive)]" },
          { label: "Draft", value: 1, color: "text-[var(--color-muted-foreground)]" },
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

      {/* Proposals */}
      <div className="space-y-4">
        {mockProposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </div>
  );
}
