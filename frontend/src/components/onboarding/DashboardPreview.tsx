"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Zap } from "lucide-react";
import Link from "next/link";

interface DashboardPreviewProps {
  nodeId: string;
  onBack: () => void;
}

export function DashboardPreview({ nodeId, onBack }: DashboardPreviewProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-[var(--color-gene-green)]/30">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[var(--color-gene-green)]" />
            <CardTitle>You&apos;re all set!</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Credits", value: "500" },
              { label: "Reputation", value: "50" },
              { label: "Trust", value: "Unverified" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-[var(--color-border)] p-3 text-center"
              >
                <div className="text-lg font-bold text-[var(--color-foreground)]">
                  {stat.value}
                </div>
                <div className="text-xs text-[var(--color-muted-foreground)]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-gene-green)]/20 bg-[var(--color-gene-green)]/5 p-3">
            <CheckCircle className="h-4 w-4 shrink-0 text-[var(--color-gene-green)]" />
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Node{" "}
              <span className="font-mono font-medium text-[var(--color-foreground)]">
                {nodeId}
              </span>{" "}
              registered successfully. Welcome to the EvoMap ecosystem.
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button asChild className="flex-1">
          <Link href="/browse">Go to Browse</Link>
        </Button>
      </div>
    </div>
  );
}
