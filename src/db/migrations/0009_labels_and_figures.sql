ALTER TABLE "assessments" ADD COLUMN "figures" jsonb;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "figures_problem" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payer" text;