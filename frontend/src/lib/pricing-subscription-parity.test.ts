/**
 * Parity contract test: /pricing and /subscription must show
 * the exact same plan cards. /subscription is a 308 redirect
 * to /pricing (next.config.mjs) and also re-exports the
 * PricingPage default component as a fallback. The pricing
 * page must import PLANS from the shared module (no local
 * re-definition) so any future change to plan data shows up
 * identically on both routes.
 *
 * Implementation note: this is a static check that reads the
 * two page source files and looks for the required import +
 * the absence of a local PLANS const. Reading the files from
 * disk keeps the test independent of Next's module-graph and
 * works under plain ts-jest (no React renderer required).
 */
import * as fs from "fs";
import * as path from "path";

const PRICING_PAGE = path.resolve(__dirname, "../app/pricing/page.tsx");
const SUBSCRIPTION_PAGE = path.resolve(
  __dirname,
  "../app/subscription/page.tsx",
);

describe("/pricing and /subscription parity", () => {
  let pricingSrc: string;
  let subscriptionSrc: string;

  beforeAll(() => {
    pricingSrc = fs.readFileSync(PRICING_PAGE, "utf8");
    subscriptionSrc = fs.readFileSync(SUBSCRIPTION_PAGE, "utf8");
  });

  test("pricing page imports PLANS from @/lib/plans", () => {
    expect(pricingSrc).toMatch(/import\s*\{\s*PLANS\s*\}\s*from\s*["']@\/lib\/plans["']/);
  });

  test("pricing page does not define its own PLANS const", () => {
    // The previous P1 gap had a local `const PLANS = [...]` here.
    // After the refactor, PLANS is imported from @/lib/plans and
    // no local copy is allowed.
    expect(pricingSrc).not.toMatch(/const\s+PLANS\s*[:=]\s*\[/);
  });

  test("pricing page renders PLANS via .map", () => {
    expect(pricingSrc).toMatch(/PLANS\.map\(/);
  });

  test("subscription page re-exports the pricing page default", () => {
    // Re-export pattern that makes both routes render the same component.
    expect(subscriptionSrc).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*["']@?\/app\/pricing\/page["']/,
    );
  });

  test("subscription page does not define its own tier list", () => {
    // The old /subscription had `const tiers: SubscriptionTier[] = [...]`
    // with conflicting prices ($29 / $99). That block must be gone.
    expect(subscriptionSrc).not.toMatch(/const\s+tiers\s*[:=]/);
  });

  test("next.config.mjs has a 308 /subscription -> /pricing redirect", () => {
    // The redirect is the URL-parity enforcement. The page re-export
    // is the fallback for hosts that bypass redirects.
    const cfgPath = path.resolve(__dirname, "../../next.config.mjs");
    const cfg = fs.readFileSync(cfgPath, "utf8");
    expect(cfg).toMatch(/source:\s*['"]\/subscription['"]/);
    expect(cfg).toMatch(/destination:\s*['"]\/pricing['"]/);
    expect(cfg).toMatch(/permanent:\s*true/);
  });
});
