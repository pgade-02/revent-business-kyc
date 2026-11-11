import type { PriceBook, Term } from "@/plan/pricing";
import type { Database } from "./client";
import { prices } from "./schema";

// Reads the `prices` table into the PriceBook shape that pricePlan() expects.
export async function loadPriceBook(db: Database): Promise<PriceBook> {
  const rows = await db.select().from(prices);
  const productPrices = new Map<string, Partial<Record<Term, number>>>();
  const servicePrices = new Map<string, Partial<Record<Term, number>>>();

  for (const row of rows) {
    // The database only allows 24, 36 and 48 (check constraint), so this cast is safe.
    const term = row.term as Term;
    const itemId = row.productId ?? row.serviceId;
    const target = row.productId ? productPrices : servicePrices;
    if (itemId === null) continue; // impossible: a check constraint requires one of the two
    target.set(itemId, { ...target.get(itemId), [term]: row.monthlyFils });
  }

  return { products: productPrices, services: servicePrices };
}
