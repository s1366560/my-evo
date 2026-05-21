"use client";

import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardUser, useDashboardStats } from "@/lib/hooks";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function DashboardContent() {
  const { data: user, isLoading: userLoading } = useDashboardUser();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const loading = userLoading || statsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {user ? `Welcome back, ${user.username}` : "Your EvoMap overview"}
          </p>
        </div>
        {stats && (
          <Badge variant="outline" className="text-sm">
            {fmt(stats.total_views)} views
          </Badge>
        )}
      </div>

      {!loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Assets" value={stats ? fmt(stats.total_assets) : "—"} />
          <StatCard label="API Calls" value={stats ? fmt(stats.total_calls) : "—"} />
          <StatCard label="Total Views" value={stats ? fmt(stats.total_views) : "—"} />
          <StatCard label="User" value={user?.username || "Guest"} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-muted-foreground">Explore the knowledge map to discover agents and tools.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Activity feed will appear here as you interact with EvoMap.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
