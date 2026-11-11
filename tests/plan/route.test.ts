import { describe, expect, it } from "vitest";
import { routeForContractTotal } from "@/plan/route";

// Threshold is a test value here; the real one comes from scoring_settings.
const thresholdFils = 4_000_000; // AED 40,000

describe("routeForContractTotal", () => {
  it("goes to self-disclosure below the threshold", () => {
    expect(routeForContractTotal(thresholdFils - 1, thresholdFils)).toBe("self_disclosure");
  });
  it("goes to the verification call at or above the threshold", () => {
    expect(routeForContractTotal(thresholdFils, thresholdFils)).toBe("verification_call");
    expect(routeForContractTotal(thresholdFils + 1, thresholdFils)).toBe("verification_call");
  });
});
