"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const tooltipContentVariants = cva(
  "z-50 overflow-hidden rounded-lg border bg-overlay/95 px-3 py-1.5 text-xs text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  {
    variants: {
      variant: {
        default: "border-border/50 backdrop-blur-sm",
        inverted: "border-border bg-background text-foreground",
        solid: "border-border bg-background text-foreground shadow-lg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
    VariantProps<typeof tooltipContentVariants> {
  sideOffset?: number;
  avoidCollisions?: boolean;
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, variant, sideOffset = 4, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(tooltipContentVariants({ variant }), className)}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="text-border/50" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Convenience component that combines trigger and content
export interface TooltipWrapperProps {
  children: React.ReactNode;
  content: React.ReactNode;
  variant?: VariantProps<typeof tooltipContentVariants>["variant"];
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  disableHoverableContent?: boolean;
}

export function TooltipWrapper({
  children,
  content,
  variant,
  side = "top",
  align = "center",
  delayDuration = 400,
  disableHoverableContent = false,
}: TooltipWrapperProps) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip disableHoverableContent={disableHoverableContent}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} align={align} variant={variant}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Headless tooltip hook for custom trigger elements
export function useTooltip({
  defaultOpen = false,
  delayDuration = 400,
  disableHoverableContent = false,
}: {
  defaultOpen?: boolean;
  delayDuration?: number;
  disableHoverableContent?: boolean;
} = {}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return {
    open,
    setOpen,
    onOpenChange: setOpen,
    delayDuration,
    disableHoverableContent,
  };
}

export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
};
