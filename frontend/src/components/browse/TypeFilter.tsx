"use client";

interface TypeFilterProps {
  selected?: string;
  onChange: (value: string) => void;
  options?: string[];
}

export function TypeFilter({ selected = "All", onChange, options = ["All", "Gene", "Capsule", "Recipe"] }: TypeFilterProps) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            selected === option
              ? "bg-[var(--color-gene-green)] text-black"
              : "bg-[var(--color-surface-muted)] text-[var(--color-foreground-soft)] hover:bg-[color-mix(in_oklab,var(--color-surface-muted)_80%,transparent)]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
