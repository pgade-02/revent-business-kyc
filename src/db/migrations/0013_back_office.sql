CREATE TYPE "public"."document_review_state" AS ENUM('to_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."timeline_event" AS ENUM('document_uploaded', 'document_removed', 'company_details_changed', 'signatory_details_changed', 'submitted', 'assessment_ready', 'owner_changed', 'stage_changed', 'document_reviewed', 'information_requested');--> statement-breakpoint
ALTER TYPE "public"."application_status" ADD VALUE 'in_review';--> statement-breakpoint
ALTER TYPE "public"."application_status" ADD VALUE 'waiting_on_customer';--> statement-breakpoint
ALTER TYPE "public"."application_status" ADD VALUE 'approved';--> statement-breakpoint
ALTER TYPE "public"."application_status" ADD VALUE 'rejected';--> statement-breakpoint
CREATE TABLE "info_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"subject" text NOT NULL,
	"reason" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "info_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"actor_id" text,
	"event" timeline_event NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "stage_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "uploaded_by" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "review_state" "document_review_state" DEFAULT 'to_review' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "info_request_items" ADD CONSTRAINT "info_request_items_request_id_info_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."info_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "info_requests" ADD CONSTRAINT "info_requests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "info_requests" ADD CONSTRAINT "info_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "info_requests_application" ON "info_requests" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "timeline_events_application" ON "timeline_events" USING btree ("application_id");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_reference_unique" UNIQUE("reference");--> statement-breakpoint
-- Applications submitted before the back office existed get a reference in the same format
-- (no 0, O, 1 or I) and start their waiting time at Submit.
UPDATE "applications"
SET "reference" = 'RB-' || to_char("submitted_at", 'YY') || '-' || translate(upper(substr(md5("id"::text), 1, 6)), '01', 'QR'),
    "stage_changed_at" = "submitted_at"
WHERE "submitted_at" IS NOT NULL AND "reference" IS NULL;
