// EvoMap Design Tokens — single source of truth
// All colors are exported as CSS variables defined in globals.css

export const COLORS = {
  // Brand asset colors
  geneGreen: "var(--color-gene-green)",
  capsuleBlue: "var(--color-capsule-blue)",
  recipeAmber: "var(--color-recipe-amber)",
  trustGold: "var(--color-trust-gold)",
  trustSilver: "var(--color-trust-silver)",
  // Semantic
  background: "var(--color-background)",
  foreground: "var(--color-foreground)",
  border: "var(--color-border)",
  mutedForeground: "var(--color-muted-foreground)",
  cardBackground: "var(--color-card-background)",
  cardForeground: "var(--color-card-foreground)",
  inputBackground: "var(--color-input-background)",
  ring: "var(--color-ring)",
  destructive: "var(--color-destructive)",
  success: "var(--color-success)",
} as const;

export const SPACING = {
  xs: "var(--spacing-xs)",
  sm: "var(--spacing-sm)",
  md: "var(--spacing-md)",
  lg: "var(--spacing-lg)",
  xl: "var(--spacing-xl)",
  "2xl": "var(--spacing-2xl)",
} as const;

export const TYPOGRAPHY = {
  fontFamily:
    "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif)",
  monoFamily:
    "var(--font-mono, ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace)",
} as const;

export const BREAKPOINTS = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

export const RADIUS = {
  default: "var(--radius)",
  sm: "calc(var(--radius) * 0.5)",
  lg: "calc(var(--radius) * 1.5)",
  full: "9999px",
} as const;

// Asset type colors as Tailwind utility values (e.g. text-gene, bg-capsule)
export const ASSET_COLORS = {
  gene: "var(--color-gene-green)",
  capsule: "var(--color-capsule-blue)",
  recipe: "var(--color-recipe-amber)",
} as const;
