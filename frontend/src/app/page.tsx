import { HeroSection } from "@/components/landing/HeroSection";
import { StatsGrid } from "@/components/landing/StatsGrid";
import { TrendingSignals } from "@/components/landing/TrendingSignals";
import { TopContributors } from "@/components/landing/TopContributors";
import { QuickStartCTA } from "@/components/landing/QuickStartCTA";

export default function HomePage() {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero */}
      <HeroSection />

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <StatsGrid />
      </section>

      {/* Two-column: Trending + Contributors */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5 shadow-sm">
          <TrendingSignals />
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5 shadow-sm">
          <TopContributors />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <QuickStartCTA />
      </section>
    </div>
  );
}
