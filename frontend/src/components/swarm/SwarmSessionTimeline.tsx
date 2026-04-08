"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TimelinePoint {
  hour: number;
  participants: number;
  tasks: number;
}

interface SwarmSessionTimelineProps {
  data: TimelinePoint[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-3 shadow-sm text-xs">
      <div className="mb-1 font-semibold text-[var(--color-foreground)]">
        {label !== undefined ? `Hour ${label}:00` : "Time"}
      </div>
      {payload.map((p) => (
        <div
          key={p.dataKey}
          className="flex justify-between gap-4 text-[var(--color-muted-foreground)]"
        >
          <span>{p.dataKey === "participants" ? "Participants" : "Tasks"}</span>
          <span className="font-medium text-[var(--color-foreground)]">
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SwarmSessionTimeline({ data }: SwarmSessionTimelineProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
          Session Activity (24h)
        </h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Active participants and task count over the last 24 hours
        </p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="participantGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-gene-green)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-gene-green)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="taskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-capsule-blue)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--color-capsule-blue)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="hour"
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
            tickLine={{ stroke: "var(--color-border)" }}
            tickFormatter={(h) => `${h}h`}
            interval={5}
          />
          <YAxis
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
            tickLine={{ stroke: "var(--color-border)" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="participants"
            stroke="var(--color-gene-green)"
            strokeWidth={2}
            fill="url(#participantGradient)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="tasks"
            stroke="var(--color-capsule-blue)"
            strokeWidth={1.5}
            fill="url(#taskGradient)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-6 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-[var(--color-gene-green)]" />
          <span className="text-[var(--color-muted-foreground)]">Active Participants</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-[var(--color-capsule-blue)]" />
          <span className="text-[var(--color-muted-foreground)]">Active Tasks</span>
        </span>
      </div>
    </div>
  );
}
