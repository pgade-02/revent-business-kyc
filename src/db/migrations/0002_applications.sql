CREATE TYPE "public"."application_route" AS ENUM('self_disclosure', 'verification_call');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"status" "application_status" DEFAULT 'draft' NOT NULL,
	"term" integer NOT NULL,
	"plan_monthly_fils" integer NOT NULL,
	"contract_total_fils" integer NOT NULL,
	"route" "application_route" NOT NULL,
	"scoring_settings_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "applications_term_offered" CHECK ("applications"."term" IN (24, 36, 48))
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"service_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "plan_items_quantity_positive" CHECK ("plan_items"."quantity" >= 1)
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "name_ar" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "name_ar" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "description_ar" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_scoring_settings_version_scoring_settings_version_fk" FOREIGN KEY ("scoring_settings_version") REFERENCES "public"."scoring_settings"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;