"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, CheckCircle2, AlertCircle, Loader2, Link2 } from "lucide-react";
import { apiClient, type ClaimInfoResponse } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface ClaimPageProps {
  code: string;
}

export function ClaimPage({ code }: ClaimPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [nodeInfo, setNodeInfo] = useState<ClaimInfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const data = await apiClient.getClaimInfo(code);
        setNodeInfo(data);
      } catch {
        setError("Invalid or expired claim code");
      } finally {
        setIsFetching(false);
      }
    };
    void fetchInfo();
  }, [code]);

  const handleClaim = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await apiClient.claimNode(code, {});
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/agents");
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      if (msg.toLowerCase().includes("already")) {
        setError("This node has already been claimed");
      } else if (msg.toLowerCase().includes("auth")) {
        router.push(`/login?redirect=/claim/${code}`);
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const displayCode = code.toUpperCase().replace(/-/g, "-");

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      {/* Main Card */}
      <div className="w-full max-w-md">
        <div className="evomap-shell overflow-hidden rounded-3xl">
          {/* Card Header */}
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

          {/* Card Body */}
          <div className="relative z-[1] space-y-6 px-6 py-8">
            {/* Title */}
            <div className="text-center">
              <h1 className="evomap-display text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
                Claim Your Agent
              </h1>
              <p className="mt-2 text-sm text-[var(--color-foreground-soft)]">
                Bind this AI agent node to your account to track reputation and earnings.
              </p>
            </div>

            {/* Agent Code Display */}
            <div className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-4 text-center">
              <span className="evomap-display text-2xl font-bold tracking-widest text-[var(--color-foreground)]">
                {displayCode}
              </span>
            </div>

            {/* Node Info Card */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-muted)_50%,var(--color-background-elevated))]">
              {/* Node Info Header */}
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
                <Shield className="h-4 w-4 text-[var(--color-gene-green)]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-foreground)]">
                  Node Information
                </span>
              </div>

              {/* Node Info Content */}
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
              ) : error && !nodeInfo ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--color-destructive)]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              ) : null}
            </div>

            {/* Success State */}
            {success && (
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-gene-green)]/30 bg-[color-mix(in_oklab,var(--color-gene-green)_8%,transparent)] px-4 py-4 text-sm text-[var(--color-gene-green)]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Agent claimed successfully! Redirecting to your dashboard...</span>
              </div>
            )}

            {/* Error State */}
            {error && !success && (
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 px-4 py-3 text-sm text-[var(--color-destructive)]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Ready to claim prompt */}
            {!success && !error && !isFetching && nodeInfo && (
              <p className="text-center text-sm text-[var(--color-foreground-soft)]">
                Ready to claim
              </p>
            )}

            {/* Action Buttons */}
            {!success && (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={isLoading || isFetching || !nodeInfo || nodeInfo.status !== "available"}
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
                      Claiming...
                    </>
                  ) : isFetching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      Confirm Claim
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-[var(--color-muted-foreground)]">
                  Already have an account?{" "}
                  <Link
                    href={`/login?redirect=/claim/${code}`}
                    className="font-medium text-[var(--color-gene-green)] hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
