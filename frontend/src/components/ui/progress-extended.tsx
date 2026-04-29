"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";
import { progressRootVariants, progressIndicatorVariants, type ProgressVariant, type ProgressSize } from "./progress-variants";

// Progress with label
export interface ProgressLabelProps {
  label?: string;
  valueLabel?: string;
  showPercentage?: boolean;
  value?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  className?: string;
}

export function ProgressLabel({ label, valueLabel, showPercentage = true, value, variant = "default", size = "default", className }: ProgressLabelProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        {label && <p className="text-sm font-medium text-foreground">{label}</p>}
        {showPercentage && value !== undefined && <span className="text-sm font-medium text-muted-foreground">{Math.round(value)}%</span>}
        {valueLabel && !showPercentage && <span className="text-sm font-medium text-muted-foreground">{valueLabel}</span>}
      </div>
      <ProgressPrimitive.Root className={cn(progressRootVariants({ variant, size }))}>
        <ProgressPrimitive.Indicator className={cn(progressIndicatorVariants({ variant }))} style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }} />
      </ProgressPrimitive.Root>
    </div>
  );
}

// Circular progress
const circularVariantColors: Record<ProgressVariant, string> = { default: "stroke-primary", destructive: "stroke-destructive", success: "stroke-emerald-500", warning: "stroke-amber-500", outline: "stroke-foreground" };

export interface CircularProgressProps { value: number; size?: number; strokeWidth?: number; variant?: ProgressVariant; showValue?: boolean; className?: string; }

export function CircularProgress({ value, size = 64, strokeWidth = 4, variant = "default", showValue = true, className }: CircularProgressProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className={cn("transition-all duration-300 ease-out", circularVariantColors[variant])} />
      </svg>
      {showValue && <span className="absolute text-sm font-semibold text-foreground">{Math.round(normalizedValue)}%</span>}
    </div>
  );
}

// Multi progress
export interface MultiProgressItem { label: string; value: number; color?: ProgressVariant; }
export interface MultiProgressProps { items: MultiProgressItem[]; showValues?: boolean; className?: string; }

export function MultiProgress({ items, showValues = true, className }: MultiProgressProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item, index) => (
        <div key={index} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            {showValues && <span className="font-medium text-foreground">{item.value}%</span>}
          </div>
          <ProgressPrimitive.Root className={cn(progressRootVariants({ variant: item.color }))}>
            <ProgressPrimitive.Indicator className={cn(progressIndicatorVariants({ variant: item.color }))} style={{ transform: `translateX(-${100 - item.value}%)` }} />
          </ProgressPrimitive.Root>
        </div>
      ))}
    </div>
  );
}

// Striped animated progress
const stripedGradient = "linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)";

export interface StripedProgressProps { value: number; variant?: ProgressVariant; size?: ProgressSize; striped?: boolean; animated?: boolean; className?: string; }

export function StripedProgress({ value, variant = "default", size = "default", striped = false, animated = true, className }: StripedProgressProps) {
  return (
    <ProgressPrimitive.Root className={cn("overflow-hidden", progressRootVariants({ variant, size }), className)}>
      <ProgressPrimitive.Indicator
        className={cn("h-full w-full flex-1 transition-all duration-300 ease-out", progressIndicatorVariants({ variant }), animated && "animate-[stripe-move_1s_linear_infinite]")}
        style={{
          transform: `translateX(-${100 - value}%)`,
          ...(striped && { backgroundImage: stripedGradient, backgroundSize: "40px 40px" }),
        }}
      />
    </ProgressPrimitive.Root>
  );
}
