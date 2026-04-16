"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, CheckCircle2, AlertCircle, Loader2, Link2, ArrowRight } from "lucide-react";
import { apiClient, type ClaimInfoResponse, type ClaimResponse } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { appendRedirectQuery } from "@/lib/auth/redirects";
import { getClaimFailureState, type ClaimFailureState } from "@/lib/claim/claim-state";
import { cn } from "@/lib/utils";

interface ClaimPageProps {
  code: string;
}

export function ClaimPage({ code }: ClaimPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [nodeInfo, setNodeInfo] = useState<ClaimInfoResponse | null>(null);
  const [failure, setFailure] = useState<ClaimFailureState | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResponse | null>(null);

  const resume = searchParams.get("resume") === "1";
  const loginHref = useMemo(
    () => appendRedirectQuery("/login", `/claim/${code}?resume=1`),
    [code],
  );
  const invalidLoginHref = useMemo(
    () => appendRedirectQuery("/login", "/dashboard/agents"),
    [],
  );
  const claimedNodeId = claimResult?.node_id ?? nodeInfo?.node_id ?? "";
  const agentsHref = useMemo(() => {
    if (!claimedNodeId) return "/dashboard/agents";
    return `/dashboard/agents?claimed=${encodeURIComponent(claimedNodeId)}`;
  }, [claimedNodeId]);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const data = await apiClient.getClaimInfo(code);
        setNodeInfo(data);
        setFailure(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid or expired claim code";
        setFailure(getClaimFailureState(msg));
      } finally {
        setIsFetching(false);
      }
    };

    void fetchInfo();
  }, [code]);

  const handleClaim = async () => {
    setIsLoading(true);
    setFailure(null);

    try {
      const result = await apiClient.claimNode(code, {});
      setClaimResult(result);
      setNodeInfo((current) => (current
        ? {
            ...current,
            node_id: result.node_id,
            model: result.model,
            reputation: result.reputation,
            status: "claimed",
          }
        : current));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      const nextFailure = getClaimFailureState(msg);
      if (nextFailure.kind === "auth-required") {
        router.push(loginHref);
      } else {
        setFailure(nextFailure);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrimaryAction = () => {
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }
    void handleClaim();
  };

  const displayCode = code.toUpperCase().replace(/-/g, "-");
  const isAlreadyClaimed = nodeInfo?.status === "claimed" && !claimResult;
  const showSuccess = Boolean(claimResult);
  const showUnavailableState = isAlreadyClaimed || failure?.kind === "already-claimed";
  const showInvalidState = !nodeInfo && failure?.kind === "invalid-code";
  const showRetryState = failure?.kind === "retryable";
  const showResumeHint = resume && isAuthenticated && !showSuccess && !showUnavailableState;
  const showAuthHint = !isAuthenticated && !showSuccess && !showInvalidState && !showUnavailableState;
  const canClaim = nodeInfo?.status === "available" && !showSuccess;
  const primaryButtonLabel = isLoading
    ? "Claiming..."
    : isAuthenticated
      ? "Claim this agent"
      : "Sign in to claim";

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="evomap-shell overflow-hidden rounded-3xl">
          <div className="relative z-[1] border-b border-[var(--color-border)] px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                <Link2 className="h-3 w-3 text-[var(--color-foreground-soft)]" />
              </div>
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-foreground-soft)]">
                Agent Claim
              </span>
            </div>
          </div>

          <div className="relative z-[1] space-y-6 px-6 py-8">
            <div className="text-center">
              <h1 className="evomap-display text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
                Claim Your Agent
              </h1>
              <p className="mt-2 text-sm text-[var(--color-foreground-soft)]">
                Bind this AI agent node to your account so future credits, reputation, and settings stay connected.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-4 text-center">
              <span className="evomap-display text-2xl font-bold tracking-widest text-[var(--color-foreground)]">
                {displayCode}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-muted)_50%,var(--color-background-elevated))]">
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
                <Shield className="h-4 w-4 text-[var(--color-gene-green)]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-foreground)]">
                  Node Information
                </span>
              </div>

              {isFetching ? (
                <div className="flex items-center justify-center px-4 py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--color-muted-foreground)]" />
                </div>
              ) : nodeInfo ? (
                <div className="divide-y divide-[var(--color-border)] px-4 py-1">
                  <div className="flex items-center justify-between py-3">
                    <span className="text-xs text-[var(--color-muted-foreground)]">Node ID</span>
                    <span className="font-mono text-xs text-[var(--color-foreground)]">
                      {nodeInfo.node_id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-xs text-[var(--color-muted-foreground)]">Reputation</span>
                    <span className="text-xs font-medium text-[var(--color-foreground)]">
                      {nodeInfo.reputation}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-xs text-[var(--color-muted-foreground)]">Registered</span>
                    <span className="text-xs text-[var(--color-foreground)]">
                      {new Date(nodeInfo.registered_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-xs text-[var(--color-muted-foreground)]">Status</span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide",
                        nodeInfo.status === "available"
                          ? "border-[var(--color-gene-green)]/30 bg-[color-mix(in_oklab,var(--color-gene-green)_10%,transparent)] text-[var(--color-gene-green)]"
                          : "border-[var(--color-destructive)]/30 bg-[color-mix(in_oklab,var(--color-destructive)_10%,transparent)] text-[var(--color-destructive)]",
                      )}
                    >
                      {nodeInfo.status}
                    </span>
                  </div>
                </div>
              ) : failure ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--color-destructive)]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {failure.title}
                </div>
              ) : null}
            </div>

            {showAuthHint && (
              <div className="rounded-2xl border border-[var(--color-gene-green)]/20 bg-[color-mix(in_oklab,var(--color-gene-green)_7%,transparent)] px-4 py-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-gene-green)]" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">Sign in once, then finish here.</p>
                    <p className="text-xs leading-relaxed text-[var(--color-foreground-soft)]">
                      We’ll return you to this exact claim page so you can complete the bind in one click.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {showResumeHint && (
              <div className="rounded-2xl border border-[var(--color-gene-green)]/20 bg-[color-mix(in_oklab,var(--color-gene-green)_7%,transparent)] px-4 py-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-gene-green)]" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">You’re back at the same node.</p>
                    <p className="text-xs leading-relaxed text-[var(--color-foreground-soft)]">
                      Confirm the claim below to finish binding this agent to your account.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {showSuccess && claimResult && (
              <div className="rounded-2xl border border-[var(--color-gene-green)]/30 bg-[color-mix(in_oklab,var(--color-gene-green)_8%,transparent)] px-4 py-4 text-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-gene-green)]" />
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="font-medium text-[var(--color-foreground)]">Agent claimed successfully</p>
                      <p className="text-xs leading-relaxed text-[var(--color-foreground-soft)]">
                        {claimResult.node_id} is now bound to your account. Review it in your agents dashboard or keep exploring from there.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link
                        href={agentsHref}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-gene-green)]/30 bg-[color-mix(in_oklab,var(--color-gene-green)_10%,transparent)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)]"
                      >
                        View claimed agent
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-foreground-soft)]"
                      >
                        Return to dashboard
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(failure || showUnavailableState) && !showSuccess && (
              <div className="rounded-2xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 px-4 py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-destructive)]" />
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[var(--color-foreground)]">
                        {showUnavailableState
                          ? "This agent is already claimed"
                          : failure?.title}
                      </p>
                      <p className="text-xs leading-relaxed text-[var(--color-foreground-soft)]">
                        {showUnavailableState
                          ? "If this should belong to you, sign in to the owner account or ask the sender for a fresh claim link."
                          : failure?.description}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link
                        href={isAuthenticated ? "/dashboard/agents" : invalidLoginHref}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)]"
                      >
                        {isAuthenticated ? "Open Agents Dashboard" : "Sign in to your agents"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-foreground-soft)]"
                      >
                        Back to dashboard
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showRetryState && (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4 text-xs leading-relaxed text-[var(--color-foreground-soft)]">
                Retry from this page first. If the claim still fails, open your Agents dashboard and request a fresh link.
              </div>
            )}

            {!showSuccess && !showUnavailableState && !showInvalidState && (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={isLoading || isFetching || !canClaim}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-2xl border border-[color-mix(in_oklab,var(--color-gene-green)_20%,var(--color-border-strong))] bg-[color-mix(in_oklab,var(--color-gene-green)_8%,var(--color-surface-muted))] px-6 py-3",
                    "text-sm font-semibold text-[var(--color-foreground)] transition-all duration-200",
                    "hover:border-[color-mix(in_oklab,var(--color-gene-green)_40%,var(--color-border-strong))] hover:bg-[color-mix(in_oklab,var(--color-gene-green)_14%,var(--color-surface-muted))]",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {primaryButtonLabel}
                    </>
                  ) : isFetching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      {primaryButtonLabel}
                    </>
                  )}
                </button>

                {!isAuthenticated ? (
                  <p className="text-center text-xs text-[var(--color-muted-foreground)]">
                    Already have an account?{" "}
                    <Link
                      href={loginHref}
                      className="font-medium text-[var(--color-gene-green)] hover:underline"
                    >
                      Sign in and return here
                    </Link>
                  </p>
                ) : (
                  <p className="text-center text-xs text-[var(--color-muted-foreground)]">
                    After claiming, you’ll choose your next step from the Agents dashboard instead of being redirected away automatically.
                  </p>
                )}
              </div>
            )}

            {showInvalidState && (
              <div className="flex flex-col gap-3">
                <Link
                  href={isAuthenticated ? "/dashboard/agents" : invalidLoginHref}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-6 py-3 text-sm font-semibold text-[var(--color-foreground)]"
                >
                  {isAuthenticated ? "Open Agents Dashboard" : "Sign in and review your agents"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="text-center text-xs text-[var(--color-muted-foreground)]">
                  Ask the sender or agent for a fresh claim link, then come back here to finish the bind.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
