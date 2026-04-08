import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-gene-green)] text-[var(--color-background-elevated)] shadow-[0_10px_26px_-16px_color-mix(in_oklab,var(--color-gene-green)_75%,black)] hover:-translate-y-0.5 hover:bg-[color-mix(in_oklab,var(--color-gene-green)_90%,white)]",
        destructive:
          "bg-[var(--color-destructive)] text-white shadow-[0_10px_26px_-18px_color-mix(in_oklab,var(--color-destructive)_72%,black)] hover:-translate-y-0.5 hover:bg-[color-mix(in_oklab,var(--color-destructive)_88%,white)]",
        outline:
          "border border-[var(--color-border-strong)] bg-[color-mix(in_oklab,var(--color-background-elevated)_82%,transparent)] text-[var(--color-foreground)] hover:-translate-y-0.5 hover:border-[var(--color-gene-green)]/40 hover:bg-[color-mix(in_oklab,var(--color-gene-green)_8%,var(--color-background-elevated))]",
        secondary:
          "bg-[var(--color-surface-muted)] text-[var(--color-foreground)] hover:bg-[color-mix(in_oklab,var(--color-surface-muted)_84%,var(--color-gene-green)_8%)]",
        ghost:
          "text-[var(--color-foreground-soft)] hover:bg-[color-mix(in_oklab,var(--color-gene-green)_8%,transparent)] hover:text-[var(--color-foreground)]",
        link: "h-auto min-h-0 rounded-none px-0 text-[var(--color-gene-green)] underline-offset-4 hover:text-[var(--color-foreground)] hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "min-h-9 px-3 text-xs",
        lg: "min-h-12 px-5 text-sm",
        icon: "h-10 w-10 rounded-full px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
