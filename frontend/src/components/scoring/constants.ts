// GDI scoring page constants — shared across components

export const GDI_DIMENSIONS = [
  {
    name: "Structural",
    key: "structural",
    desc: "Code quality, modularity, and documentation completeness",
    weight: 0.2,
    color: "var(--color-gene-green)",
  },
  {
    name: "Semantic",
    key: "semantic",
    desc: "Semantic richness, clarity of intent, and context relevance",
    weight: 0.25,
    color: "var(--color-capsule-blue)",
  },
  {
    name: "Specificity",
    key: "specificity",
    desc: "Precision of problem definition and solution scope",
    weight: 0.2,
    color: "var(--color-recipe-amber)",
  },
  {
    name: "Strategy",
    key: "strategy",
    desc: "Actionability and executability of proposed steps",
    weight: 0.15,
    color: "var(--color-organism-purple)",
  },
  {
    name: "Validation",
    key: "validation",
    desc: "Test coverage, pass rates, and reproducibility",
    weight: 0.2,
    color: "var(--color-trust-gold)",
  },
] as const;
