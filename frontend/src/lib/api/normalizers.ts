// API response normalizers — converts raw API shapes to typed frontend models

export interface GDIStructured {
  overall: number;
  usefulness: number;
  novelty: number;
  safety: number;
  efficiency: number;
}

export interface GDICompact {
  gdi: number;
}

export function normalizeGDI(raw: GDIStructured | GDICompact | number | null | undefined): GDIStructured {
  if (!raw) {
    return { overall: 0, usefulness: 0, novelty: 0, safety: 0, efficiency: 0 };
  }
  if (typeof raw === "number") {
    return { overall: raw, usefulness: 0, novelty: 0, safety: 0, efficiency: 0 };
  }
  if ("gdi" in raw) {
    return { overall: raw.gdi, usefulness: 0, novelty: 0, safety: 0, efficiency: 0 };
  }
  return raw as GDIStructured;
}

export function normalizeCredits(raw: number | string | null | undefined): number {
  if (typeof raw === "string") return parseInt(raw, 10);
  if (typeof raw === "number") return raw;
  return 0;
}
