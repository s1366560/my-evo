"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CouncilProposal } from "@/lib/api/client";
import { apiClient } from "@/lib/api/client";

type ProposalStatus = "draft" | "active" | "passed" | "rejected";

interface VotePanelProps {
  proposalId: string;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
}

/** Cast votes via POST /a2a/counrol/proposal/:id/vote (approve/reject/abstain). */
export function VotePanel({
  proposalId,
  status,
  votesFor,
  votesAgainst,
}: VotePanelProps) {
  const queryClient = useQueryClient();
  const [voted, setVoted] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const voteMutation = useMutation({
    mutationFn: async (rawType: "for" | "against" | "abstain") => {
      const voteType =
        rawType === "for"
          ? "approve"
          : rawType === "against"
          ? "reject"
          : "abstain";
      return apiClient.castVote(proposalId, voteType);
    },
    onSuccess: () => {
      setVoted(true);
      setSuccessMsg("Vote recorded.");
      // Optimistically update proposals cache
      queryClient.setQueryData<
        { proposals: CouncilProposal[] } | CouncilProposal[]
      >(["council", "all"], (prev) => {
        if (!prev) return prev;
        const list = Array.isArray(prev)
          ? prev
          : (prev as { proposals: CouncilProposal[] }).proposals;
        return {
          proposals: list.map((p) =>
            p.proposal_id === proposalId
              ? { ...p, votes_for: p.votes_for + 1 }
              : p
          ),
        } as { proposals: CouncilProposal[] };
      });
    },
    onError: (err: Error) => {
      setSuccessMsg(err.message);
    },
  });

  const handleVote = (type: "for" | "against" | "abstain") => {
    setSuccessMsg(null);
    voteMutation.mutate(type);
  };

  const isActive = status === "active";
  const isPending = voteMutation.isPending;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-[var(--color-muted-foreground)]">
        Cast Your Vote
      </div>
      <div className="flex flex-col gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={!isActive || voted || isPending}
          onClick={() => handleVote("for")}
          aria-label={`Vote for proposal ${proposalId}`}
          className={cn(
            "justify-start border border-[var(--color-success)]/30 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 hover:text-[var(--color-success)]",
            !isActive && "opacity-50"
          )}
        >
          For ({votesFor})
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!isActive || voted || isPending}
          onClick={() => handleVote("against")}
          aria-label={`Vote against proposal ${proposalId}`}
          className={cn(
            "justify-start border border-[var(--color-destructive)]/30 text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)]",
            !isActive && "opacity-50"
          )}
        >
          Against ({votesAgainst})
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!isActive || voted || isPending}
          onClick={() => handleVote("abstain")}
          aria-label={`Abstain from proposal ${proposalId}`}
          className={cn(
            "justify-start border border-[var(--color-muted-foreground)]/30 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted-foreground)]/10 hover:text-[var(--color-muted-foreground)]",
            !isActive && "opacity-50"
          )}
        >
          Abstain
        </Button>
      </div>
      {voted && successMsg && (
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-[var(--color-muted-foreground)]"
        >
          {successMsg}
        </p>
      )}
      {voteMutation.isError && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-xs text-[var(--color-destructive)]"
        >
          {voteMutation.error instanceof Error
            ? voteMutation.error.message
            : "Vote failed. Please try again."}
        </p>
      )}
    </div>
  );
}
