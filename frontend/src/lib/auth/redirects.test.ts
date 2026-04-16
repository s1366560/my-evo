import { appendRedirectQuery, sanitizePostAuthRedirect } from "./redirects";

describe("auth redirect helpers", () => {
  it("keeps safe internal claim redirects", () => {
    expect(sanitizePostAuthRedirect("/claim/REEF-4X7K?resume=1")).toBe("/claim/REEF-4X7K?resume=1");
  });

  it("falls back for empty or external redirects", () => {
    expect(sanitizePostAuthRedirect("")).toBe("/dashboard");
    expect(sanitizePostAuthRedirect("https://evil.example/claim")).toBe("/dashboard");
    expect(sanitizePostAuthRedirect("//evil.example/claim")).toBe("/dashboard");
  });

  it("appends a safe redirect query without losing existing params", () => {
    expect(appendRedirectQuery("/login?registered=true", "/claim/REEF-4X7K?resume=1")).toBe(
      "/login?registered=true&redirect=%2Fclaim%2FREEF-4X7K%3Fresume%3D1",
    );
  });
});
