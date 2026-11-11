import { describe, expect, it } from "vitest";
import { formatAed } from "@/lib/format-money";

describe("formatAed", () => {
  it("shows fils as AED with two decimals", () => {
    expect(formatAed(23_681, "en")).toMatch(/AED\s?236\.81/);
    expect(formatAed(584_760, "en")).toMatch(/AED\s?5,847\.60/);
    expect(formatAed(0, "en")).toMatch(/AED\s?0\.00/);
  });
});
