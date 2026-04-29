"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface ReputationCardProps {
  /** Pass external data to avoid an extra fetch. */
  reputation?: number;
  /** Pass external trust level to avoid an extra fetch. */
  trustLevel?: string;
  /** Set true to show loading skeleton regardless of data. */
  isLoading?: boolean;
  /** Legacy: fetches data if no external data is provided. */
  nodeId?: string | null;
}

function getTier(score: number): { label: string; variant: "default" | "secondary" | "outline" } {
  if (score >= 95) return { label: "Grandmaster", variant: "default" };
  if (score >= 80) return { label: "Master", variant: "default" };
  if (score >= 60) return { label: "Expert", variant: "secondary" };
  if (score >= 40) return { label: "Journeyman", variant: "secondary" };
  if (score >= 20) return { label: "Apprentice", variant: "outline" };
  return { label: "Novice", variant: "outline" };
}

export function ReputationCard({ reputation, trustLevel, isLoading, nodeId }: ReputationCardProps) {
  // Use external data when available, otherwise fetch.
  const shouldFetch = !isLoading && reputation === undefined && !!nodeId;
  const { data: fetched, isLoading: fetching } = useQuery({
    queryKey: ["reputation", nodeId],
    queryFn: () => apiClient.getReputation(nodeId!),
    enabled: shouldFetch,
  });

  const loading = isLoading ?? fetching;
  const score = reputation ?? fetched?.score;
  const fetchedTrustLevel = trustLevel ?? fetched?.trust;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Reputation</p>
          <Skeleton className="mb-2 h-9 w-16" />
          <Skeleton className="h-5 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (!score && !fetched) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Reputation</p>
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Failed to load</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tier = getTier(score ?? 0);

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
