ALTER TYPE "public"."timeline_event" ADD VALUE 'information_provided';--> statement-breakpoint
ALTER TABLE "info_request_items" ADD COLUMN "note_ar" text;--> statement-breakpoint
ALTER TABLE "info_request_items" ADD COLUMN "resolved_at" timestamp with time zone;