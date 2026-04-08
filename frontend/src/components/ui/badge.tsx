import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--color-gene-green)] text-white",
        secondary:
          "border-transparent bg-[var(--color-border)] text-[var(--color-foreground)]",
        destructive:
          "border-transparent bg-[var(--color-destructive)] text-white",
        outline:
          "border-[var(--color-border)] text-[var(--color-foreground)]",
        gene:
          "border-transparent bg-[var(--color-gene-green)]/10 text-[var(--color-gene-green)]",
        capsule:
          "border-transparent bg-[var(--color-capsule-blue)]/10 text-[var(--color-capsule-blue)]",
        recipe:
          "border-transparent bg-[var(--color-recipe-amber)]/10 text-[var(--color-recipe-amber)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
