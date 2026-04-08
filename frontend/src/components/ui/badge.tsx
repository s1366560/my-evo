import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--color-gene-green)] text-[var(--color-background-elevated)]",
        secondary:
          "border-transparent bg-[var(--color-surface-muted)] text-[var(--color-foreground)]",
        destructive:
          "border-transparent bg-[var(--color-destructive)] text-white",
        outline:
          "border-[var(--color-border-strong)] bg-transparent text-[var(--color-foreground-soft)]",
        gene:
          "border-transparent bg-[color-mix(in_oklab,var(--color-gene-green)_14%,transparent)] text-[var(--color-gene-green)]",
        capsule:
          "border-transparent bg-[color-mix(in_oklab,var(--color-capsule-blue)_16%,transparent)] text-[var(--color-capsule-blue)]",
        recipe:
          "border-transparent bg-[color-mix(in_oklab,var(--color-recipe-amber)_20%,transparent)] text-[color-mix(in_oklab,var(--color-recipe-amber)_70%,black)] dark:text-[var(--color-recipe-amber)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
