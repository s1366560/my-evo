"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Crosshair,
  Users,
  BookOpen,
  ShoppingBag,
  Cpu,
  User,
  Settings,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Package },
  { href: "/arena", label: "Arena", icon: Crosshair },
  { href: "/council", label: "Council", icon: Users },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/node", label: "Node", icon: Cpu },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/swarm", label: "Swarm", icon: Network },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">
            <span className="text-primary">Evo</span>
            <span>Map</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <nav className="flex items-center gap-1 md:hidden">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg p-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                )}
              >
                <Icon className="size-4" />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
