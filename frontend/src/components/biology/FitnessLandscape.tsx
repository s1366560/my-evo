"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

interface FitnessPoint {
  novelty: number;
  usefulness: number;
  rigor: number;
  gdi: number;
}

interface FitnessLandscapeProps {
  data: FitnessPoint[];
}

function getGDIColor(gdi: number): string {
  if (gdi >= 85) return "var(--color-gene-green)";
  if (gdi >= 70) return "var(--color-capsule-blue)";
  if (gdi >= 50) return "var(--color-recipe-amber)";
  return "var(--color-destructive)";
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: FitnessPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-3 shadow-sm text-xs">
      <div className="font-semibold mb-1">GDI: {d.gdi}</div>
      <div className="grid grid-cols-3 gap-2 text-[var(--color-muted-foreground)]">
        <span>Novelty</span><span className="text-[var(--color-foreground)] font-medium">{d.novelty}</span>
        <span>Usefulness</span><span className="text-[var(--color-foreground)] font-medium">{d.usefulness}</span>
        <span>Rigor</span><span className="text-[var(--color-foreground)] font-medium">{d.rigor}</span>
      </div>
    </div>
  );
}

export function FitnessLandscape({ data }: FitnessLandscapeProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
          Fitness Landscape
        </h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          X: Novelty, Y: Usefulness, Bubble size: Rigor, Color: GDI Score
        </p>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-[var(--color-muted-foreground)]">GDI:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-gene-green)]" />
          <span className="text-[var(--color-muted-foreground)]">85+</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-capsule-blue)]" />
          <span className="text-[var(--color-muted-foreground)]">70–84</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-recipe-amber)]" />
          <span className="text-[var(--color-muted-foreground)]">50–69</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-destructive)]" />
          <span className="text-[var(--color-muted-foreground)]">Below 50</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            type="number"
            dataKey="novelty"
            name="Novelty"
            domain={[0, 100]}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            tickLine={{ stroke: "var(--color-border)" }}
            label={{
              value: "Novelty",
              position: "insideBottom",
              offset: -12,
              fill: "var(--color-muted-foreground)",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="usefulness"
            name="Usefulness"
            domain={[0, 100]}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            tickLine={{ stroke: "var(--color-border)" }}
            label={{
              value: "Usefulness",
              angle: -90,
              position: "insideLeft",
              offset: 12,
              fill: "var(--color-muted-foreground)",
              fontSize: 11,
            }}
          />
          <ZAxis type="number" dataKey="rigor" range={[80, 400]} />
          <Tooltip content={<CustomTooltip />} />

          {/* Fitness peak reference */}
          <ReferenceDot
            x={92}
            y={90}
            r={8}
            fill="var(--color-gene-green)"
            fillOpacity={0.3}
            stroke="var(--color-gene-green)"
            strokeWidth={2}
          />
          <ReferenceDot
            x={15}
            y={15}
            r={6}
            fill="var(--color-destructive)"
            fillOpacity={0.2}
            stroke="var(--color-destructive)"
            strokeWidth={1}
          />

          <Scatter
            name="Assets"
            data={data}
            fill="var(--color-capsule-blue)"
          >
            {data.map((entry, index) => (
              <Scatter
                key={`point-${index}`}
                data={[entry]}
                fill={getGDIColor(entry.gdi)}
                fillOpacity={0.7}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
