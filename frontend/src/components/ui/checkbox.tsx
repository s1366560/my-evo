"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const checkboxRootVariants = cva(
  "peer h-4 w-4 shrink-0 rounded-[4px] border border-border ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary transition-colors duration-150",
  {
    variants: {
      variant: {
        default: "",
        destructive: "data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground data-[state=checked]:border-destructive data-[state=indeterminate]:bg-destructive data-[state=indeterminate]:text-destructive-foreground data-[state=indeterminate]:border-destructive",
        outline: "border-2 data-[state=checked]:bg-transparent data-[state=checked]:text-foreground",
        ghost: "border-transparent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground",
      },
      size: {
        default: "h-4 w-4",
        sm: "h-3.5 w-3.5",
        lg: "h-5 w-5 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxRootVariants> {}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, variant, size, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(checkboxRootVariants({ variant, size }), className)}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      {props.checked === "indeterminate" ? (
        <Minus className="h-3 w-3" strokeWidth={3} />
      ) : (
        <Check className="h-3 w-3" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

// Label wrapper component
export interface CheckboxLabelProps extends React.ComponentPropsWithoutRef<"label"> {
  checkboxId: string;
  children: React.ReactNode;
}

function CheckboxLabel({ checkboxId, children, className, ...props }: CheckboxLabelProps) {
  return (
    <label htmlFor={checkboxId} className={cn("cursor-pointer text-sm", className)} {...props}>
      {children}
    </label>
  );
}

// Checkbox group for multiple related checkboxes
export interface CheckboxGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  description?: string;
  children: React.ReactNode;
}

function CheckboxGroup({ label, description, children, className, ...props }: CheckboxGroupProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {(label || description) && (
        <div className="space-y-1">
          {label && <p className="text-sm font-medium text-foreground">{label}</p>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// Checkbox item with label
export interface CheckboxItemProps extends CheckboxProps {
  label: string;
  description?: string;
  disabled?: boolean;
}

function CheckboxItem({
  label,
  description,
  disabled,
  className,
  ...props
}: CheckboxItemProps) {
  const id = React.useId();

  return (
    <div className={cn("flex items-start gap-2.5", disabled && "opacity-50", className)}>
      <Checkbox id={id} disabled={disabled} {...props} />
      <CheckboxLabel checkboxId={id} className="flex flex-col gap-0.5 pt-0.5">
        <span className="text-sm font-normal leading-none text-foreground">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </CheckboxLabel>
    </div>
  );
}

// Helper hook for checkbox state management
export function useCheckboxGroup<T extends string>(
  options: Array<{ value: T; label: string; disabled?: boolean }>,
  defaultValues: T[] = []
) {
  const [values, setValues] = React.useState<T[]>(defaultValues);

  const toggle = React.useCallback((value: T) => {
    setValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }, []);

  const isChecked = React.useCallback(
    (value: T) => values.includes(value),
    [values]
  );

  const selectAll = React.useCallback(() => {
    setValues(options.filter((o) => !o.disabled).map((o) => o.value));
  }, [options]);

  const clearAll = React.useCallback(() => {
    setValues([]);
  }, []);

  return {
    values,
    setValues,
    toggle,
    isChecked,
    selectAll,
    clearAll,
  };
}

export {
  Checkbox,
  CheckboxLabel,
  CheckboxGroup,
  CheckboxItem,
};
