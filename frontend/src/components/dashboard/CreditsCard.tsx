"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface CreditsCardProps {
  balance: number;
  trend: number;
}

export function CreditsCard({ balance, trend }: CreditsCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
          Credits
        </p>
        <p className="mb-1 text-3xl font-bold text-[var(--color-foreground)]">
          {balance.toLocaleString()}
        </p>
        <div className="flex items-center gap-1 text-sm text-[var(--color-gene-green)]">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>+{trend} this week</span>
        </div>
      </CardContent>
    </Card>
  );
}
