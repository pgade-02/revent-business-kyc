import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "@/db/applications";
import { loadCatalogue } from "@/db/catalogue";
import { openDatabase, type Database } from "@/db/client";
import { applications, planItems } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";

let db: Database;

beforeAll(async () => {
  db = await openDatabase();
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$client.close();
});

describe("createApplication", () => {
  it("prices the plan from the database and saves it with its items", async () => {
    const result = await createApplication(db, "seed-customer", {
      term: 36,
      lines: [
        { productId: "wireless-business-headset", quantity: 1, serviceIds: [] },
        { productId: "meeting-room-display-65", quantity: 1, serviceIds: [] },
      ],
    });
    if (!result.ok) throw new Error(`expected success, got ${result.reason}`);

    expect(result.totals.planMonthlyFils).toBe(23_681);
    expect(result.route).toBe("self_disclosure"); // 852,516 fils is below AED 40,000

    const [saved] = await db.select().from(applications).where(eq(applications.id, result.applicationId));
    expect(saved).toMatchObject({
      ownerId: "seed-customer",
      status: "draft",
      term: 36,
      planMonthlyFils: 23_681,
      contractTotalFils: 852_516,
      scoringSettingsVersion: 1,
    });
    expect(await db.select().from(planItems).where(eq(planItems.applicationId, result.applicationId))).toHaveLength(2);
  });

  it("routes a plan at or above the threshold to the verification call", async () => {
    // 10 displays × AED 286.00 × 24 months = AED 68,640
    const result = await createApplication(db, "seed-customer", {
      term: 24,
      lines: [{ productId: "meeting-room-display-65", quantity: 10, serviceIds: ["device-care"] }],
    });
    expect(result.ok && result.route).toBe("verification_call");
  });

  it("saves nothing when a product is unknown", async () => {
    const before = (await db.select().from(applications)).length;
    const result = await createApplication(db, "seed-customer", {
      term: 24,
      lines: [{ productId: "no-such-product", quantity: 1, serviceIds: [] }],
    });
    expect(result).toMatchObject({ ok: false, reason: "MISSING_PRICE" });
    expect(await db.select().from(applications)).toHaveLength(before);
  });
});

describe("loadCatalogue", () => {
  it("returns Arabic names for Arabic and English names for English", async () => {
    const arabic = await loadCatalogue(db, "ar");
    const english = await loadCatalogue(db, "en");
    const headset = (catalogue: typeof arabic) => catalogue.products.find((p) => p.id === "wireless-business-headset");

    expect(headset(arabic)?.name).toBe("سماعة رأس لاسلكية للأعمال");
    expect(headset(english)?.name).toBe("Wireless business headset");
    expect(headset(english)?.monthlyFils).toEqual({ 24: 4_290, 36: 3_089, 48: 2_445 });
    expect(english.services).toHaveLength(4);
  });
});
