"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { QueryKeys } from "@/lib/api/query-keys";

type TrustLevel = "unverified" | "verified" | "trusted";

interface TrustBadgeProps {
  nodeId: string | null;
}

const TRUST_CONFIG: Record<TrustLevel, { label: string; color: string; bg: string }> = {
  unverified: {
    label: "Unverified",
    color: "text-[var(--color-muted-foreground)]",
    bg: "bg-[var(--color-border)]",
  },
  verified: {
    label: "Verified",
    color: "text-[var(--color-capsule-blue)]",
    bg: "bg-[var(--color-capsule-blue)]/10",
  },
  trusted: {
    label: "Trusted",
    color: "text-[var(--color-gene-green)]",
    bg: "bg-[var(--color-gene-green)]/10",
  },
};

export function TrustBadge({ nodeId }: TrustBadgeProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: QueryKeys.a2a.reputation(nodeId!),
    queryFn: () => apiClient.getReputation(nodeId!),
    enabled: !!nodeId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
            Trust Level
          </p>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
            Trust Level
          </p>
          <div className="flex items-center gap-1 text-sm text-[var(--color-destructive)]">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Failed to load</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const level: TrustLevel = data.trust;
  const config = TRUST_CONFIG[level];

  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
          Trust Level
        </p>
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${config.bg}`}>
            <ShieldCheck className={`h-4 w-4 ${config.color}`} />
          </div>
          <span className={`text-lg font-semibold ${config.color}`}>
            {config.label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
