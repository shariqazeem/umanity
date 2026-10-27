ALTER TABLE "donations" ADD COLUMN "anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "field_deliveries" ADD COLUMN "media" jsonb;--> statement-breakpoint
ALTER TABLE "field_deliveries" ADD COLUMN "posted_by" text;--> statement-breakpoint
ALTER TABLE "field_deliveries" ADD COLUMN "proposal_id" text;--> statement-breakpoint
ALTER TABLE "field_deliveries" ADD COLUMN "post_id" text;