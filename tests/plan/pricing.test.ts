import { describe, expect, it } from "vitest";
import { pricePlan, type PriceBook } from "@/plan/pricing";

// Prices at 36 months from the live site. Other terms are left out on purpose
// (not known), which also exercises the MISSING_PRICE path.
const prices: PriceBook = {
  products: new Map([
    ["wireless-business-headset", { 36: 3_089 }],
    ["meeting-room-display-65", { 36: 20_592 }],
  ]),
  services: new Map([["test-service", { 36: 500 }]]),
};

describe("pricePlan", () => {
  it("headset + 65-inch display at 36 months = 23,681 fils/month excl. VAT", () => {
    const result = pricePlan(
      [
        { productId: "wireless-business-headset", serviceIds: [], quantity: 1 },
        { productId: "meeting-room-display-65", serviceIds: [], quantity: 1 },
      ],
      36,
      prices,
    );
    expect(result).toEqual({
      ok: true,
      totals: {
        term: 36,
        planMonthlyFils: 23_681,
        vatMonthlyFils: 1_184,
        monthlyInclVatFils: 24_865,
        contractTotalFils: 852_516,
        contractTotalInclVatFils: 895_140,
      },
    });
  });

  it("matches the live site: ThinkPad E14 with 2 services, 24 months", () => {
    // Site shows equipment AED 171.05 + services AED 61.00 = AED 232.05/mo,
    // VAT AED 11.60, AED 243.65 incl. VAT, full term AED 5,569.20 excl. VAT and
    // AED 5,847.60 incl. VAT. The two services' split is not shown,
    // so they are one combined test price here.
    const sitePrices: PriceBook = {
      products: new Map([["lenovo-thinkpad-e14", { 24: 17_105 }]]),
      services: new Map([["managed-setup-plus-device-care", { 24: 6_100 }]]),
    };
    const result = pricePlan(
      [{ productId: "lenovo-thinkpad-e14", serviceIds: ["managed-setup-plus-device-care"], quantity: 1 }],
      24,
      sitePrices,
    );
    expect(result).toEqual({
      ok: true,
      totals: {
        term: 24,
        planMonthlyFils: 23_205,
        vatMonthlyFils: 1_160,
        monthlyInclVatFils: 24_365,
        contractTotalFils: 556_920,
        contractTotalInclVatFils: 584_760,
      },
    });
  });

  it("adds services to the item price before multiplying by quantity", () => {
    const result = pricePlan(
      [{ productId: "wireless-business-headset", serviceIds: ["test-service"], quantity: 2 }],
      36,
      prices,
    );
    expect(result.ok && result.totals.planMonthlyFils).toBe((3_089 + 500) * 2);
  });

  it("fails on an empty plan", () => {
    expect(pricePlan([], 36, prices)).toEqual({ ok: false, reason: "EMPTY_PLAN" });
  });

  it("fails on a zero or fractional quantity", () => {
    for (const quantity of [0, 1.5]) {
      const result = pricePlan([{ productId: "wireless-business-headset", serviceIds: [], quantity }], 36, prices);
      expect(result).toMatchObject({ ok: false, reason: "INVALID_QUANTITY" });
    }
  });

  it("fails when a product or service has no price for the term", () => {
    expect(
      pricePlan([{ productId: "wireless-business-headset", serviceIds: [], quantity: 1 }], 24, prices),
    ).toEqual({ ok: false, reason: "MISSING_PRICE", itemId: "wireless-business-headset", term: 24 });
    expect(
      pricePlan([{ productId: "wireless-business-headset", serviceIds: ["unknown"], quantity: 1 }], 36, prices),
    ).toEqual({ ok: false, reason: "MISSING_PRICE", itemId: "unknown", term: 36 });
  });
});
