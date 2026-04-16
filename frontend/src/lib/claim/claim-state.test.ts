import { getClaimFailureState } from "./claim-state";

describe("getClaimFailureState", () => {
  it("maps already-claimed messages", () => {
    expect(getClaimFailureState("This node has already been claimed").kind).toBe("already-claimed");
  });

  it("maps invalid or expired claim messages", () => {
    expect(getClaimFailureState("Invalid or expired claim code").kind).toBe("invalid-code");
    expect(getClaimFailureState("Claim code not found").kind).toBe("invalid-code");
  });

  it("maps auth errors", () => {
    expect(getClaimFailureState("Authentication required").kind).toBe("auth-required");
  });

  it("falls back to retryable errors", () => {
    expect(getClaimFailureState("Something unexpected happened").kind).toBe("retryable");
  });
});
