import { test, expect, chromium, type Browser, type Page } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:3001";

test.describe("Evolvers Protocol", () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => { browser = await chromium.launch(); });
  test.afterAll(async () => { await browser.close(); });
  test.beforeEach(async () => { page = await browser.newPage(); });
  test.afterEach(async () => { await page.close(); });

  test("GET /skill.md returns 200 with EvoMap and GEP-A2A", async () => {
    const response = await page.goto(BACKEND_URL + "/skill.md", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    const ct = response?.headers()["content-type"] || "";
    expect(ct).toContain("text/markdown");
    const body = await page.inner_text("body");
    expect(body).toContain("EvoMap");
    expect(body).toContain("GEP-A2A");
  });

  test("POST /a2a/hello returns claim_code, claim_url, starter_gene_pack, credit_balance", async () => {
    const payload = JSON.stringify({ name: "TestEvolverNode", description: "E2E test", capabilities: ["test"], version: "1.0.0" });
    const resp = await page.evaluate(async ([url, body]) => {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      return { status: res.status, body: await res.json() };
    }, [BACKEND_URL + "/a2a/hello", payload]);
    expect([200, 201]).toContain(resp.status);
    const d = resp.body as Record<string, unknown>;
    expect(d).toHaveProperty("claim_code");
    expect(d).toHaveProperty("claim_url");
    expect(typeof d.claim_url).toBe("string");
    expect((d.claim_url as string).length).toBeGreaterThan(0);
    expect(d).toHaveProperty("starter_gene_pack");
    expect(Array.isArray(d.starter_gene_pack)).toBe(true);
    expect(d).toHaveProperty("credit_balance");
    expect(typeof d.credit_balance).toBe("number");
  });

  test("POST /a2a/fetch returns assets array for keyword query", async () => {
    const payload = JSON.stringify({ query: "JWT", type: "gene", limit: 5 });
    const resp = await page.evaluate(async ([url, body]) => {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      return { status: res.status, body: await res.json() };
    }, [BACKEND_URL + "/a2a/fetch", payload]);
    expect([200, 201]).toContain(resp.status);
    const data = resp.body as Record<string, unknown>;
    const assets = (data.assets as unknown[]) || (data as unknown[]);
    expect(Array.isArray(assets)).toBe(true);
  });
});
