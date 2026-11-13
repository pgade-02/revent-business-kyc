CREATE TABLE "assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"scoring_settings_version" integer NOT NULL,
	"checks" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_scoring_settings_version_scoring_settings_version_fk" FOREIGN KEY ("scoring_settings_version") REFERENCES "public"."scoring_settings"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessments_application" ON "assessments" USING btree ("application_id");