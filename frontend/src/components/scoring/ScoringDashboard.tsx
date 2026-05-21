"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGDIConfig,
  useGDIWeights,
  type GDIConfig,
  type GDIWeights,
} from "@/lib/api/hooks";
import { GDI_DIMENSIONS } from "./constants";

function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

function WeightsDisplay({ weights }: { weights: GDIWeights }) {
  return (
    <div className="space-y-3">
      {GDI_DIMENSIONS.map(({ name, color }) => {
        const val = (weights as unknown as Record<string, number>)[name.toLowerCase()] ?? 0;
        return (
          <div key={name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-foreground)]">{name}</span>
              <span className="font-medium tabular-nums" style={{ color }}>
                {(val * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--color-surface-muted)]">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${val * 100}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConfigDisplay({ config }: { config: GDIConfig }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="space-y-1">
        <p className="text-xs text-[var(--color-muted-foreground)]">Score Range</p>
        <p className="text-lg font-semibold tabular-nums text-[var(--color-foreground)]">
          {config.score_range.min}–{config.score_range.max}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-[var(--color-muted-foreground)]">Signal Weight</p>
        <p className="text-lg font-semibold tabular-nums text-[var(--color-foreground)]">
          {(config.confidence_weights.signals * 100).toFixed(0)}%
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-[var(--color-muted-foreground)]">Validation Weight</p>
        <p className="text-lg font-semibold tabular-nums text-[var(--color-foreground)]">
          {(config.confidence_weights.validation * 100).toFixed(0)}%
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-[var(--color-muted-foreground)]">Decay</p>
        <p className="text-lg font-semibold tabular-nums text-[var(--color-foreground)]">
          {config.decay_enabled ? `${(config.decay_rate * 100).toFixed(1)}%/mo` : "Off"}
        </p>
      </div>
    </div>
  );
}

export function ScoringDashboard() {
  const { data: config, isLoading: configLoading } = useGDIConfig();
  const { data: weights, isLoading: weightsLoading } = useGDIWeights();

  return (
    <div className="space-y-6">
      {/* Dimension cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-[var(--color-foreground)]">
            GDI Dimensions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {GDI_DIMENSIONS.map(({ name, desc, weight, color }) => (
              <div
                key={name}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{name}</h3>
                  <span className="text-xs font-medium tabular-nums" style={{ color }}>
                    {(weight * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Config + weights */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {configLoading ? (
              <SkeletonRows rows={2} />
            ) : config ? (
              <ConfigDisplay config={config} />
            ) : (
              <p className="text-sm text-[var(--color-muted-foreground)]">Failed to load config.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
              Active Weights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weightsLoading ? (
              <SkeletonRows rows={5} />
            ) : weights ? (
              <WeightsDisplay weights={weights} />
            ) : (
              <p className="text-sm text-[var(--color-muted-foreground)]">Failed to load weights.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
