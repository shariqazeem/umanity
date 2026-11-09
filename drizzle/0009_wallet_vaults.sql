CREATE TABLE "wallet_vaults" (
	"credential_id" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"salt" text NOT NULL,
	"iv" text NOT NULL,
	"ct" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "wallet_vaults_address_idx" ON "wallet_vaults" USING btree ("address");