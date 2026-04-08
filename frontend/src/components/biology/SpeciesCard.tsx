"use client";

interface SpeciesStats {
  name: string;
  count: number;
  avgGDI: number;
}

interface SpeciesCardProps {
  species: SpeciesStats;
}

export function SpeciesCard({ species }: SpeciesCardProps) {
  const gdiColor =
    species.avgGDI >= 80
      ? "var(--color-gene-green)"
      : species.avgGDI >= 60
      ? "var(--color-capsule-blue)"
      : "var(--color-recipe-amber)";

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: gdiColor }}
        />
        <span className="text-sm text-[var(--color-foreground)]">
          {species.name}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-[var(--color-muted-foreground)]">
          {species.count} genes
        </span>
        <span
          className="font-medium tabular-nums"
          style={{ color: gdiColor }}
        >
          GDI {species.avgGDI.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
