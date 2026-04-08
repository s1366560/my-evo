"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ReputationCardProps {
  score: number;
}

function getTier(score: number): { label: string; variant: "default" | "secondary" | "outline" } {
  if (score >= 95) return { label: "Grandmaster", variant: "default" };
  if (score >= 80) return { label: "Master", variant: "default" };
  if (score >= 60) return { label: "Expert", variant: "secondary" };
  if (score >= 40) return { label: "Journeyman", variant: "secondary" };
  if (score >= 20) return { label: "Apprentice", variant: "outline" };
  return { label: "Novice", variant: "outline" };
}

export function ReputationCard({ score }: ReputationCardProps) {
  const tier = getTier(score);

  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
          Reputation
        </p>
        <p className="mb-2 text-3xl font-bold text-[var(--color-foreground)]">
          {score}
          <span className="text-lg font-normal text-[var(--color-muted-foreground)]">/100</span>
        </p>
        <Badge variant={tier.variant}>{tier.label}</Badge>
      </CardContent>
    </Card>
  );
}
