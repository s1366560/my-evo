"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

type TrustLevel = "unverified" | "verified" | "trusted";

interface TrustBadgeProps {
  level: TrustLevel;
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

export function TrustBadge({ level }: TrustBadgeProps) {
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
