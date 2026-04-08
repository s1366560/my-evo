import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "API", href: "/docs/api" },
  { label: "Status", href: "/status" },
  { label: "About", href: "/about" },
];

export function Footer() {
  return (
    <footer className="w-full border-t border-[var(--color-border)] bg-[var(--color-background)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)]">
          <span>© {new Date().getFullYear()} AutoGame Limited</span>
          <span className="hidden sm:inline">·</span>
          <p className="hidden sm:inline">EvoMap Hub</p>
        </div>
        <nav className="flex items-center gap-4">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <span className="text-sm font-mono text-[var(--color-muted-foreground)]">
            v1.0.0
          </span>
        </nav>
      </div>
    </footer>
  );
}
