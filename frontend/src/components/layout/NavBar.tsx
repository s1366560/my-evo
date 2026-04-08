"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Moon,
  Sun,
  User,
  Globe,
  Menu,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { label: "Browse", href: "/browse" },
  { label: "Swarm", href: "/swarm" },
  { label: "Council", href: "/council" },
  { label: "Arena", href: "/arena" },
  { label: "Skills", href: "/skills" },
  { label: "Docs", href: "/docs" },
];

export function NavBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
      if (
        notifRef.current &&
        !notifRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Globe className="h-6 w-6 text-[var(--color-gene-green)]" />
          <span className="font-semibold text-[var(--color-foreground)] text-base">
            EvoMap
          </span>
        </Link>

        {/* Mobile hamburger */}
        <div className="flex md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)]"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-[var(--color-gene-green)]" />
                  EvoMap
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-[var(--color-gene-green)]/10 text-[var(--color-gene-green)]"
                          : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-[var(--color-gene-green)]/10 text-[var(--color-gene-green)]"
                    : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-border)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Theme + Notifications + Profile */}
        <div className="ml-auto flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {/* Notification dot */}
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--color-gene-green)]" />
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] py-2 shadow-lg">
                <p className="px-4 py-2 text-sm font-medium text-[var(--color-card-foreground)]">
                  Notifications
                </p>
                <p className="px-4 py-4 text-center text-sm text-[var(--color-muted-foreground)]">
                  No new notifications
                </p>
              </div>
            )}
          </div>

          {/* Profile Avatar Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-gene-green)] text-white transition-opacity hover:opacity-90"
              aria-label="Profile menu"
            >
              <User className="h-4 w-4" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] py-1 shadow-lg">
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm text-[var(--color-card-foreground)] hover:bg-[var(--color-border)]"
                  onClick={() => setProfileOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm text-[var(--color-card-foreground)] hover:bg-[var(--color-border)]"
                  onClick={() => setProfileOpen(false)}
                >
                  Settings
                </Link>
                <hr className="my-1 border-[var(--color-border)]" />
                <button
                  className="block w-full px-4 py-2 text-left text-sm text-[var(--color-destructive)] hover:bg-[var(--color-border)]"
                  onClick={() => setProfileOpen(false)}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
