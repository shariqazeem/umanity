CREATE TABLE "drop_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster" text NOT NULL,
	"proposer" text NOT NULL,
	"meta" jsonb NOT NULL,
	"goal_cents" integer NOT NULL,
	"cap_cents" integer NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"drop_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proof_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster" text NOT NULL,
	"drop_id" integer NOT NULL,
	"runner" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"x_post_url" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drops" ADD COLUMN "kind" text DEFAULT 'official' NOT NULL;--> statement-breakpoint
ALTER TABLE "drops" ADD COLUMN "proposal_id" text;--> statement-breakpoint
CREATE INDEX "drop_proposals_status_idx" ON "drop_proposals" USING btree ("cluster","status");--> statement-breakpoint
CREATE INDEX "drop_proposals_proposer_idx" ON "drop_proposals" USING btree ("proposer");--> statement-breakpoint
CREATE INDEX "proof_submissions_drop_idx" ON "proof_submissions" USING btree ("cluster","drop_id");