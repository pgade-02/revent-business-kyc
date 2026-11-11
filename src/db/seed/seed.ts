import { scoringSettingsSchema } from "@/kyc/scoring/settings-schema";
import { TERMS } from "@/plan/pricing";
import type { Database } from "../client";
import { prices, products, scoringSettings, services, users } from "../schema";
import { seedProducts, seedServices } from "./catalogue";
import { startingScoringSettings } from "./scoring-settings";
import { seedUsers } from "./users";

// Safe to run more than once: rows that already exist are left alone.
export async function seedDatabase(db: Database): Promise<void> {
  await db.insert(users).values([...seedUsers]).onConflictDoNothing();

  await db
    .insert(products)
    .values(seedProducts.map(({ id, name, category, specs }) => ({ id, name, category, specs, isDemoPrice: true })))
    .onConflictDoNothing();

  await db
    .insert(services)
    .values(seedServices.map(({ id, name, description }) => ({ id, name, description })))
    .onConflictDoNothing();

  const productPrices = seedProducts.flatMap((product) =>
    TERMS.map((term) => ({ productId: product.id, term, monthlyFils: product.monthlyFils[term] })),
  );
  const servicePrices = seedServices.flatMap((service) =>
    TERMS.map((term) => ({ serviceId: service.id, term, monthlyFils: service.monthlyFils[term] })),
  );
  await db.insert(prices).values([...productPrices, ...servicePrices]).onConflictDoNothing();

  // Validate before saving so a bad settings file never reaches the database.
  const settings = scoringSettingsSchema.parse(startingScoringSettings);
  await db.insert(scoringSettings).values({ version: 1, settings }).onConflictDoNothing();
}
