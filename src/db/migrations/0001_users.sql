CREATE TYPE "public"."user_role" AS ENUM('customer', 'reviewer');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"mobile" text,
	"company_name" text
);
