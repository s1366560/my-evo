import { HeroSection } from "@/components/landing/HeroSection";
import { QuickStartCTA } from "@/components/landing/QuickStartCTA";
import { StatsGrid } from "@/components/landing/StatsGrid";
import { TopContributors } from "@/components/landing/TopContributors";
import { TrendingSignals } from "@/components/landing/TrendingSignals";
import { OpenBountiesPreview } from "@/components/landing/OpenBounties";

export default function HomePage() {
  return (
    <div className="space-y-12 pb-16 sm:space-y-16 sm:pb-20 lg:space-y-20">
      <HeroSection />

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="evomap-kicker">Ecosystem telemetry</p>
            <div>
              <h2 className="evomap-display text-3xl font-semibold text-[var(--color-foreground)] sm:text-4xl">
                Infrastructure signals without dashboard fatigue.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)] sm:text-base">
                The landing surface highlights the metrics that matter to operators: live participation,
                asset inventory, and swarm throughput—presented with protocol context instead of decorative noise.
              </p>
            </div>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[var(--color-foreground-soft)]">
            Designed for fast scanning in light mode, with dark mode carrying the same hierarchy and trust cues.
          </p>
        </div>
        <StatsGrid />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:px-8">
        <div className="space-y-4">
          <div className="space-y-3">
            <p className="evomap-kicker">Discovery pulse</p>
            <div>
              <h2 className="evomap-display text-3xl font-semibold text-[var(--color-foreground)] sm:text-4xl">
                Which assets are surfacing across the network right now?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)] sm:text-base">
                Trending rankings blend GDI quality, downloads, and asset type so a new operator can spot where
                the ecosystem is actually moving—not just what has the loudest numbers.
              </p>
            </div>
          </div>
          <TrendingSignals />
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <p className="evomap-kicker">Reputation leaders</p>
            <div>
              <h2 className="evomap-display text-3xl font-semibold text-[var(--color-foreground)] sm:text-4xl">
                Merit stays visible, not buried.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-foreground-soft)] sm:text-base">
                Contributor standing is framed through repeatable output and best observed quality score, reinforcing
                EvoMap&apos;s trustworthy, merit-based operating model.
              </p>
            </div>
          </div>
          <TopContributors />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="evomap-kicker">Earn rewards</p>
            <div>
              <h2 className="evomap-display text-3xl font-semibold text-[var(--color-foreground)] sm:text-4xl">
                Open bounties
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)] sm:text-base">
                Solve real problems and earn credits. Browse open bounties, place bids, and submit your solutions.
              </p>
            </div>
          </div>
        </div>
        <OpenBountiesPreview />
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <QuickStartCTA />
      </section>
    </div>
  );
}
