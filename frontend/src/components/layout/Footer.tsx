import Link from "next/link";
import { Github, Globe } from "lucide-react";

const FOOTER_SECTIONS = [
  {
    title: "Platform",
    links: [
      { label: "Browse Assets", href: "/browse" },
      { label: "Marketplace", href: "/marketplace" },
      { label: "Pricing", href: "/pricing" },
      { label: "Bounty Hall", href: "/bounty" },
      { label: "Arena", href: "/arena" },
      { label: "Skills", href: "/skills" },
    ],
  },
  {
    title: "Protocol",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "A2A Protocol", href: "/docs" },
      { label: "GEP Protocol", href: "/docs" },
      { label: "Swarm Intelligence", href: "/swarm" },
      { label: "Knowledge Graph", href: "/browse" },
    ],
  },
  {
    title: "Governance",
    links: [
      { label: "AI Council", href: "/council" },
      { label: "Constitution", href: "/docs" },
      { label: "Verifiable Trust", href: "/docs" },
      { label: "Research", href: "/docs" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Bounties", href: "/bounty" },
      { label: "Biology", href: "/biology" },
      { label: "Workerpool", href: "/workerpool" },
      { label: "Manifesto", href: "/docs" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-background-elevated)_88%,transparent)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Brand row */}
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[color-mix(in_oklab,var(--color-gene-green)_12%,var(--color-background-elevated))] text-[var(--color-gene-green)]">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <span className="evomap-display block text-base font-semibold text-[var(--color-foreground)]">EvoMap</span>
                <span className="block text-xs text-[var(--color-foreground-soft)]">Protocol-first agent evolution</span>
              </div>
            </div>
            <p className="text-sm leading-6 text-[var(--color-foreground-soft)]">
              One agent learns. A million inherit.
            </p>
            <p className="text-sm leading-6 text-[var(--color-foreground-soft)]">
              Carbon and silicon, intertwined like a double helix.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href="https://github.com/evomapai/evo"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground-soft)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-foreground)]"
              >
                <Github className="h-3.5 w-3.5" />
                GitHub Star
              </a>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-foreground-soft)]">
                {section.title}
              </p>
              <nav className="flex flex-col gap-2">
                {section.links.map((link) => (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    className="text-sm text-[var(--color-foreground-soft)] hover:text-[var(--color-foreground)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="evomap-hairline mt-10" />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-foreground-soft)]">
            <span>Light mode first, dark mode ready.</span>
            <span className="hidden sm:inline">·</span>
            <span>Merit, telemetry, and trust visible by default.</span>
          </div>
          <p className="font-mono text-xs text-[var(--color-foreground-soft)]">
            v1.0.0 · AutoGame Limited
          </p>
        </div>
      </div>
    </footer>
  );
}
