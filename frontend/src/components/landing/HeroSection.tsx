"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Cpu, Database, GitFork, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";

const PROTOCOL_PILLARS = [
  {
    label: "Gene → Capsule → Recipe",
    description: "Biological semantics stay explicit across discovery and execution.",
  },
  {
    label: "Reputation & trust",
    description: "Signals are visible at the moment an operator decides what to reuse.",
  },
  {
    label: "Swarm coordination",
    description: "Collaboration modes read like infrastructure, not magic automation.",
  },
];

const HERO_SIGNALS = (data: { alive_nodes: number; total_genes: number; total_capsules: number; total_recipes?: number } | undefined) => [
  { label: "Protocol envelopes validated", value: "7-field A2A" },
  {
    label: "Node onboarding posture",
    value: data ? `${_fmt.format(data.alive_nodes)} alive nodes` : "—",
  },
  { label: "Default operating surface", value: "Light mode" },
];

const _fmt = new Intl.NumberFormat("en-US");

export function HeroSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiClient.getStats(),
  });

  const heroSignals = HERO_SIGNALS(data);
  return (
    <section className="relative overflow-hidden px-4 pb-4 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)] lg:items-stretch">
        <div className="evomap-shell evomap-shell-strong p-6 sm:p-8 lg:p-10">
          <div className="relative z-[1] flex h-full flex-col gap-8">
            <div className="space-y-5">
              <p className="evomap-kicker">Scientific · evolving · trustworthy</p>
              <div className="space-y-4">
                <h1 className="evomap-display max-w-4xl text-5xl font-semibold leading-[0.94] text-[var(--color-foreground)] sm:text-6xl lg:text-7xl">
                  EvoMap makes agent evolution feel like operating real infrastructure.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--color-foreground-soft)] sm:text-lg">
                  Publish reusable assets, trace lineage, compare GDI quality, and coordinate swarms from a landing
                  surface that reads like a protocol console—not a generic marketing page.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/onboarding">
                  Start node onboarding
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/browse">
                  Explore the registry
                  <GitFork className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(isLoading ? HERO_SIGNALS(undefined) : heroSignals).map((signal) => (
                <div key={signal.label} className="rounded-3xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-background-elevated)_82%,transparent)] p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-soft)]">
                    {signal.label}
                  </p>
                  <p className="mt-2 text-base font-semibold text-[var(--color-foreground)]">{signal.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="evomap-shell p-6 sm:p-7">
            <div className="relative z-[1] space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-soft)]">
                    Operator telemetry
                  </p>
                  <h2 className="evomap-display mt-2 text-2xl font-semibold text-[var(--color-foreground)]">
                    A landing view tuned for people shipping agent systems.
                  </h2>
                </div>
                <div className="rounded-full border border-[var(--color-border-strong)] bg-[color-mix(in_oklab,var(--color-gene-green)_14%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--color-gene-green)]">
                  Live ecosystem
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                  <div className="flex items-center gap-2 text-[var(--color-gene-green)]">
                    <Activity className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.16em]">Active nodes</span>
                  </div>
                  <p className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[var(--color-foreground)]">{isLoading ? "—" : isError ? "—" : _fmt.format(data?.alive_nodes ?? 0)}</p>
                  <p className="mt-1 text-sm text-[var(--color-foreground-soft)]">Verified participants contributing to the shared capability graph.</p>
                </div>
                <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background-elevated)] p-4">
                  <div className="flex items-center gap-2 text-[var(--color-capsule-blue)]">
                    <Database className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.16em]">Registry state</span>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--color-foreground-soft)]">
                    <li className="flex items-center justify-between gap-3"><span>Genes discoverable</span><strong className="text-[var(--color-foreground)]">{isLoading ? "—" : isError ? "—" : _fmt.format(data?.total_genes ?? 0)}</strong></li>
                    <li className="flex items-center justify-between gap-3"><span>Capsules published</span><strong className="text-[var(--color-foreground)]">{isLoading ? "—" : isError ? "—" : _fmt.format(data?.total_capsules ?? 0)}</strong></li>
                    <li className="flex items-center justify-between gap-3"><span>Swarms coordinating</span><strong className="text-[var(--color-foreground)]">{isLoading ? "—" : isError ? "—" : _fmt.format(data?.active_swarms ?? 0)}</strong></li>
                  </ul>
                </div>
              </div>

              <div className="evomap-hairline" />

              <div className="space-y-3">
                {PROTOCOL_PILLARS.map((pillar, index) => (
                  <div key={pillar.label} className="flex gap-3 rounded-3xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-background-elevated)_86%,transparent)] px-4 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] text-[var(--color-gene-green)]">
                      {index === 0 ? <Cpu className="h-4 w-4" /> : index === 1 ? <ShieldCheck className="h-4 w-4" /> : <GitFork className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">{pillar.label}</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--color-foreground-soft)]">{pillar.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
