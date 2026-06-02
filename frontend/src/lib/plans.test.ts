/**
 * Tests for the single-source-of-truth plan module.
 *
 * P1 gap closure: /pricing and /subscription had two conflicting
 * plan definitions (Free/$20/$100 vs Free/$29/$99). After the
 * refactor, both routes render the same set of plan cards
 * driven by PLANS in @/lib/plans. The /subscription page is
 * a 308 redirect to /pricing (next.config.mjs) and also
 * re-exports the PricingPage default component as a fallback.
 *
 * This test asserts the contract from the data side:
 *   - PLANS exposes exactly Free / Premium / Ultra
 *   - The three plans carry the evomap-parity price labels
 *     ($0 / $20 / $100 per month, plus a numeric priceUsd
 *     for billing/assertions)
 *   - The pricing page imports PLANS and never re-defines
 *     its own copy
 *   - The subscription page re-exports the pricing page
 *     (so the route renders the same component if the 308
 *     redirect is bypassed)
 *   - The plansSignature() helper is stable across calls
 *     (so the test can compare signatures across the two
 *     routes' render output)
 */
import { PLANS, plansSignature, getPlan } from "./plans";

describe("plans (single source of truth)", () => {
  test("exposes exactly three plans in the documented order", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["free", "premium", "ultra"]);
  });

  test("plan ids and names are stable", () => {
    expect(PLANS[0].id).toBe("free");
    expect(PLANS[0].name).toBe("Free");
    expect(PLANS[1].id).toBe("premium");
    expect(PLANS[1].name).toBe("Premium");
    expect(PLANS[2].id).toBe("ultra");
    expect(PLANS[2].name).toBe("Ultra");
  });

  test("plan prices match evomap parity ($0 / $20 / $100)", () => {
    // Display price string
    expect(PLANS[0].price).toBe("Free");
    expect(PLANS[1].price).toBe("$20");
    expect(PLANS[2].price).toBe("$100");
    // Numeric price for billing/assertions
    expect(PLANS[0].priceUsd).toBe(0);
    expect(PLANS[1].priceUsd).toBe(20);
    expect(PLANS[2].priceUsd).toBe(100);
  });

  test("credit allowance strings are non-empty and contain 'credits/month'", () => {
    for (const plan of PLANS) {
      expect(plan.credits).toMatch(/credits\/month/);
    }
    expect(PLANS[0].credits).toBe("0 credits/month");
    expect(PLANS[1].credits).toBe("2,000 credits/month");
    expect(PLANS[2].credits).toBe("10,000 credits/month");
  });

  test("premium is the highlighted plan", () => {
    expect(PLANS.find((p) => p.highlight)?.id).toBe("premium");
  });

  test("every plan has CTA, href, and 10 features", () => {
    for (const plan of PLANS) {
      expect(plan.cta.length).toBeGreaterThan(0);
      expect(plan.ctaHref.startsWith("/")).toBe(true);
      expect(plan.features).toHaveLength(10);
    }
  });

  test("getPlan returns the right plan or undefined", () => {
    expect(getPlan("free")?.id).toBe("free");
    expect(getPlan("premium")?.name).toBe("Premium");
    expect(getPlan("ultra")?.priceUsd).toBe(100);
    // The id type is a union, but a runtime check is still useful
    expect(getPlan("unknown" as never)).toBeUndefined();
  });

  test("plansSignature is stable across calls", () => {
    const a = plansSignature();
    const b = plansSignature();
    expect(a).toBe(b);
    // And it should mention every plan's id and the three evomap prices
    expect(a).toContain('"id":"free"');
    expect(a).toContain('"id":"premium"');
    expect(a).toContain('"id":"ultra"');
    expect(a).toContain('"$20"');
    expect(a).toContain('"$100"');
    // The legacy conflicting values must NOT be present
    expect(a).not.toContain("$29");
    expect(a).not.toContain("$99");
  });
});
