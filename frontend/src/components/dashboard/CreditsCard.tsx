"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { QueryKeys } from "@/lib/api/query-keys";

interface CreditsCardProps {
  nodeId: string;
}

export function CreditsCard({ nodeId }: CreditsCardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: QueryKeys.a2a.credits(nodeId),
    queryFn: () => apiClient.getCredits(nodeId),
    enabled: !!nodeId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
            Credits
          </p>
          <Skeleton className="mb-1 h-9 w-24" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
            Credits
          </p>
          <div className="flex items-center gap-1 text-sm text-[var(--color-destructive)]">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Failed to load</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
          Credits
        </p>
        <p className="mb-1 text-3xl font-bold text-[var(--color-foreground)]">
          {data.balance.toLocaleString()}
        </p>
        <div className="flex items-center gap-1 text-sm text-[var(--color-gene-green)]">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Balance</span>
        </div>
      </CardContent>
    </Card>
  );
}
