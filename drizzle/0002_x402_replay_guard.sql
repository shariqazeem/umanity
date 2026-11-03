ALTER TABLE "x402_receipts" ADD COLUMN "payment_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "x402_receipts_payment_hash_idx" ON "x402_receipts" USING btree ("payment_hash");