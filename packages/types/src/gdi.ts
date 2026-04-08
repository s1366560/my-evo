import type { GDIStructured } from "./asset";

export interface GDIScore extends GDIStructured {
  /** Raw GDI score (0-100), available from flat API responses */
  gdi_score?: number;
}

export function normalizeGDI(
  raw: number | GDIStructured | undefined
): GDIStructured | null {
  if (raw === undefined) return null;
  if (typeof raw === "number") {
    return {
      overall: raw,
      dimensions: {
        usefulness: raw,
        novelty: raw,
        rigor: raw,
        reuse: raw,
      },
      _flat: true,
    };
  }
  return raw;
}

export function gdiDimensions(d: GDIStructured["dimensions"]) {
  return [
    { key: "usefulness", label: "Usefulness", value: d.usefulness, weight: 0.3 },
    { key: "novelty", label: "Novelty", value: d.novelty, weight: 0.25 },
    { key: "rigor", label: "Rigor", value: d.rigor, weight: 0.25 },
    { key: "reuse", label: "Reuse", value: d.reuse, weight: 0.2 },
  ];
}
