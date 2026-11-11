import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const productCategory = pgEnum("product_category", ["technology", "furniture", "office_appliances"]);

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: productCategory("category").notNull(),
  specs: text("specs").notNull().default(""),
  // True when any of this product's prices is a placeholder, not taken from the live site.
  isDemoPrice: boolean("is_demo_price").notNull().default(true),
});

export const services = pgTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
});

// One row per (product or service, term). Prices are stored, never derived.
export const prices = pgTable(
  "prices",
  {
    id: serial("id").primaryKey(),
    productId: text("product_id").references(() => products.id),
    serviceId: text("service_id").references(() => services.id),
    term: integer("term").notNull(),
    monthlyFils: integer("monthly_fils").notNull(),
  },
  (table) => [
    check("prices_exactly_one_item", sql`(${table.productId} IS NULL) <> (${table.serviceId} IS NULL)`),
    check("prices_term_offered", sql`${table.term} IN (24, 36, 48)`),
    check("prices_not_negative", sql`${table.monthlyFils} >= 0`),
    uniqueIndex("prices_product_term").on(table.productId, table.term),
    uniqueIndex("prices_service_term").on(table.serviceId, table.term),
  ],
);

// Versioned: a new version is a new row, so old assessments can say which one they used.
export const scoringSettings = pgTable("scoring_settings", {
  version: integer("version").primaryKey(),
  settings: jsonb("settings").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});
