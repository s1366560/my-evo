"use client";

import * as React from "react";

export interface SliderProps {
  defaultValue?: number[];
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ defaultValue = [0], value, onValueChange, min = 0, max = 100, step = 1, disabled, className = "" }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const currentValue = value ?? internalValue;
    const currentOnChange = onValueChange ?? setInternalValue;

    const handleChange = (newValue: number[]) => {
      currentOnChange(newValue);
    };

    const percentage = ((currentValue[0] - min) / (max - min)) * 100;

    return (
      <div
        ref={ref}
        className={`relative flex w-full touch-none select-none items-center ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
      >
        <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-[var(--color-muted-background)]">
          <div
            className="absolute h-full rounded-full bg-[var(--color-gene-green)]"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue[0]}
          disabled={disabled}
          onChange={(e) => handleChange([Number(e.target.value)])}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        />
        <div
          className="absolute h-4 w-4 rounded-full border-2 border-[var(--color-gene-green)] bg-white shadow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gene-green)]"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
