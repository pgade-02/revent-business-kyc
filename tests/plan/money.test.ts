import { describe, expect, it } from "vitest";
import { averageRoundHalfUp, divideRoundHalfUp, ratioBps, vatOnMonthly } from "@/plan/money";

describe("divideRoundHalfUp", () => {
  it("rounds halves up", () => {
    expect(divideRoundHalfUp(3, 2)).toBe(2);
    expect(divideRoundHalfUp(5, 2)).toBe(3);
  });
  it("rounds below a half down", () => {
    expect(divideRoundHalfUp(29, 20)).toBe(1); // 1.45
  });
  it("rounds negative halves away from zero", () => {
    expect(divideRoundHalfUp(-3, 2)).toBe(-2);
  });
  it("throws on non-integers and zero denominators (bugs, not user errors)", () => {
    expect(() => divideRoundHalfUp(1.5, 2)).toThrow();
    expect(() => divideRoundHalfUp(1, 0)).toThrow();
  });
});

describe("vatOnMonthly", () => {
  it("is 5% of the monthly total, rounded half-up to whole fils", () => {
    expect(vatOnMonthly(23_681)).toBe(1_184); // 1184.05
    expect(vatOnMonthly(10)).toBe(1); // 0.5
    expect(vatOnMonthly(29)).toBe(1); // 1.45
    expect(vatOnMonthly(30)).toBe(2); // 1.5
    expect(vatOnMonthly(0)).toBe(0);
  });
});

describe("averageRoundHalfUp", () => {
  it("sums in fils and rounds once at the end", () => {
    expect(averageRoundHalfUp([1, 2])).toBe(2); // 1.5
    expect(averageRoundHalfUp([100, 101, 101])).toBe(101); // 100.67
  });
  it("returns null for no values", () => {
    expect(averageRoundHalfUp([])).toBeNull();
  });
});

describe("ratioBps", () => {
  it("gives basis points rounded half-up", () => {
    expect(ratioBps(23_681, 4_500_000)).toBe(53); // 52.6 bps
    expect(ratioBps(1_125_000, 4_500_000)).toBe(2_500);
  });
  it("returns null when the denominator is 0 (no income)", () => {
    expect(ratioBps(23_681, 0)).toBeNull();
  });
});
