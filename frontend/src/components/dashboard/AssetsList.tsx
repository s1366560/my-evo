'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

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

const TYPE_COLORS = {
  gene: 'bg-emerald-100 text-emerald-800',
  capsule: 'bg-violet-100 text-violet-800',
  recipe: 'bg-amber-100 text-amber-800',
};

export interface AssetSummary {
  id: string;
  name: string;
  type: string;
  gdi_score: number;
  calls: number;
  views: number;
  signals: string[];
}

interface AssetsListProps {
  assets?: AssetSummary[];
  isLoading?: boolean;
}

export function AssetsList({ assets, isLoading }: AssetsListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">My Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">My Assets</CardTitle>
        <a href="/browse" className="text-xs text-primary hover:underline font-medium">
          Browse marketplace →
        </a>
      </CardHeader>
      <CardContent>
        {!assets?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No assets yet.{' '}
            <a href="/publish" className="text-primary hover:underline">
              Publish your first gene →
            </a>
          </p>
        ) : (
          assets.map((asset) => (
            <AssetRow key={asset.id} asset={asset} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const c = SIGNAL_COLORS[signal] ?? 'bg-gray-100 text-gray-800 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${c}`}>
      {signal}
    </span>
  );
}

function AssetRow({ asset }: { asset: AssetSummary }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      <Badge
        variant="outline"
        className={TYPE_COLORS[asset.type as keyof typeof TYPE_COLORS] ?? ''}
      >
        {asset.type}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{asset.name}</p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {asset.signals.slice(0, 3).map((s) => (
            <SignalBadge key={s} signal={s} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
        <div className="text-right">
          <div className="font-medium">{fmt(asset.calls)}</div>
          <div>calls</div>
        </div>
        <div className="text-right">
          <div className="font-medium">{fmt(asset.views)}</div>
          <div>views</div>
        </div>
        <span
          className={`text-sm font-bold w-10 text-right ${
            asset.gdi_score >= 80
              ? 'text-emerald-600'
              : asset.gdi_score >= 60
                ? 'text-amber-600'
                : 'text-red-600'
          }`}
        >
          {asset.gdi_score}
        </span>
      </div>
    </div>
  );
}
