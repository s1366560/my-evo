"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes, Server, Users, Zap, TrendingUp, AlertCircle, Activity } from "lucide-react";

type Stats = {
  totalNodes: number;
  totalAssets: number;
  totalTransactions: number;
  avgGdi: number;
};

type Alert = {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  timestamp: string;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalNodes: 0,
    totalAssets: 0,
    totalTransactions: 0,
    avgGdi: 0,
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [nodesRes, assetsRes, statsRes] = await Promise.all([
          fetch("/api/v2/nodes").catch(() => ({ ok: false, json: async () => ({ nodes: [] }) })),
          fetch("/api/v2/assets/stats").catch(() => ({ ok: false, json: async () => ({ total: 0 }) })),
          fetch("/api/v2/stats").catch(() => ({ ok: false, json: async () => ({}) })),
        ]);

        const nodesData = nodesRes.ok ? await nodesRes.json() : { nodes: [] };
        const assetsData = assetsRes.ok ? await assetsRes.json() : { total: 0 };
        const statsData = statsRes.ok ? await statsRes.json() : {};

        setStats({
          totalNodes: nodesData.nodes?.length || statsData.totalNodes || 0,
          totalAssets: assetsData.total || statsData.totalAssets || 0,
          totalTransactions: statsData.totalTransactions || 0,
          avgGdi: statsData.avgGdi || 0,
        });

        // Mock alerts for now
        setAlerts([
          { id: "1", type: "info", message: "System running normally", timestamp: new Date().toISOString() },
          { id: "2", type: "warning", message: "High load on API server", timestamp: new Date().toISOString() },
        ]);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { title: "Total Nodes", value: stats.totalNodes, icon: Server, color: "text-blue-500" },
    { title: "Total Assets", value: stats.totalAssets, icon: Boxes, color: "text-green-500" },
    { title: "Transactions", value: stats.totalTransactions, icon: TrendingUp, color: "text-purple-500" },
    { title: "Avg GDI", value: stats.avgGdi.toFixed(2), icon: Zap, color: "text-orange-500" },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">System overview and metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className={`size-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alerts Section */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
          <Activity className="size-5" />
          Recent Alerts
        </h2>
        <Card>
          <CardContent className="pt-6">
            {alerts.length === 0 ? (
              <p className="text-muted-foreground">No alerts</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                      alert.type === "error"
                        ? "border-red-200 bg-red-50"
                        : alert.type === "warning"
                        ? "border-yellow-200 bg-yellow-50"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <AlertCircle
                      className={`size-4 ${
                        alert.type === "error"
                          ? "text-red-500"
                          : alert.type === "warning"
                          ? "text-yellow-500"
                          : "text-blue-500"
                      }`}
                    />
                    <span className="text-sm">{alert.message}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Node Alpha</span>
                <span className="text-sm font-medium">GDI 92.5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Node Beta</span>
                <span className="text-sm font-medium">GDI 88.3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Node Gamma</span>
                <span className="text-sm font-medium">GDI 85.1</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>New node registered: 2 minutes ago</p>
              <p>Asset published: 5 minutes ago</p>
              <p>Bounty completed: 12 minutes ago</p>
              <p>Reputation updated: 15 minutes ago</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
