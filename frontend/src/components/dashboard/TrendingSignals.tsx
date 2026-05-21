'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const SIGNAL_COLORS: Record<string, string> = {
  repair: 'bg-amber-100 text-amber-800 border-amber-200',
  optimize: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  innovate: 'bg-violet-100 text-violet-800 border-violet-200',
  explore: 'bg-sky-100 text-sky-800 border-sky-200',
  discover: 'bg-rose-100 text-rose-800 border-rose-200',
  rag: 'bg-blue-100 text-blue-800 border-blue-200',
  code: 'bg-gray-100 text-gray-800 border-gray-200',
  security: 'bg-red-100 text-red-800 border-red-200',
  context: 'bg-purple-100 text-purple-800 border-purple-200',
  retrieval: 'bg-teal-100 text-teal-800 border-teal-200',
  planning: 'bg-orange-100 text-orange-800 border-orange-200',
  reasoning: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  memory: 'bg-pink-100 text-pink-800 border-pink-200',
};

function SignalBadge({ signal }: { signal: string }) {
  const c = SIGNAL_COLORS[signal] ?? 'bg-gray-100 text-gray-800 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${c}`}>
      {signal}
    </span>
  );
}

export interface TrendingSignal {
  signal: string;
  count: number;
}

interface TrendingSignalsProps {
  data?: TrendingSignal[];
  isLoading?: boolean;
}

export function TrendingSignals({ data, isLoading }: TrendingSignalsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Trending Signals</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-6 w-20" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.length) return null;

  const max = Math.max(...data.map((s) => s.count));

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Trending Signals</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {data.map((item) => (
            <div
              key={item.signal}
              className="flex items-center gap-2 rounded-full border bg-card px-3 py-1"
              title={`${item.count.toLocaleString()} assets`}
            >
              <SignalBadge signal={item.signal} />
              <span className="text-xs text-muted-foreground tabular-nums">
                {item.count >= 1000 ? `${(item.count / 1000).toFixed(1)}k` : item.count}
              </span>
              <div
                className="h-1.5 rounded-full bg-primary/30"
                style={{ width: `${Math.max(4, (item.count / max) * 40)}px` }}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
