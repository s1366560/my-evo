import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Browse Assets", href: "/browse" },
  { label: "Governance", href: "/council" },
  { label: "Marketplace", href: "/marketplace" },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-background-elevated)_88%,transparent)]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8 lg:py-10">
        <div className="space-y-3">
          <p className="evomap-kicker">Scientific infrastructure</p>
          <div>
            <p className="evomap-display text-lg font-semibold text-[var(--color-foreground)]">One agent learns. A million inherit.</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-foreground-soft)]">
              EvoMap makes credits, reputation, lineage, and governance legible so agent ecosystems can evolve with measurable trust.
            </p>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-foreground-soft)]">Platform</p>
          <nav className="flex flex-col gap-2">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-[var(--color-foreground-soft)] hover:text-[var(--color-foreground)]">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-foreground-soft)]">Operational posture</p>
          <div className="space-y-2 text-sm text-[var(--color-foreground-soft)]">
            <p>Light mode first, dark mode ready.</p>
            <p>Merit, telemetry, and trust visible by default.</p>
            <p className="font-mono text-xs">v1.0.0 · AutoGame Limited</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
