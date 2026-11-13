CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"date" date NOT NULL,
	"amount_fils" bigint NOT NULL,
	"balance_fils" bigint,
	"description" text NOT NULL,
	"page" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_document" ON "transactions" USING btree ("document_id");