ALTER TABLE "applications" ADD COLUMN "signatory_is_applicant" boolean;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "signatory_name" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "signatory_email" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "signatory_mobile" text;