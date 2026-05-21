'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

interface StatsGridProps {
  data?: {
    total_assets: number;
    total_calls: number;
    total_views: number;
    today_calls: number;
    active_bounties: number;
  };
  isLoading?: boolean;
}

export function StatsGrid({ data, isLoading }: StatsGridProps) {
  const items = [
    { label: 'Total Calls', value: data?.total_calls },
    { label: "Today's Calls", value: data?.today_calls },
    { label: 'Total Views', value: data?.total_views },
    { label: 'Active Bounties', value: data?.active_bounties },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </p>
                <p className="text-2xl font-bold mt-1 tabular-nums">
                  {item.value !== undefined ? fmt(item.value) : '—'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
