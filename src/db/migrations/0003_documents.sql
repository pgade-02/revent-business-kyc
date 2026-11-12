CREATE TYPE "public"."check_status" AS ENUM('pass', 'warn', 'fail', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."document_slot" AS ENUM('trade_licence', 'tax_certificate', 'bank_statement', 'passport', 'emirates_id_front', 'emirates_id_back', 'self_disclosure');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('checking', 'ready', 'needs_fix', 'needs_review', 'failed');--> statement-breakpoint
CREATE TABLE "check_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"code" text NOT NULL,
	"status" "check_status" NOT NULL,
	"detail" text NOT NULL,
	"evidence_page" integer,
	"customer_message_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"slot" "document_slot" NOT NULL,
	"file_key" text NOT NULL,
	"file_kind" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"page_count" integer NOT NULL,
	"sha256" text NOT NULL,
	"perceptual_hash" text,
	"image_width" integer,
	"image_height" integer,
	"status" "document_status" DEFAULT 'checking' NOT NULL,
	"fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replaced_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "check_results" ADD CONSTRAINT "check_results_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_sha256" ON "documents" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "documents_application" ON "documents" USING btree ("application_id");