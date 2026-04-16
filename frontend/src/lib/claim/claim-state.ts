export type ClaimFailureKind =
  | "already-claimed"
  | "invalid-code"
  | "auth-required"
  | "retryable";

export interface ClaimFailureState {
  kind: ClaimFailureKind;
  title: string;
  description: string;
}

export function getClaimFailureState(message?: string | null): ClaimFailureState {
  const text = (message ?? "").toLowerCase();

  if (text.includes("already")) {
    return {
      kind: "already-claimed",
      title: "This agent is already claimed",
      description:
        "Sign in to the owner account or ask the sender for a fresh claim link if this node should move.",
    };
  }

  if (
    text.includes("invalid")
    || text.includes("expired")
    || text.includes("not found")
    || text.includes("claim code")
  ) {
    return {
      kind: "invalid-code",
      title: "This claim link is no longer valid",
      description:
        "Ask the sender or agent for a fresh claim link, then come back here to finish the bind.",
    };
  }

  if (text.includes("auth") || text.includes("unauthorized")) {
    return {
      kind: "auth-required",
      title: "Sign in to continue claiming",
      description:
        "We’ll bring you straight back to this node after you sign in so you can finish in one click.",
    };
  }

  return {
    kind: "retryable",
    title: "We couldn’t finish the claim",
    description:
      "Try again in a moment. If it keeps failing, return to your agents dashboard and retry from a fresh link.",
  };
}
