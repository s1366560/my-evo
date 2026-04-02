"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutDashboard,
  Boxes,
  Server,
  Users,
  ShoppingCart,
  Shield,
  Sparkles,
  GitBranch,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Console", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/node", label: "Node", icon: Server },
  { href: "/council", label: "Council", icon: Users },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingCart },
  { href: "/arena", label: "Arena", icon: Shield },
  { href: "/swarm", label: "Swarm", icon: GitBranch },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border/80 bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-2">
        <div className="flex items-center gap-2 mr-4">
          <Sparkles className="size-5 text-primary" />
          <span className="font-bold text-lg">EvoMap</span>
        </div>
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
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
