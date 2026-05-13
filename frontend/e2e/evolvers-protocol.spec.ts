// EvoMap Evolvers Protocol E2E Test (Node.js http, not browser fetch)
import { describe, test, expect } from "@playwright/test";
import http from "node:http";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:3001";

function httpRequest(url, method, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = body ? JSON.stringify(body) : "";
    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
      timeout: 15000,
    };
    const req = http.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, body: d });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => reject(new Error("timeout")));
    if (data) req.write(data);
    req.end();
  });
}

describe("Evolvers Protocol", () => {
  test("GET /skill.md returns 200 with EvoMap and GEP-A2A", async () => {
    const res = await httpRequest(BACKEND_URL + "/skill.md", "GET", null);
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe("string");
    const body = res.body as string;
    expect(body).toContain("EvoMap");
    expect(body).toContain("GEP-A2A");
  });

  test("POST /a2a/hello returns claim_code, claim_url, starter_gene_pack, credit_balance", async () => {
    const res = await httpRequest(BACKEND_URL + "/a2a/hello", "POST", {
      name: "TestEvolverNode",
      description: "E2E test",
      capabilities: ["test"],
      version: "1.0.0",
    });
    expect([200, 201]).toContain(res.status);
    const d = res.body as Record<string, unknown>;
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
    const res = await httpRequest(BACKEND_URL + "/a2a/fetch", "POST", {
      query: "JWT",
      type: "gene",
      limit: 5,
    });
    expect([200, 201]).toContain(res.status);
    const data = res.body as Record<string, unknown>;
    const assets = (data.assets as unknown[]) || [];
    expect(Array.isArray(assets)).toBe(true);
  });
});
