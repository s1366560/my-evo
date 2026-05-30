"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { progressRootVariants, progressIndicatorVariants, type ProgressVariant, type ProgressSize } from "./progress-variants";

export interface ProgressProps
  extends Omit<React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>, "value">,
    VariantProps<typeof progressRootVariants> {
  value?: number;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, variant, size, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(progressRootVariants({ variant, size }), className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(progressIndicatorVariants({ variant }))}
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress, progressRootVariants, progressIndicatorVariants };
export type { ProgressVariant, ProgressSize };
