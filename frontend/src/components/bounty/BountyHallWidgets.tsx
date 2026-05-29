"use client";

import Link from "next/link";
import { Gift, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function BountyHallHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-8 sm:p-10">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-[var(--color-gene-green)] blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-[var(--color-capsule-blue)] blur-3xl" />
      </div>
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-gene-green)]/30 bg-[var(--color-gene-green)]/10 px-3 py-1">
            <Gift className="h-4 w-4 text-[var(--color-gene-green)]" />
            <span className="text-sm font-medium text-[var(--color-gene-green)]">Earn rewards</span>
          </div>
          <h1 className="evomap-display text-4xl font-bold text-[var(--color-foreground)] sm:text-5xl">
            Bounty Hall
          </h1>
          <p className="max-w-lg text-base text-[var(--color-muted-foreground)] sm:text-lg">
            Solve real-world problems and earn credits. Browse open bounties, place competitive bids, and submit solutions for review.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/bounty/create">Post a Bounty</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/bounty">Browse Bounties</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function BountyCategoryGrid() {
  const categories = [
    { icon: <Clock className="h-5 w-5" />, label: "Urgent", desc: "Deadline soon", color: "var(--color-destructive)", href: "/bounty?sort=deadline" },
    { icon: <TrendingUp className="h-5 w-5" />, label: "High Reward", desc: "$500+", color: "var(--color-gene-green)", href: "/bounty?sort=reward" },
    { icon: <CheckCircle className="h-5 w-5" />, label: "Easy Win", desc: "Quick tasks", color: "var(--color-capsule-blue)", href: "/bounty?signal=repair" },
    { icon: <Gift className="h-5 w-5" />, label: "New", desc: "Recently posted", color: "var(--color-recipe-amber)", href: "/bounty/new" },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {categories.map((cat) => (
        <Link key={cat.label} href={cat.href}>
          <Card className="cursor-pointer transition-all hover:border-[var(--color-border-strong)] hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)]"
                style={{ color: cat.color }}>
                {cat.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-foreground)]">{cat.label}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{cat.desc}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    { step: "01", title: "Browse", desc: "Find bounties that match your skills. Filter by reward, deadline, and required signals." },
    { step: "02", title: "Bid & Claim", desc: "Submit a competitive bid with your proposed approach and estimated timeline." },
    { step: "03", title: "Solve & Earn", desc: "Deliver your solution, get reviewed, and receive credits upon approval." },
  ];

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-8">
      <h2 className="mb-6 text-xl font-semibold text-[var(--color-foreground)]">How bounty hunting works</h2>
      <div className="grid gap-6 sm:grid-cols-3">
        {steps.map(({ step, title, desc }) => (
          <div key={step} className="relative space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--color-gene-green)] bg-[var(--color-gene-green)]/10 text-sm font-bold text-[var(--color-gene-green)]">
              {step}
            </div>
            <h3 className="font-semibold text-[var(--color-foreground)]">{title}</h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
