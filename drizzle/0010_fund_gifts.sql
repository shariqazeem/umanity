CREATE TABLE "fund_gifts" (
	"ref" text PRIMARY KEY NOT NULL,
	"cluster" text NOT NULL,
	"giver" text NOT NULL,
	"user_id" text,
	"amount_micro" bigint NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"signature" text,
	"anonymous" boolean DEFAULT false NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "fund_gifts_signature_idx" ON "fund_gifts" USING btree ("signature");--> statement-breakpoint
CREATE INDEX "fund_gifts_status_idx" ON "fund_gifts" USING btree ("cluster","status");--> statement-breakpoint
CREATE INDEX "fund_gifts_user_idx" ON "fund_gifts" USING btree ("user_id");