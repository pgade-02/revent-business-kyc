import { sql } from "drizzle-orm";
import { DOCUMENT_SLOTS } from "@/kyc/documents/slots";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "reviewer"]);

// v1 has no sign-up: one seeded customer and one seeded reviewer (PRD §4).
// The customer's details pre-fill "Your account".
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  role: userRole("role").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile"),
  companyName: text("company_name"),
});

export const productCategory = pgEnum("product_category", ["technology", "furniture", "office_appliances"]);

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Catalogue text is data, so its Arabic lives next to the English, not in messages/.
  nameAr: text("name_ar").notNull().default(""),
  category: productCategory("category").notNull(),
  specs: text("specs").notNull().default(""),
  // True when any of this product's prices is a placeholder, not taken from the live site.
  isDemoPrice: boolean("is_demo_price").notNull().default(true),
});

export const services = pgTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull().default(""),
  description: text("description").notNull().default(""),
  descriptionAr: text("description_ar").notNull().default(""),
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

export const applicationRoute = pgEnum("application_route", ["self_disclosure", "verification_call"]);
export const applicationStatus = pgEnum("application_status", ["draft", "submitted"]);

// One customer application. Money figures are computed on the server when the plan is saved.
// Company, signatory and document details are added by later steps (later migrations).
export const applications = pgTable(
  "applications",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    status: applicationStatus("status").notNull().default("draft"),
    term: integer("term").notNull(),
    planMonthlyFils: integer("plan_monthly_fils").notNull(),
    contractTotalFils: integer("contract_total_fils").notNull(),
    route: applicationRoute("route").notNull(),
    scoringSettingsVersion: integer("scoring_settings_version")
      .notNull()
      .references(() => scoringSettings.version),
    // Company details as typed by the customer (PRD §4, screen 4). Empty until saved.
    companyName: text("company_name"),
    licenceNumber: text("licence_number"),
    yearEstablished: integer("year_established"), // stored, never scored (SECURITY §6)
    issuingAuthority: text("issuing_authority"),
    emirate: text("emirate"),
    legalForm: text("legal_form"),
    trn: text("trn"),
    registeredAddress: text("registered_address"),
    deliverToRegisteredAddress: boolean("deliver_to_registered_address"),
    // Authorised signatory as typed (PRD §4, screen 6). Empty until saved.
    signatoryIsApplicant: boolean("signatory_is_applicant"),
    signatoryName: text("signatory_name"),
    signatoryEmail: text("signatory_email"),
    signatoryMobile: text("signatory_mobile"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [check("applications_term_offered", sql`${table.term} IN (24, 36, 48)`)],
);

export const planItems = pgTable(
  "plan_items",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id")
      .notNull()
      .references(() => applications.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    serviceIds: text("service_ids").array().notNull().default(sql`'{}'::text[]`),
  },
  (table) => [check("plan_items_quantity_positive", sql`${table.quantity} >= 1`)],
);

export const documentSlot = pgEnum("document_slot", DOCUMENT_SLOTS);
// "checking" while the file is being read; "failed" if processing crashed (the customer can retry).
export const documentStatus = pgEnum("document_status", ["checking", "ready", "needs_fix", "needs_review", "failed"]);
export const checkStatus = pgEnum("check_status", ["pass", "warn", "fail", "skipped"]);

// One row per uploaded file. A file that is replaced keeps its row (replacedAt set),
// so the reviewer's history and earlier check results stay intact.
export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id")
      .notNull()
      .references(() => applications.id),
    slot: documentSlot("slot").notNull(),
    fileKey: text("file_key").notNull(), // where the FileStore keeps it; never shown to anyone
    fileKind: text("file_kind").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    pageCount: integer("page_count").notNull(),
    sha256: text("sha256").notNull(),
    perceptualHash: text("perceptual_hash"),
    imageWidth: integer("image_width"), // photos only; DOC_UNREADABLE checks the size
    imageHeight: integer("image_height"),
    status: documentStatus("status").notNull().default("checking"),
    fields: jsonb("fields"), // values read from the document, validated by Zod on the way out
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    replacedAt: timestamp("replaced_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [index("documents_sha256").on(table.sha256), index("documents_application").on(table.applicationId)],
);

// One row per check per run (ARCHITECTURE §6).
export const checkResults = pgTable("check_results", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id),
  code: text("code").notNull(),
  status: checkStatus("status").notNull(),
  detail: text("detail").notNull(),
  evidencePage: integer("evidence_page"),
  customerMessageKey: text("customer_message_key"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

// One row per Part 2 run (ARCHITECTURE §2). A resubmit adds a row; old ones are kept.
// Score, money figures and insights are added by later steps.
export const assessments = pgTable(
  "assessments",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id")
      .notNull()
      .references(() => applications.id),
    scoringSettingsVersion: integer("scoring_settings_version")
      .notNull()
      .references(() => scoringSettings.version),
    checks: jsonb("checks").notNull(), // CheckResult[] from the cross-checks, validated by Zod on the way out
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [index("assessments_application").on(table.applicationId)],
);
