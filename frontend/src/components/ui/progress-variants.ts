import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const progressRootVariants = cva(
  "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
  {
    variants: {
      variant: {
        default: "bg-primary/20",
        destructive: "bg-destructive/20",
        success: "bg-emerald-500/20",
        warning: "bg-amber-500/20",
        outline: "bg-transparent border border-border",
      },
      size: {
        default: "h-2",
        sm: "h-1",
        lg: "h-3",
        xl: "h-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export const progressIndicatorVariants = cva(
  "h-full w-full flex-1 bg-primary transition-all duration-300 ease-out",
  {
    variants: {
      variant: {
        default: "bg-primary",
        destructive: "bg-destructive",
        success: "bg-emerald-500",
        warning: "bg-amber-500",
        outline: "bg-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export type ProgressVariant = "default" | "destructive" | "success" | "warning" | "outline";
export type ProgressSize = "default" | "sm" | "lg" | "xl";
