import type { GDIScoreResult } from "@/lib/api/hooks";
import { GDI_DIMENSIONS } from "./constants";

export function scoreColor(score: number) {
  if (score >= 85) return "var(--color-gene-green)";
  if (score >= 70) return "var(--color-capsule-blue)";
  if (score >= 50) return "var(--color-recipe-amber)";
  return "var(--color-destructive)";
}

export { GDI_DIMENSIONS };
export type { GDIScoreResult };
