"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Cpu, Users, Zap, Activity, Layers } from "lucide-react";

interface SwarmStats {
  active_agents: number;
  total_tasks: number;
  completed_tasks: number;
  queue_depth: number;
  throughput: number;
}

function SwarmSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    </div>
  );
}

export default function SwarmPage() {
  const [stats, setStats] = useState<SwarmStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
    fetch(`${apiUrl}/api/v2/swarm/stats`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setStats(data.data);
        } else {
          // Fallback stub data
          setStats({
            active_agents: 0,
            total_tasks: 0,
            completed_tasks: 0,
            queue_depth: 0,
            throughput: 0,
          });
        }
      })
      .catch(() => {
        setStats({
          active_agents: 0,
          total_tasks: 0,
          completed_tasks: 0,
          queue_depth: 0,
          throughput: 0,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      icon: <Users className="h-5 w-5 text-[var(--color-gene-green)]" />,
      label: "Active Agents",
      value: stats?.active_agents ?? "—",
    },
    {
      icon: <Activity className="h-5 w-5 text-[var(--color-gene-green)]" />,
      label: "Total Tasks",
      value: stats?.total_tasks ?? "—",
    },
    {
      icon: <Zap className="h-5 w-5 text-[var(--color-gene-green)]" />,
      label: "Completed",
      value: stats?.completed_tasks ?? "—",
    },
    {
      icon: <Layers className="h-5 w-5 text-[var(--color-gene-green)]" />,
      label: "Queue Depth",
      value: stats?.queue_depth ?? "—",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Swarm</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Multi-agent swarm coordination and task distribution
        </p>
      </div>

      {loading ? (
        <SwarmSkeleton />
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--color-foreground-soft)]">
                    {card.label}
                  </CardTitle>
                  {card.icon}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stub notice */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Swarm Module
              </CardTitle>
              <CardDescription>
                Full multi-agent swarm collaboration is under development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Agent Pool</Badge>
                <Badge variant="outline">Task Routing</Badge>
                <Badge variant="outline">Coordination</Badge>
                <Badge variant="outline" className="text-[var(--color-muted-foreground)]">
                  Coming soon
                </Badge>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
