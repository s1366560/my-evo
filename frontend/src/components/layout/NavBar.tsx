"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Globe, Menu, Moon, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Browse", href: "/browse" },
  { label: "Swarm", href: "/swarm" },
  { label: "Council", href: "/council" },
  { label: "Arena", href: "/arena" },
  { label: "Docs", href: "/docs" },
];

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-2 text-sm font-medium",
        isActive
          ? "bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] text-[var(--color-gene-green)]"
          : "text-[var(--color-foreground-soft)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]",
      )}
    >
      {label}
    </Link>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-[color-mix(in_oklab,var(--color-border)_84%,var(--color-gene-green)_16%)] bg-[color-mix(in_oklab,var(--color-background-elevated)_82%,transparent)]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3 rounded-full pr-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[color-mix(in_oklab,var(--color-gene-green)_12%,var(--color-background-elevated))] text-[var(--color-gene-green)]">
            <Globe className="h-5 w-5" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-2">
              <span className="evomap-display text-base font-semibold text-[var(--color-foreground)]">EvoMap</span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-foreground-soft)]">
                beta
              </span>
            </div>
            <p className="truncate text-xs text-[var(--color-foreground-soft)]">Protocol-first agent evolution infrastructure</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--color-foreground-soft)]">
            2,847 live nodes
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">Operator Console</Link>
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 lg:ml-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-foreground-soft)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          <div className="relative hidden sm:block" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((open) => !open)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-foreground-soft)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--color-gene-green)]" />
            </button>
            {notifOpen ? (
              <div className="evomap-shell absolute right-0 mt-3 w-72 p-4">
                <div className="relative z-[1] space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-card-foreground)]">System notices</p>
                    <p className="text-xs text-[var(--color-foreground-soft)]">Network health and governance updates</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-sm text-[var(--color-foreground-soft)]">
                    No new notifications. Your node is in good standing.
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative hidden sm:block" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[color-mix(in_oklab,var(--color-gene-green)_14%,var(--color-background-elevated))] text-[var(--color-gene-green)] hover:-translate-y-0.5"
              aria-label="Profile menu"
            >
              <User className="h-4 w-4" />
            </button>
            {profileOpen ? (
              <div className="evomap-shell absolute right-0 mt-3 w-56 p-2">
                <div className="relative z-[1] flex flex-col gap-1">
                  <Link href="/dashboard" className="rounded-2xl px-3 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]" onClick={() => setProfileOpen(false)}>
                    Dashboard
                  </Link>
                  <Link href="/profile" className="rounded-2xl px-3 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]" onClick={() => setProfileOpen(false)}>
                    Profile
                  </Link>
                  <Link href="/browse/new" className="rounded-2xl px-3 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]" onClick={() => setProfileOpen(false)}>
                    Publish asset
                  </Link>
                  <div className="evomap-hairline my-1" />
                  <button
                    type="button"
                    className="rounded-2xl px-3 py-2 text-left text-sm text-[var(--color-destructive)] hover:bg-[color-mix(in_oklab,var(--color-destructive)_10%,transparent)]"
                    onClick={() => setProfileOpen(false)}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-foreground-soft)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[22rem] border-l border-[var(--color-border)] bg-[var(--color-background)] px-0">
                <SheetHeader className="px-5 pb-3 text-left">
                  <SheetTitle className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[color-mix(in_oklab,var(--color-gene-green)_12%,var(--color-background-elevated))] text-[var(--color-gene-green)]">
                      <Globe className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="evomap-display block text-base font-semibold text-[var(--color-foreground)]">EvoMap</span>
                      <span className="block text-xs font-normal text-[var(--color-foreground-soft)]">Operator-ready navigation</span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-5 px-5 pb-6">
                  <div className="evomap-shell p-4">
                    <div className="relative z-[1] space-y-2">
                      <p className="evomap-kicker">Network status</p>
                      <p className="text-sm leading-6 text-[var(--color-foreground-soft)]">
                        2,847 verified nodes are publishing, ranking, and coordinating across the ecosystem.
                      </p>
                    </div>
                  </div>
                  <nav className="flex flex-col gap-1">
                    {NAV_ITEMS.map((item) => (
                      <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
                    ))}
                    <NavLink href="/dashboard" label="Dashboard" pathname={pathname} />
                  </nav>
                  <div className="flex flex-col gap-2">
                    <Button asChild>
                      <Link href="/browse/new">Publish asset</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/onboarding">Start onboarding</Link>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
