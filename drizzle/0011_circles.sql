CREATE TABLE "circles" (
	"cluster" text NOT NULL,
	"number" integer NOT NULL,
	"owner" text NOT NULL,
	"gift_ref" text,
	"asset" text,
	"signature" text,
	"status" text DEFAULT 'assigned' NOT NULL,
	"frozen" boolean DEFAULT true NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempted_at" timestamp with time zone,
	"minted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "circles_number_idx" ON "circles" USING btree ("cluster","number");--> statement-breakpoint
CREATE UNIQUE INDEX "circles_owner_idx" ON "circles" USING btree ("cluster","owner");