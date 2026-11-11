import { sql } from "drizzle-orm";
import { scoringSettingsSchema } from "@/kyc/scoring/settings-schema";
import { TERMS } from "@/plan/pricing";
import type { Database } from "../client";
import { prices, products, scoringSettings, services, users } from "../schema";
import { seedProducts, seedServices } from "./catalogue";
import { startingScoringSettings } from "./scoring-settings";
import { seedUsers } from "./users";

// "excluded" is Postgres's name for the row we tried to insert. Copying from it
// means "if this row already exists, overwrite it with the seed values".
const fromSeed = (column: string) => sql.raw(`excluded.${column}`);

// Safe to run more than once. The catalogue (products, services, prices) is
// kept in sync with the seed files; users and settings are never overwritten.
export async function seedDatabase(db: Database): Promise<void> {
  await db.insert(users).values([...seedUsers]).onConflictDoNothing();

  await db
    .insert(products)
    .values(
      seedProducts.map(({ id, name, nameAr, category, specs, allPricesFromSite }) => ({
        id,
        name,
        nameAr,
        category,
        specs,
        isDemoPrice: !allPricesFromSite,
      })),
    )
    .onConflictDoUpdate({
      target: products.id,
      set: {
        name: fromSeed("name"),
        nameAr: fromSeed("name_ar"),
        category: fromSeed("category"),
        specs: fromSeed("specs"),
        isDemoPrice: fromSeed("is_demo_price"),
      },
    });

  await db
    .insert(services)
    .values(
      seedServices.map(({ id, name, nameAr, description, descriptionAr }) => ({ id, name, nameAr, description, descriptionAr })),
    )
    .onConflictDoUpdate({
      target: services.id,
      set: {
        name: fromSeed("name"),
        nameAr: fromSeed("name_ar"),
        description: fromSeed("description"),
        descriptionAr: fromSeed("description_ar"),
      },
    });

  const productPrices = seedProducts.flatMap((product) =>
    TERMS.map((term) => ({ productId: product.id, term, monthlyFils: product.monthlyFils[term] })),
  );
  await db
    .insert(prices)
    .values(productPrices)
    .onConflictDoUpdate({ target: [prices.productId, prices.term], set: { monthlyFils: fromSeed("monthly_fils") } });

  const servicePrices = seedServices.flatMap((service) =>
    TERMS.map((term) => ({ serviceId: service.id, term, monthlyFils: service.monthlyFils[term] })),
  );
  await db
    .insert(prices)
    .values(servicePrices)
    .onConflictDoUpdate({ target: [prices.serviceId, prices.term], set: { monthlyFils: fromSeed("monthly_fils") } });

  // Validate before saving so a bad settings file never reaches the database.
  const settings = scoringSettingsSchema.parse(startingScoringSettings);
  await db.insert(scoringSettings).values({ version: 1, settings }).onConflictDoNothing();
}
