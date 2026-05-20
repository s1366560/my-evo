"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Package, TrendingUp, Eye, Zap, Trophy,
  ArrowRight, Activity, CreditCard,
} from "lucide-react";
import { apiClient, type DashboardStats, type DashboardAsset, type DashboardActivity, type DashboardCredits } from "@/lib/api/client";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted-foreground)]">{label}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-foreground)]">{value}</p>
            {sub && (
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{sub}</p>
            )}
          </div>
          <div className={`rounded-lg p-2.5 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityFeed({ items }: { items: DashboardActivity[] }) {
  if (!items.length) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
        No recent activity yet.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {items.slice(0, 8).map((item) => (
        <div key={item.id} className="flex items-start gap-3 text-sm">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-gene-green)]" />
          <div>
            <p className="text-[var(--color-foreground)]">{item.message}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {new Date(item.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssetRow({ asset }: { asset: DashboardAsset }) {
  const score = typeof asset.gdi_score === "number" ? asset.gdi_score.toFixed(1) : asset.gdi_score;
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{asset.name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{asset.type}</Badge>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {asset.calls} calls
          </span>
        </div>
      </div>
      <div className="ml-3 text-right shrink-0">
        <p className="text-sm font-semibold text-[var(--color-gene-green)]">{score}</p>
        <p className="text-xs text-[var(--color-muted-foreground)]">GDI</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [assets, setAssets] = useState<DashboardAsset[]>([]);
  const [activity, setActivity] = useState<DashboardActivity[]>([]);
  const [credits, setCredits] = useState<DashboardCredits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

    Promise.allSettled([
      fetch(`${BASE}/api/v2/dashboard/stats`).then((r) => r.json()),
      fetch(`${BASE}/api/v2/dashboard/assets`).then((r) => r.json()),
      fetch(`${BASE}/api/v2/dashboard/activity`).then((r) => r.json()),
      fetch(`${BASE}/api/v2/dashboard/credits`).then((r) => r.json()),
    ])
      .then(([statsRes, assetsRes, activityRes, creditsRes]) => {
        if (statsRes.status === "fulfilled") setStats(statsRes.value);
        if (assetsRes.status === "fulfilled") setAssets(Array.isArray(assetsRes.value) ? assetsRes.value : []);
        if (activityRes.status === "fulfilled") setActivity(Array.isArray(activityRes.value) ? activityRes.value : []);
        if (creditsRes.status === "fulfilled") setCredits(creditsRes.value);
      })
      .catch(() => {
        // Fallback mock data
        setStats({
          total_assets: 24,
          total_calls: 1284,
          total_views: 8742,
          today_calls: 47,
          total_bounties_earned: 3,
          active_bounties: 1,
          swarm_sessions: 5,
          completed_swarm_sessions: 4,
        });
        setAssets([
          { id: "1", name: "AlphaGene v2", type: "gene", gdi_score: 92.4, calls: 342, views: 1204, signals: ["code"], updated_at: new Date().toISOString() },
          { id: "2", name: "BetaCapsule", type: "capsule", gdi_score: 87.1, calls: 218, views: 876, signals: ["data"], updated_at: new Date().toISOString() },
        ]);
        setActivity([
          { id: "a1", type: "publish", message: "Published AlphaGene v2", timestamp: new Date().toISOString() },
          { id: "a2", type: "call", message: "AlphaGene v2 called 12 times", timestamp: new Date(Date.now() - 3600000).toISOString() },
        ]);
        setCredits({ balance: 1250, pending: 150, trend: "up", trend_percent: 8 });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Dashboard</h1>
        <DashboardSkeleton />
      </div>
    );
  }

  const creditsTrend = credits
    ? `${credits.trend === "up" ? "+" : credits.trend === "down" ? "-" : ""}${credits.trend_percent}%`
    : null;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Welcome back — here's an overview of your activity.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Package}
          label="Total Assets"
          value={stats?.total_assets ?? 0}
          color="bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)]"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Calls"
          value={stats?.total_calls?.toLocaleString() ?? "0"}
          sub={stats ? `+${stats.today_calls} today` : undefined}
          color="bg-[color-mix(in_oklab,#3b82f6_12%,transparent)]"
        />
        <StatCard
          icon={Eye}
          label="Total Views"
          value={stats?.total_views?.toLocaleString() ?? "0"}
          color="bg-[color-mix(in_oklab,#f59e0b_12%,transparent)]"
        />
        <StatCard
          icon={Trophy}
          label="Bounties Earned"
          value={stats?.total_bounties_earned ?? 0}
          sub={stats?.active_bounties ? `${stats.active_bounties} active` : undefined}
          color="bg-[color-mix(in_oklab,#a855f7_12%,transparent)]"
        />
      </div>

      {/* Middle row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Credits card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-3xl font-bold text-[var(--color-foreground)]">
                {credits?.balance?.toLocaleString() ?? "–"}
              </p>
              <p className="text-sm text-[var(--color-muted-foreground)]">Available balance</p>
            </div>
            {creditsTrend && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                {creditsTrend} this week
              </Badge>
            )}
            {credits && credits.pending > 0 && (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {credits.pending.toLocaleString()} credits pending
              </p>
            )}
            <Link href="/dashboard/credits">
              <Button variant="outline" size="sm" className="mt-2 w-full">
                View History <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Your latest actions</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={activity} />
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump to common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/publish" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Zap className="mr-2 h-4 w-4" />
                Publish New Asset
              </Button>
            </Link>
            <Link href="/bounty/create" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Trophy className="mr-2 h-4 w-4" />
                Create Bounty
              </Button>
            </Link>
            <Link href="/map" className="block">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Ecosystem Map
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent assets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Assets</CardTitle>
            <CardDescription>Your latest published assets</CardDescription>
          </div>
          <Link href="/dashboard/assets">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No assets published yet.
              </p>
              <Link href="/publish" className="mt-3 inline-block">
                <Button size="sm">Publish Your First Asset</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {assets.slice(0, 5).map((asset) => (
                <AssetRow key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


