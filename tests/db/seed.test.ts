import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/db/client";
import { loadPriceBook } from "@/db/price-book";
import { prices, products, scoringSettings, services } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";
import { scoringSettingsSchema } from "@/kyc/scoring/settings-schema";
import { pricePlan, type Term } from "@/plan/pricing";

let db: Database;

beforeAll(async () => {
  db = await openDatabase(); // in-memory, thrown away after the tests
  await seedDatabase(db);
  await seedDatabase(db); // a second run must not duplicate or fail
});

afterAll(async () => {
  await db.$client.close();
});

describe("seeded catalogue", () => {
  it("has products in all three categories, each priced at 24, 36 and 48 months", async () => {
    const productRows = await db.select().from(products);
    const categories = new Set(productRows.map((row) => row.category));
    expect(categories).toEqual(new Set(["technology", "furniture", "office_appliances"]));

    expect(await db.select().from(services)).toHaveLength(4);
    // (9 products + 4 services) × 3 terms; the second seed run added nothing.
    expect(await db.select().from(prices)).toHaveLength(39);
  });

  it("prices headset + 65-inch display at 36 months as 23,681 fils/month", async () => {
    const priceBook = await loadPriceBook(db);
    const result = pricePlan(
      [
        { productId: "wireless-business-headset", serviceIds: [], quantity: 1 },
        { productId: "meeting-room-display-65", serviceIds: [], quantity: 1 },
      ],
      36,
      priceBook,
    );
    expect(result.ok && result.totals.planMonthlyFils).toBe(23_681);
  });

  it("matches the live site's ThinkPad E14 + Managed setup + Device care monthly totals", async () => {
    const priceBook = await loadPriceBook(db);
    const siteMonthlyFils: Record<Term, number> = { 24: 23_205, 36: 17_408, 48: 14_302 };
    for (const term of [24, 36, 48] as const) {
      const result = pricePlan(
        [{ productId: "lenovo-thinkpad-e14", serviceIds: ["managed-setup", "device-care"], quantity: 1 }],
        term,
        priceBook,
      );
      expect(result.ok && result.totals.planMonthlyFils).toBe(siteMonthlyFils[term]);
    }
  });

  it("rejects a price for a term that is not offered", async () => {
    await expect(
      db.insert(prices).values({ productId: "paper-shredder", term: 12, monthlyFils: 100 }),
    ).rejects.toThrow();
  });
});

describe("seeded scoring settings", () => {
  it("stores version 1 and it passes the settings schema", async () => {
    const [row] = await db.select().from(scoringSettings);
    expect(row?.version).toBe(1);
    const settings = scoringSettingsSchema.parse(row?.settings);
    expect(settings.routeThresholdFils).toBe(4_000_000);
    expect(settings.expiresSoonDays).toBe(60);
  });
});
