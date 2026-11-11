import { asc } from "drizzle-orm";
import type { Term } from "@/plan/pricing";
import type { Database } from "./client";
import { loadPriceBook } from "./price-book";
import { products, services } from "./schema";

// Plain objects (no Maps) so the server can hand them to the browser.
export type CatalogueProduct = {
  id: string;
  name: string;
  category: "technology" | "furniture" | "office_appliances";
  specs: string;
  monthlyFils: Partial<Record<Term, number>>;
};

export type CatalogueService = {
  id: string;
  name: string;
  description: string;
  monthlyFils: Partial<Record<Term, number>>;
};

export type Catalogue = { products: CatalogueProduct[]; services: CatalogueService[] };

// Everything the plan screen shows, with names in the customer's language.
// An Arabic name that is still empty falls back to English rather than showing nothing.
export async function loadCatalogue(db: Database, locale: "en" | "ar"): Promise<Catalogue> {
  const [productRows, serviceRows, priceBook] = await Promise.all([
    db.select().from(products).orderBy(asc(products.category), asc(products.name)),
    db.select().from(services).orderBy(asc(services.name)),
    loadPriceBook(db),
  ]);
  const inArabic = locale === "ar";

  return {
    products: productRows.map((row) => ({
      id: row.id,
      name: (inArabic && row.nameAr) || row.name,
      category: row.category,
      specs: row.specs,
      monthlyFils: { ...priceBook.products.get(row.id) },
    })),
    services: serviceRows.map((row) => ({
      id: row.id,
      name: (inArabic && row.nameAr) || row.name,
      description: (inArabic && row.descriptionAr) || row.description,
      monthlyFils: { ...priceBook.services.get(row.id) },
    })),
  };
}
