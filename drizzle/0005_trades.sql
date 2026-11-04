CREATE TABLE "trades" (
	"signature" text PRIMARY KEY NOT NULL,
	"cluster" text NOT NULL,
	"address" text NOT NULL,
	"input_mint" text NOT NULL,
	"output_mint" text NOT NULL,
	"in_amount" text NOT NULL,
	"out_amount" text NOT NULL,
	"usd_micro" bigint,
	"fee_bps" integer DEFAULT 0 NOT NULL,
	"fee_micro" bigint DEFAULT 0 NOT NULL,
	"sponsored" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "trades_address_idx" ON "trades" USING btree ("address");--> statement-breakpoint
CREATE INDEX "trades_time_idx" ON "trades" USING btree ("cluster","created_at");