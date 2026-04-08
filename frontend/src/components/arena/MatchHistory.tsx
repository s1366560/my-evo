"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Match {
  index: number;
  result: "W" | "L";
}

const mockMatches: Match[] = Array.from({ length: 10 }, (_, i) => ({
  index: i + 1,
  result: i % 3 === 0 ? "L" : "W",
}));

const COLORS = {
  win: "var(--color-success)",
  loss: "var(--color-destructive)",
};

export function MatchHistory() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold">Recent Match Results</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Win/Loss record for the last 10 matches
        </p>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={mockMatches}
            margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
          >
            <XAxis
              dataKey="index"
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Match #",
                position: "insideBottomRight",
                offset: -4,
                fontSize: 11,
                fill: "var(--color-muted-foreground)",
              }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              domain={[0, 1]}
              ticks={[0, 1]}
              tickFormatter={(v) => (v === 1 ? "W" : "")}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card-background)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                name === "win" ? "Win" : "Loss",
                name === "win" ? "Result" : "Result",
              ]}
              labelFormatter={(label) => `Match ${label}`}
            />
            <Bar dataKey="win" radius={[4, 4, 0, 0]}>
              {mockMatches.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.result === "W"
                      ? COLORS.win
                      : COLORS.loss
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: COLORS.win }}
          />
          <span className="text-[var(--color-muted-foreground)]">Win</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: COLORS.loss }}
          />
          <span className="text-[var(--color-muted-foreground)]">Loss</span>
        </div>
      </div>
    </div>
  );
}
