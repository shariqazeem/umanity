CREATE TABLE "drop_gifts" (
	"ref" text PRIMARY KEY NOT NULL,
	"cluster" text NOT NULL,
	"drop_id" integer NOT NULL,
	"backer" text NOT NULL,
	"giver" text NOT NULL,
	"user_id" text,
	"amount_micro" bigint NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"signature" text,
	"source_chain" text,
	"source_asset" text,
	"source_amount" text,
	"intent_id" text,
	"anonymous" boolean DEFAULT false NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drop_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster" text NOT NULL,
	"drop_id" integer NOT NULL,
	"kind" text DEFAULT 'update' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"media" jsonb NOT NULL,
	"proof_hash" text,
	"proof_bundle" text,
	"proof_tx" text,
	"x_post_url" text,
	"posted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drops" (
	"id" integer NOT NULL,
	"cluster" text NOT NULL,
	"address" text NOT NULL,
	"title" text NOT NULL,
	"place" text NOT NULL,
	"story" text DEFAULT '' NOT NULL,
	"emoji" text DEFAULT '🍲' NOT NULL,
	"items" jsonb NOT NULL,
	"unit_name" text NOT NULL,
	"unit_usd_cents" integer NOT NULL,
	"people_per_unit" integer DEFAULT 1 NOT NULL,
	"meta" text NOT NULL,
	"meta_hash" text NOT NULL,
	"goal_micro" bigint NOT NULL,
	"cap_micro" bigint NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"payee" text NOT NULL,
	"created_tx" text,
	"state" text DEFAULT 'open' NOT NULL,
	"pot_micro" bigint DEFAULT 0 NOT NULL,
	"given_micro" bigint DEFAULT 0 NOT NULL,
	"from_fund_micro" bigint DEFAULT 0 NOT NULL,
	"refunded_micro" bigint DEFAULT 0 NOT NULL,
	"unlocked_micro" bigint DEFAULT 0 NOT NULL,
	"backers" integer DEFAULT 0 NOT NULL,
	"proof_hash" text,
	"proof_at" timestamp with time zone,
	"unlocked_at" timestamp with time zone,
	"unlock_tx" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drops_cluster_id_pk" PRIMARY KEY("cluster","id")
);
--> statement-breakpoint
CREATE TABLE "money_events" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster" text NOT NULL,
	"signature" text NOT NULL,
	"slot" bigint NOT NULL,
	"block_time" timestamp with time zone,
	"kind" text NOT NULL,
	"drop_id" integer,
	"amount_micro" bigint,
	"party" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spending" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster" text NOT NULL,
	"spent_at" timestamp with time zone NOT NULL,
	"amount_micro" bigint NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"receipt_url" text,
	"tx_signature" text,
	"drop_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "drop_gifts_signature_idx" ON "drop_gifts" USING btree ("signature");--> statement-breakpoint
CREATE INDEX "drop_gifts_drop_idx" ON "drop_gifts" USING btree ("cluster","drop_id");--> statement-breakpoint
CREATE INDEX "drop_gifts_backer_idx" ON "drop_gifts" USING btree ("backer");--> statement-breakpoint
CREATE INDEX "drop_gifts_user_idx" ON "drop_gifts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "drop_updates_drop_idx" ON "drop_updates" USING btree ("cluster","drop_id");--> statement-breakpoint
CREATE INDEX "money_events_kind_idx" ON "money_events" USING btree ("cluster","kind");--> statement-breakpoint
CREATE INDEX "money_events_drop_idx" ON "money_events" USING btree ("cluster","drop_id");--> statement-breakpoint
CREATE INDEX "money_events_time_idx" ON "money_events" USING btree ("block_time");