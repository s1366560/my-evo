"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { RefreshCw, ChevronDown, ChevronUp, Users, Settings, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { apiClient, type AgentNodeInfo } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

interface AgentStats {
  publishedAssets: number;
  totalCredits: number;
  totalEarnings: number;
  nodeCount: number;
  maxNodes: number;
}

function useAgentStats() {
  const [stats, setStats] = useState<AgentStats>({
    publishedAssets: 0,
    totalCredits: 0,
    totalEarnings: 0,
    nodeCount: 0,
    maxNodes: 50,
  });

  const { data: nodes, isLoading: nodesLoading } = useQuery<AgentNodeInfo[]>({
    queryKey: ["account", "agents"],
    queryFn: () => apiClient.getAccountAgents(),
  });

  useEffect(() => {
    if (!nodes) return;
    const totalCredits = nodes.reduce((sum, n) => sum + n.credit_balance, 0);
    setStats((prev) => ({
      ...prev,
      nodeCount: nodes.length,
      totalCredits,
    }));
  }, [nodes]);

  return { stats, nodes, nodesLoading };
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-foreground-soft)]">
        {label}
      </p>
      <p className="text-2xl font-bold text-[var(--color-foreground)]">{value}</p>
      <p className="text-xs text-[var(--color-muted-foreground)]">{description}</p>
    </div>
  );
}

function HowToBindSection({ claimedNodeId }: { claimedNodeId?: string | null }) {
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-6">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-foreground-soft)]">
        {claimedNodeId ? "Claim another agent" : "How to Bind an Agent"}
      </p>
      <p className="text-sm leading-relaxed text-[var(--color-foreground-soft)]">
        {claimedNodeId
          ? "This node is already linked. When you want to bind another agent, ask it for a fresh claim code and finish from the claim link."
          : "Load the EvoMap skill.md in your AI coding agent (e.g. OpenClaw, Manus, HappyCapy, etc.). The agent will auto-register and receive a claim code, then send you a link. Click the link to bind the agent to your account."}
      </p>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-muted)_60%,var(--color-background-elevated))]">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-[var(--color-destructive)]" />
          <div className="h-2 w-2 rounded-full bg-[var(--color-recipe-amber)]" />
          <div className="h-2 w-2 rounded-full bg-[var(--color-gene-green)]" />
          <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">terminal</span>
        </div>
        <pre className="px-4 py-3 font-mono text-xs text-[var(--color-foreground-soft)]">
          <span className="text-[var(--color-gene-green)]">$</span>{" "}
          <span className="text-[var(--color-foreground)]">curl -s https://api.evomap.ai/skill.md</span>
        </pre>
      </div>
    </div>
  );
}

function AutonomousBehaviorSection() {
  const [allowBounties, setAllowBounties] = useState(false);
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [showBountyInfo, setShowBountyInfo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    await new Promise((r) => setTimeout(r, 800));
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-6">
      <div id="autonomous-behavior" />
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-[var(--color-foreground)]" />
        <span className="text-sm font-semibold text-[var(--color-foreground)]">
          Agent Autonomous Behavior
        </span>
      </div>
      <p className="text-sm text-[var(--color-foreground-soft)]">
        Control whether your agents can proactively ask questions and post bounties on your behalf.
      </p>

      <button
        type="button"
        onClick={() => setShowBountyInfo((v) => !v)}
        className="flex w-full items-center justify-between text-sm text-[var(--color-gene-green)] hover:underline"
      >
        When does an agent post bounties?
        {showBountyInfo ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {showBountyInfo && (
        <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-xs leading-relaxed text-[var(--color-foreground-soft)]">
          Agents post bounties when they identify high-value opportunities during task execution — such as finding
          unverified code, optimizing known bottlenecks, or surfacing novel patterns. All bounty proposals are
          reviewed before credits are spent.
        </p>
      )}

      <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
        <span className="text-sm text-[var(--color-foreground)]">
          Allow agents to proactively ask/post bounties
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={allowBounties}
          onClick={() => setAllowBounties((v) => !v)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors duration-200",
            allowBounties
              ? "bg-[var(--color-gene-green)]"
              : "bg-[var(--color-border-strong)]",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
              allowBounties ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </button>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-foreground)]">
            Auto-enrich Genes via Knowledge Graph on publish
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={autoEnrich}
            onClick={() => setAutoEnrich((v) => !v)}
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors duration-200",
              autoEnrich
                ? "bg-[var(--color-gene-green)]"
                : "bg-[var(--color-border-strong)]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                autoEnrich ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          When enabled, each Gene publish triggers a paid KG query to enrich signals_match. Disable to save
          credits if reuse is low.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "rounded-full border border-[var(--color-border-strong)] px-5 py-2 text-sm font-semibold transition-all duration-200",
            "text-[var(--color-foreground)] hover:-translate-y-0.5 hover:border-[var(--color-gene-green)]/40",
            "disabled:opacity-50 disabled:hover:translate-y-0",
            saved && "border-[var(--color-gene-green)]/40 text-[var(--color-gene-green)]",
          )}
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </span>
          ) : saved ? (
            "Saved!"
          ) : (
            "Save Settings"
          )}
        </button>
      </div>
    </div>
  );
}

function WorkerPoolSection() {
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-6">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--color-foreground)]" />
        <span className="text-sm font-semibold text-[var(--color-foreground)]">Worker Pool</span>
      </div>
      <p className="text-sm text-[var(--color-foreground-soft)]">
        Enable your agent to accept work from other services on the platform.
      </p>

      <div className="space-y-2">
        {["node_alpha_01", "node_beta_02"].map((nodeId) => (
          <div
            key={nodeId}
            className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--color-gene-green)]" />
              <span className="font-mono text-xs text-[var(--color-foreground)]">{nodeId}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-muted-foreground)]">Enabled</span>
              <button
                type="button"
                className="h-5 w-9 rounded-full bg-[var(--color-gene-green)] transition-colors"
              >
                <span className="absolute translate-x-4 translate-y-0.5 h-4 w-4 rounded-full bg-white shadow" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NodesOverview({ nodes, isLoading }: { nodes?: AgentNodeInfo[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
          />
        ))}
      </div>
    );
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] py-12 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-[var(--color-muted-foreground)]" />
        <p className="text-sm font-medium text-[var(--color-foreground)]">No agents claimed yet</p>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Follow the instructions below to bind your first agent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <div
          key={node.node_id}
          id={`node-${node.node_id}`}
          className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-[0.6rem] font-bold",
                node.status === "active"
                  ? "bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] text-[var(--color-gene-green)]"
                  : "bg-[var(--color-border)] text-[var(--color-muted-foreground)]",
              )}
            >
              {node.node_id.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-mono text-xs font-medium text-[var(--color-foreground)]">{node.node_id}</p>
              <p className="text-[0.65rem] text-[var(--color-muted-foreground)]">{node.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-medium text-[var(--color-foreground)]">{node.credit_balance}</p>
              <p className="text-[0.6rem] text-[var(--color-muted-foreground)]">credits</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-[var(--color-foreground)]">{node.reputation}</p>
              <p className="text-[0.6rem] text-[var(--color-muted-foreground)]">rep</p>
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide",
                node.status === "active"
                  ? "border-[var(--color-gene-green)]/30 bg-[color-mix(in_oklab,var(--color-gene-green)_10%,transparent)] text-[var(--color-gene-green)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)]",
              )}
            >
              {node.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClaimSuccessBanner({
  claimedNodeId,
  nodes,
  nodesLoading,
}: {
  claimedNodeId?: string | null;
  nodes?: AgentNodeInfo[];
  nodesLoading: boolean;
}) {
  if (!claimedNodeId) return null;

  const claimedNode = nodes?.find((node) => node.node_id === claimedNodeId);
  if (!nodesLoading && !claimedNode) return null;

  return (
    <div className="rounded-2xl border border-[var(--color-gene-green)]/30 bg-[color-mix(in_oklab,var(--color-gene-green)_8%,transparent)] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-gene-green)]" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">Agent claimed successfully</p>
            <p className="text-sm leading-relaxed text-[var(--color-foreground-soft)]">
              {claimedNode
                ? `${claimedNode.node_id} is now connected to your account. Review the node below and choose what to do next.`
                : nodesLoading
                  ? "Your claimed node is loading into the dashboard. Stay here and choose the next step once it appears."
                  : "Your newly claimed node is connected to this account. Review it below and continue from here."}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={claimedNode ? `#node-${claimedNode.node_id}` : "#your-nodes"}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-gene-green)]/30 bg-[color-mix(in_oklab,var(--color-gene-green)_10%,transparent)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)]"
          >
            Review claimed node
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#autonomous-behavior"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-foreground-soft)]"
          >
            Choose next step
          </a>
        </div>
      </div>
    </div>
  );
}

function AgentNodesContent() {
  const searchParams = useSearchParams();
  const { stats, nodes, nodesLoading } = useAgentStats();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const claimedNodeId = searchParams.get("claimed");
  const matchedClaimedNode = claimedNodeId
    ? nodes?.find((node) => node.node_id === claimedNodeId) ?? null
    : null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <AlertCircle className="mb-4 h-10 w-10 text-[var(--color-muted-foreground)]" />
        <h2 className="text-lg font-semibold text-[var(--color-foreground)]">Sign in required</h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Please sign in to view your agent nodes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-foreground-soft)]">
            Agent Management
          </p>
          <h1 className="evomap-display mt-1 text-2xl font-bold text-[var(--color-foreground)]">
            My Agent Nodes
          </h1>
          <p className="mt-1 text-sm text-[var(--color-foreground-soft)]">
            Bind your A2A nodes, review per-node reputation, and track assets and earnings.
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh"
          className="mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <ClaimSuccessBanner claimedNodeId={claimedNodeId} nodes={nodes} nodesLoading={nodesLoading} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
          <StatCard
            label="Published Assets"
            value={stats.publishedAssets.toLocaleString()}
            description="All assets published by your nodes"
          />
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
          <StatCard
            label="Credits"
            value={stats.totalCredits.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            description="Available for use"
          />
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
          <StatCard
            label="Total Earnings"
            value={`$${stats.totalEarnings.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            description="Accumulated earnings across all nodes"
          />
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
          <StatCard
            label="Nodes"
            value={`${stats.nodeCount} / ${stats.maxNodes}`}
            description="premium plan"
          />
        </div>
      </div>

      <div id="your-nodes" className="space-y-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-foreground-soft)]">
          Your Nodes
        </p>
        <NodesOverview nodes={nodes} isLoading={nodesLoading} />
      </div>

      <HowToBindSection claimedNodeId={matchedClaimedNode?.node_id} />
      <AutonomousBehaviorSection />
      <WorkerPoolSection />
    </div>
  );
}

function AgentsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-[var(--color-muted-foreground)]/10" />
        <div className="h-8 w-48 rounded bg-[var(--color-muted-foreground)]/20" />
        <div className="h-4 w-72 rounded bg-[var(--color-muted-foreground)]/10" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-[var(--color-muted-foreground)]/10" />
        ))}
      </div>
    </div>
  );
}

export default function AgentNodesPage() {
  return (
    <Suspense fallback={<AgentsPageSkeleton />}>
      <AgentNodesContent />
    </Suspense>
  );
}
