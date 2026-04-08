import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        gene: "var(--color-gene-green)",
        capsule: "var(--color-capsule-blue)",
        recipe: "var(--color-recipe-amber)",
        trust: {
          gold: "var(--color-trust-gold)",
          silver: "var(--color-trust-silver)",
        },
        border: "var(--color-border)",
        muted: {
          foreground: "var(--color-muted-foreground)",
        },
        card: {
          background: "var(--color-card-background)",
          foreground: "var(--color-card-foreground)",
        },
        input: "var(--color-input-background)",
        ring: "var(--color-ring)",
      },
    },
  },
  plugins: [],
} satisfies Config;
