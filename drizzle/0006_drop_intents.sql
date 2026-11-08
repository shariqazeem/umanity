ALTER TABLE "intents" ADD COLUMN "drop_id" integer;--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "target_micro" bigint;--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "received_micro" bigint;--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "give_ref" text;--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "give_signature" text;--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "give_valid_until" bigint;--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "returned_micro" bigint;--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "return_signature" text;--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "intents_drop_idx" ON "intents" USING btree ("drop_id");