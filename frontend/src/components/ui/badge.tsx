import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-gene-green)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--color-gene-green)] text-black",
        secondary: "border-transparent bg-[var(--color-surface-muted)] text-[var(--color-foreground)]",
        destructive: "border-transparent bg-red-600 text-white",
        outline: "border-[var(--color-border)] text-[var(--color-foreground)]",
        gene: "border-transparent bg-[color-mix(in_oklab,var(--color-gene-green)_15%,transparent)] text-[var(--color-gene-green)]",
        capsule: "border-transparent bg-[color-mix(in_oklab,var(--color-capsule-blue)_15%,transparent)] text-[var(--color-capsule-blue)]",
        recipe: "border-transparent bg-[color-mix(in_oklab,var(--color-recipe-amber)_15%,transparent)] text-[var(--color-recipe-amber)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
