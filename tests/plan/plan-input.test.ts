import { describe, expect, it } from "vitest";
import { planInputSchema } from "@/plan/plan-input";

const validLine = { productId: "wireless-business-headset", quantity: 1, serviceIds: [] };

describe("planInputSchema", () => {
  it("accepts a normal plan", () => {
    expect(planInputSchema.safeParse({ term: 36, lines: [validLine] }).success).toBe(true);
  });

  it("drops any totals the browser tries to send", () => {
    const parsed = planInputSchema.parse({ term: 36, lines: [validLine], planMonthlyFils: 1 });
    expect(parsed).not.toHaveProperty("planMonthlyFils");
  });

  it.each([
    ["a 12-month term", { term: 12, lines: [validLine] }],
    ["an empty plan", { term: 36, lines: [] }],
    ["a zero quantity", { term: 36, lines: [{ ...validLine, quantity: 0 }] }],
    ["a fractional quantity", { term: 36, lines: [{ ...validLine, quantity: 1.5 }] }],
    ["a service listed twice", { term: 36, lines: [{ ...validLine, serviceIds: ["device-care", "device-care"] }] }],
  ])("rejects %s", (_name, input) => {
    expect(planInputSchema.safeParse(input).success).toBe(false);
  });
});
