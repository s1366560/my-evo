import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gene-green)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-gene-green)] text-black hover:bg-[color-mix(in_oklab,var(--color-gene-green)_85%,black)]",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-surface-muted)] text-[var(--color-foreground)]",
        secondary: "bg-[var(--color-surface-muted)] text-[var(--color-foreground)] hover:bg-[color-mix(in_oklab,var(--color-surface-muted)_80%,transparent)]",
        ghost: "hover:bg-[var(--color-surface-muted)] text-[var(--color-foreground)]",
        link: "text-[var(--color-gene-green)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
