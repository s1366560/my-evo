"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

interface SideNavProps {
  items: NavItem[];
}

export function SideNav({ items }: SideNavProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden border-r border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-background-elevated)_90%,transparent)] xl:block xl:w-72">
      <div className="sticky top-16 space-y-6 px-5 py-8">
        <div className="space-y-3">
          <p className="evomap-kicker">Console</p>
          <div>
            <p className="evomap-display text-lg font-semibold text-[var(--color-foreground)]">Operator view</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-foreground-soft)]">
              Track credits, reputation, and asset performance without losing the protocol context.
            </p>
          </div>
        </div>

        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-2xl px-4 py-3 text-sm font-medium",
                  isActive
                    ? "bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] text-[var(--color-gene-green)]"
                    : "text-[var(--color-foreground-soft)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
