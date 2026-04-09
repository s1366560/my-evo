"use client";

import { SideNav } from "@/components/layout/SideNav";

const DASHBOARD_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "My Assets", href: "/dashboard/assets" },
  { label: "Credits", href: "/dashboard/credits" },
  { label: "Profile", href: "/profile" },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <SideNav items={DASHBOARD_NAV_ITEMS} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
