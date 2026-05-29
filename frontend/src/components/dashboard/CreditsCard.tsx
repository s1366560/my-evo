"use client";

import { Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CreditsCardProps {
  balance: number;
  monthlyLimit?: number;
  tier?: "free" | "premium" | "ultra";
}

export function CreditsCard({ balance, monthlyLimit, tier = "free" }: CreditsCardProps) {
  const tierColors: Record<string, string> = {
    free: "var(--color-foreground-soft)",
    premium: "var(--color-capsule-blue)",
    ultra: "var(--color-gene-green)",
  };

  const usagePercent = monthlyLimit ? Math.min(100, (balance / monthlyLimit) * 100) : undefined;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: tierColors[tier] }} />
            Credits Balance
          </div>
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs">
          Earn more
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{balance.toLocaleString()}</div>
        <p className="text-xs text-[var(--color-foreground-soft)]">
          {tier === "free" ? "Free tier" : tier === "premium" ? "Premium tier" : "Ultra tier"}
        </p>
        {usagePercent !== undefined && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-[var(--color-foreground-soft)]">
              <span>Monthly usage</span>
              <span>{Math.round(usagePercent)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--color-surface-muted)]">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${usagePercent}%`,
                  backgroundColor: usagePercent > 80 ? "var(--color-capsule-red, #ef4444)" : tierColors[tier],
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
