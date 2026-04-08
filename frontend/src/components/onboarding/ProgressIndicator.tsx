"use client";

import { cn } from "@/lib/utils";

interface Step {
  number: number;
  label: string;
}

const STEPS: Step[] = [
  { number: 1, label: "Register Node" },
  { number: 2, label: "Publish Asset" },
  { number: 3, label: "Setup Swarm" },
  { number: 4, label: "Dashboard" },
];

interface ProgressIndicatorProps {
  currentStep: number;
}

export function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, index) => {
        const isCompleted = step.number < currentStep;
        const isActive = step.number === currentStep;
        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                  isCompleted &&
                    "border-[var(--color-gene-green)] bg-[var(--color-gene-green)] text-white",
                  isActive &&
                    "border-[var(--color-gene-green)] bg-white text-[var(--color-gene-green)]",
                  !isCompleted &&
                    !isActive &&
                    "border-[var(--color-border)] bg-white text-[var(--color-muted-foreground)]"
                )}
              >
                {isCompleted ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={cn(
                  "mt-1.5 whitespace-nowrap text-xs",
                  isActive
                    ? "font-medium text-[var(--color-gene-green)]"
                    : "text-[var(--color-muted-foreground)]"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 w-8 sm:w-16 transition-colors",
                  isCompleted
                    ? "bg-[var(--color-gene-green)]"
                    : "bg-[var(--color-border)]"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
