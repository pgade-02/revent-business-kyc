CREATE TYPE "public"."product_category" AS ENUM('technology', 'furniture', 'office_appliances');--> statement-breakpoint
CREATE TABLE "prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" text,
	"service_id" text,
	"term" integer NOT NULL,
	"monthly_fils" integer NOT NULL,
	CONSTRAINT "prices_exactly_one_item" CHECK (("prices"."product_id" IS NULL) <> ("prices"."service_id" IS NULL)),
	CONSTRAINT "prices_term_offered" CHECK ("prices"."term" IN (24, 36, 48)),
	CONSTRAINT "prices_not_negative" CHECK ("prices"."monthly_fils" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "product_category" NOT NULL,
	"specs" text DEFAULT '' NOT NULL,
	"is_demo_price" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_settings" (
	"version" integer PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prices_product_term" ON "prices" USING btree ("product_id","term");--> statement-breakpoint
CREATE UNIQUE INDEX "prices_service_term" ON "prices" USING btree ("service_id","term");