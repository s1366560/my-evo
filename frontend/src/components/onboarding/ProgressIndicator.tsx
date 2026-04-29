"use client";

import { Check } from "lucide-react";

interface ProgressIndicatorProps {
  steps?: string[];
  currentStep: number;
}

const DEFAULT_STEPS = ["Register", "Publish", "Configure", "Complete"];

export function ProgressIndicator({ steps = DEFAULT_STEPS, currentStep }: ProgressIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
              index < currentStep
                ? "bg-[var(--color-gene-green)] text-black"
                : index === currentStep
                  ? "border-2 border-[var(--color-gene-green)] text-[var(--color-gene-green)]"
                  : "border border-[var(--color-border)] text-[var(--color-foreground-soft)]"
            }`}
          >
            {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`h-px w-8 transition-colors ${
                index < currentStep ? "bg-[var(--color-gene-green)]" : "bg-[var(--color-border)]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
