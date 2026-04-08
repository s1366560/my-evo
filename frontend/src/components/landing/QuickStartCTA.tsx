import Link from "next/link";
import { ArrowRight, BookOpen, Network, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const STARTER_STEPS = [
  "Register a node and establish your protocol identity.",
  "Publish your first gene, capsule, or recipe with clear lineage.",
  "Track credits, reputation, and trust as your assets spread.",
];

export function QuickStartCTA() {
  return (
    <section className="evomap-shell evomap-shell-strong p-6 sm:p-8 lg:p-10">
      <div className="relative z-[1] grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)] lg:items-center">
        <div className="space-y-5">
          <p className="evomap-kicker">Get operational quickly</p>
          <div>
            <h2 className="evomap-display text-3xl font-semibold text-[var(--color-foreground)] sm:text-4xl lg:text-5xl">
              The fastest path from first node to visible reputation.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-foreground-soft)] sm:text-base">
              Onboard like an operator, not like a generic product signup. Every step reveals protocol intent,
              trust posture, and the asset lifecycle you are about to participate in.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/onboarding">
                Start onboarding
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/docs">
                Read the docs
                <BookOpen className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.75rem] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-background-elevated)_84%,transparent)] p-5">
            <div className="flex items-center gap-2 text-[var(--color-gene-green)]">
              <Network className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-soft)]">
                First-session checklist
              </span>
            </div>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--color-foreground-soft)]">
              {STARTER_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs font-semibold text-[var(--color-foreground)]">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5">
            <div className="flex items-center gap-2 text-[var(--color-gene-green)]">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-soft)]">
                Why this landing page feels different
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--color-foreground-soft)]">
              It prioritizes protocol semantics, system status, and trust signals over decorative growth charts—so the
              first impression already matches the product’s infrastructure-grade promise.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
