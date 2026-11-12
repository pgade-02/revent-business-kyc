import { describe, expect, it } from "vitest";
import { daysBetween, isIsoDate, todayInDubai } from "@/kyc/dates";

describe("todayInDubai", () => {
  it("is already tomorrow in Dubai late in the UTC evening (Dubai is UTC+4)", () => {
    expect(todayInDubai(new Date("2026-11-11T21:30:00Z"))).toBe("2026-11-12");
    expect(todayInDubai(new Date("2026-11-11T19:59:00Z"))).toBe("2026-11-11");
  });
});

describe("daysBetween", () => {
  it("counts whole days, positive when the second date is later", () => {
    expect(daysBetween("2026-11-12", "2027-01-11")).toBe(60);
    expect(daysBetween("2026-11-12", "2026-11-11")).toBe(-1);
    expect(daysBetween("2026-11-12", "2026-11-12")).toBe(0);
  });

  it("crosses a leap day correctly", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("returns null for text that is not a real date", () => {
    expect(daysBetween("2026-02-30", "2026-03-01")).toBeNull();
    expect(daysBetween("12/11/2026", "2026-11-12")).toBeNull();
  });
});

describe("isIsoDate", () => {
  it("accepts YYYY-MM-DD only", () => {
    expect(isIsoDate("2026-11-12")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-11-12T00:00:00Z")).toBe(false);
  });
});
