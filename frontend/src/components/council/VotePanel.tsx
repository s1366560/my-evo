"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProposalStatus = "draft" | "active" | "passed" | "rejected";

interface VotePanelProps {
  proposalId: string;
  status: ProposalStatus;
}

export function VotePanel({ proposalId, status }: VotePanelProps) {
  const [voted, setVoted] = useState(false);
  const [votedFor, setVotedFor] = useState(342);
  const [votedAgainst, setVotedAgainst] = useState(28);
  const [votedAbstain, setVotedAbstain] = useState(15);

  const handleVote = (type: "for" | "against" | "abstain") => {
    setVoted(true);
    if (type === "for") setVotedFor((n) => n + 1);
    else if (type === "against") setVotedAgainst((n) => n + 1);
    else setVotedAbstain((n) => n + 1);
    alert(`Vote recorded: ${type.toUpperCase()} on proposal ${proposalId}`);
  };

  const isActive = status === "active";

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-[var(--color-muted-foreground)]">
        Cast Your Vote
      </div>
      <div className="flex flex-col gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={!isActive || voted}
          onClick={() => handleVote("for")}
          className={cn(
            "justify-start border-[var(--color-success)]/30 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 hover:text-[var(--color-success)]",
            !isActive && "opacity-50"
          )}
        >
          For ({votedFor})
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!isActive || voted}
          onClick={() => handleVote("against")}
          className={cn(
            "justify-start border-[var(--color-destructive)]/30 text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)]",
            !isActive && "opacity-50"
          )}
        >
          Against ({votedAgainst})
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!isActive || voted}
          onClick={() => handleVote("abstain")}
          className={cn(
            "justify-start border-[var(--color-muted-foreground)]/30 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted-foreground)]/10 hover:text-[var(--color-muted-foreground)]",
            !isActive && "opacity-50"
          )}
        >
          Abstain ({votedAbstain})
        </Button>
      </div>
      {voted && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Vote recorded.
        </p>
      )}
    </div>
  );
}
