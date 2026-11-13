import { describe, expect, it } from "vitest";
import { jaroWinklerBps } from "@/kyc/matching/jaro-winkler";

describe("jaroWinklerBps", () => {
  // Reference values from Winkler's papers on record linkage.
  it.each([
    ["martha", "marhta", 9_611],
    ["dwayne", "duane", 8_400],
    ["dixon", "dicksonx", 8_133],
  ])("scores %s / %s as %i", (a, b, expected) => {
    expect(jaroWinklerBps(a, b)).toBe(expected);
  });

  it("gives identical words 10000 and words with nothing in common 0", () => {
    expect(jaroWinklerBps("omar", "omar")).toBe(10_000);
    expect(jaroWinklerBps("abc", "xyz")).toBe(0);
    expect(jaroWinklerBps("", "omar")).toBe(0);
  });

  it("is symmetric", () => {
    expect(jaroWinklerBps("chaudhary", "chaudhry")).toBe(jaroWinklerBps("chaudhry", "chaudhary"));
  });
});
