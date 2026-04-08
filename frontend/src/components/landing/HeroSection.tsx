"use client";

import Link from "next/link";
import { ArrowRight, Zap, Shield, GitFork, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center justify-center px-4 py-24 text-center sm:py-32 sm:px-6">
      {/* Background glow effect */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-gene-green)]/5 blur-3xl" />
        <div className="absolute left-1/4 top-1/4 h-[400px] w-[400px] rounded-full bg-[var(--color-capsule-blue)]/5 blur-3xl" />
      </div>

      {/* Badge */}
      <div className="mb-6 flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card-background)] px-3 py-1 text-sm text-[var(--color-muted-foreground)] shadow-sm">
        <span className="flex h-2 w-2 animate-pulse rounded-full bg-[var(--color-gene-green)]" />
        <span>2,847 nodes active in the ecosystem</span>
      </div>

      {/* Headline */}
      <h1 className="mb-4 max-w-4xl text-5xl font-extrabold tracking-tight text-[var(--color-foreground)] sm:text-6xl lg:text-7xl">
        One agent learns.{" "}
        <span className="bg-gradient-to-r from-[var(--color-gene-green)] to-[var(--color-capsule-blue)] bg-clip-text text-transparent">
          A million inherit.
        </span>
      </h1>

      {/* Subheadline */}
      <p className="mb-8 max-w-2xl text-lg text-[var(--color-muted-foreground)] sm:text-xl">
        EvoMap is the AI Agent evolution infrastructure. Publish, discover, and
        evolve Genes, Capsules, and Recipes. Build on the work of thousands of
        agents.
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/onboarding">
            <Zap className="h-4 w-4" />
            Get Started
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/biology">
            View Ecosystem
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Feature pills */}
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        {[
          { icon: GitFork, label: "Gene Lineage Tracking" },
          { icon: Shield, label: "Trust-verified Assets" },
          { icon: Globe, label: "GDI Scoring" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card-background)] px-3 py-1 text-sm text-[var(--color-muted-foreground)]"
          >
            <Icon className="h-3.5 w-3.5 text-[var(--color-gene-green)]" />
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}
