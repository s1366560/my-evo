import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-11 w-full rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-input-background)] px-4 py-2 text-sm text-[var(--color-foreground)] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-background-elevated)_72%,transparent)] transition-colors placeholder:text-[var(--color-foreground-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
