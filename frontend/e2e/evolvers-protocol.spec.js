const { chromium } = require("playwright");
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:3001";
async function runTests() {
  const browser = await chromium.launch({ headless: true });
  let passed = 0, failed = 0, errors = [];
  try {
    // Test 1: GET /skill.md
    { console.log("Test 1: GET /skill.md");
      const page = await browser.newPage();
      const r = await page.goto(BACKEND_URL + "/skill.md", { waitUntil: "domcontentloaded" });
      if (r.status() !== 200) throw new Error("Expected 200, got " + r.status());
      const ct = r.headers()["content-type"] || "";
      if (!ct.includes("text/markdown")) throw new Error("Expected text/markdown, got " + ct);
      const body = await page.content();
      const text = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (!text.includes("EvoMap")) throw new Error("Missing EvoMap");
      if (!text.includes("GEP-A2A")) throw new Error("Missing GEP-A2A");
      console.log("  PASS"); passed++; await page.close(); }
    // Test 2: POST /a2a/hello
    { console.log("Test 2: POST /a2a/hello");
      const page = await browser.newPage();
      const pl = { name: "TestEvolverNode", description: "E2E test", capabilities: ["test"], version: "1.0.0" };
      const r = await page.evaluate(async ([url, body]) => {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        return { status: res.status, body: await res.json() };
      }, [BACKEND_URL + "/a2a/hello", pl]);
      if (r.status !== 200 && r.status !== 201) throw new Error("Expected 200 or 201, got " + r.status);
      const d = r.body;
      if (!("claim_code" in d)) throw new Error("missing claim_code");
      if (!("claim_url" in d)) throw new Error("missing claim_url");
      if (typeof d.claim_url !== "string" || d.claim_url.length === 0) throw new Error("bad claim_url: " + JSON.stringify(d.claim_url));
      if (!("starter_gene_pack" in d)) throw new Error("missing starter_gene_pack");
      if (!Array.isArray(d.starter_gene_pack)) throw new Error("starter_gene_pack not array");
      if (!("credit_balance" in d)) throw new Error("missing credit_balance");
      if (typeof d.credit_balance !== "number") throw new Error("credit_balance not number");
      console.log("  PASS"); passed++; await page.close(); }
    // Test 3: POST /a2a/fetch
    { console.log("Test 3: POST /a2a/fetch");
      const page = await browser.newPage();
      const pl = { query: "JWT", type: "gene", limit: 5 };
      const r = await page.evaluate(async ([url, body]) => {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        return { status: res.status, body: await res.json() };
      }, [BACKEND_URL + "/a2a/fetch", pl]);
      if (r.status !== 200 && r.status !== 201) throw new Error("Expected 200 or 201, got " + r.status);
      const data = r.body;
      const assets = data.assets || data;
      if (!Array.isArray(assets)) throw new Error("Response must have assets array");
      console.log("  PASS"); passed++; await page.close(); }
  } catch(err) { console.error("  FAIL:", err.message); errors.push(err.message); failed++; }
  finally { await browser.close(); }
  console.log("Passed: " + passed + "/3, Failed: " + failed + "/3");
  if (errors.length > 0) { errors.forEach(e => console.log("  - " + e)); process.exit(1); }
  else { console.log("All tests passed!"); process.exit(0); }
}
runTests().catch(err => { console.error("Fatal:", err); process.exit(1); });
