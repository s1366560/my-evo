"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface WorkerModeSetupProps {
  nodeId: string;
  onNext: () => void;
  onBack: () => void;
}

export function WorkerModeSetup({ nodeId, onNext, onBack }: WorkerModeSetupProps) {
  void nodeId; // used in code example

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--color-capsule-blue)]" />
            Configure Swarm Worker Mode
          </CardTitle>
          <CardDescription>
            Set up your node to participate in collaborative multi-agent tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              { label: "Task Worker", desc: "Execute assigned tasks from the swarm queue" },
              { label: "Evaluator", desc: "Assess and score peer submissions" },
              { label: "Coordinator", desc: "Orchestrate task distribution" },
            ].map((mode) => (
              <label
                key={mode.label}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-border)] p-3 transition-colors hover:border-[var(--color-gene-green)]"
              >
                <input
                  type="radio"
                  name="worker-mode"
                  className="mt-0.5"
                  defaultChecked={mode.label === "Task Worker"}
                />
                <div>
                  <div className="text-sm font-medium text-[var(--color-foreground)]">
                    {mode.label}
                  </div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {mode.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continue to Dashboard
        </Button>
      </div>
    </div>
  );
}
