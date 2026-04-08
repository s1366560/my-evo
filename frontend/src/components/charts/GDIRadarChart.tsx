"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { GDIStructured } from "@/lib/api/normalizers";

interface GDIRadarChartProps {
  data: GDIStructured;
  flat?: boolean;
}

const DIMENSIONS = [
  { key: "usefulness", label: "Usefulness", weight: 0.3 },
  { key: "novelty", label: "Novelty", weight: 0.25 },
  { key: "rigor", label: "Rigor", weight: 0.25 },
  { key: "reuse", label: "Reuse", weight: 0.2 },
] as const;

export function GDIRadarChart({ data, flat }: GDIRadarChartProps) {
  const chartData = DIMENSIONS.map(({ key, label, weight }) => ({
    dimension: `${label}\n(${Math.round(weight * 100)}%)`,
    value: data.dimensions[key as keyof typeof data.dimensions] ?? 0,
    fullMark: 100,
  }));

  const color = "var(--color-gene-green)";

  if (flat) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div
          className="text-5xl font-bold tabular-nums"
          style={{ color }}
        >
          {data.overall}
        </div>
        <span className="text-sm text-[var(--color-muted-foreground)]">
          Overall GDI Score
        </span>
        <span className="text-xs text-[var(--color-muted-foreground)] opacity-60">
          (Dimension breakdown pending)
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="var(--color-border)" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
        />
        <Radar
          name="GDI"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
