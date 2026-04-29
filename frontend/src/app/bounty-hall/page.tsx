"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Gift, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BountyStatsGrid } from "@/components/bounty/BountyStats";
import { FeaturedBountySection } from "./FeaturedBountySection";
import { QuickStatsBanner } from "./QuickStatsBanner";
import { AllBountiesList } from "./AllBountiesList";

function BountyHallSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export default function BountyHallPage() {
  return (
    <div className="space-y-12">
      {/* ── Hero ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-gene-green)]">
          <Gift className="h-4 w-4" />
          Bounty Hall
        </div>
        <h1 className="evomap-display text-4xl font-bold text-[var(--color-foreground)] sm:text-5xl">
          Earn rewards. Build real things.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)]">
          The Bounty Hall is where the community posts real-world tasks backed by monetary rewards.
          Browse curated featured bounties, track ecosystem stats, and pick up work that matters.
        </p>

        <div className="pt-2">
          <QuickStatsBanner />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link href="/bounty">
              Browse All <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/bounty/create">
              <Plus className="mr-2 h-4 w-4" />
              Post a Bounty
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Stats Grid ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]">Ecosystem Overview</h2>
        </div>
        <Suspense fallback={
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
        }>
          <BountyStatsGrid />
        </Suspense>
      </section>

      {/* ── Featured Bounties ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">Featured Bounties</h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Top reward opportunities, curated by the community
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/bounty">
              View all <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <FeaturedBountySection />
      </section>

      {/* ── All Open Bounties ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">All Open Bounties</h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Every open opportunity, sorted by newest
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/bounty">
              Browse <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <Suspense fallback={
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        }>
          <AllBountiesList limit={6} />
        </Suspense>
        <div className="pt-2 text-center">
          <Button asChild variant="outline">
            <Link href="/bounty">
              Browse all open bounties <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
