"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LayoutDashboard, Map, Package, Cpu, Trophy, CreditCard, User } from "lucide-react";

const DASHBOARD_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Ecosystem Map", href: "/map", icon: Map },
  { label: "My Assets", href: "/dashboard/assets", icon: Package },
  { label: "My Agent Nodes", href: "/dashboard/agents", icon: Cpu },
  { label: "My Bounties", href: "/dashboard/bounties", icon: Trophy },
  { label: "Credits", href: "/dashboard/credits", icon: CreditCard },
  { label: "Profile", href: "/profile", icon: User },
];

function DashboardNavLink({ href, label, icon: Icon, pathname, onClick }: {
  href: string; label: string; icon: React.ComponentType<{ className?: string }>; pathname: string; onClick?: () => void;
}) {
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] text-[var(--color-gene-green)]"
          : "text-[var(--color-foreground-soft)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex flex-1">
      {/* Desktop sidebar — SideNav on xl+ screens */}
      <aside className="hidden shrink-0 border-r border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-background-elevated)_90%,transparent)] xl:block xl:w-72">
        <div className="sticky top-16 space-y-6 px-5 py-8">
          <div className="space-y-3">
            <p className="evomap-kicker">Console</p>
            <div>
              <p className="evomap-display text-lg font-semibold text-[var(--color-foreground)]">Operator view</p>
              <p className="mt-2 hidden text-sm leading-6 text-[var(--color-foreground-soft)] sm:block">
                Track credits, reputation, and asset performance without losing the protocol context.
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            {DASHBOARD_NAV_ITEMS.map((item) => (
              <DashboardNavLink key={item.href} {...item} pathname={pathname} />
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-background-elevated)_95%,transparent)] backdrop-blur-xl xl:hidden">
        <div className="flex items-center justify-around px-2 py-1">
          {DASHBOARD_NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 text-[0.65rem] font-medium transition-colors",
                  isActive
                    ? "text-[var(--color-gene-green)]"
                    : "text-[var(--color-foreground-soft)]"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-[4rem]">{item.label.split(" ").pop()}</span>
              </Link>
            );
          })}
          {/* More menu */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <button
                className="flex flex-col items-center gap-0.5 px-3 py-2 text-[0.65rem] font-medium text-[var(--color-foreground-soft)]"
              >
                <Menu className="h-5 w-5" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="border-t border-[var(--color-border)] bg-[var(--color-background)]">
              <div className="space-y-1 pt-2">
                {DASHBOARD_NAV_ITEMS.slice(5).map((item) => (
                  <DashboardNavLink
                    key={item.href}
                    {...item}
                    pathname={pathname}
                    onClick={() => setMobileNavOpen(false)}
                  />
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 pb-20 xl:pb-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
