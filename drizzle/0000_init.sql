CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"recipient" text NOT NULL,
	"target_lamports" bigint NOT NULL,
	"total_raised_lamports" bigint DEFAULT 0 NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"campaign_pda" text,
	"create_tx_signature" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"author_address" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dare_stakes" (
	"id" text PRIMARY KEY NOT NULL,
	"dare_id" text NOT NULL,
	"staker_address" text NOT NULL,
	"amount_lamports" bigint NOT NULL,
	"signature" text NOT NULL,
	"route" text DEFAULT 'solana' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dares" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_address" text NOT NULL,
	"target_handle" text NOT NULL,
	"pool_id" text NOT NULL,
	"text" text NOT NULL,
	"stake_lamports" bigint DEFAULT 0 NOT NULL,
	"pot_lamports" bigint DEFAULT 0 NOT NULL,
	"backer_count" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"dare_pda" text,
	"create_tx_signature" text,
	"resolve_tx_signature" text,
	"proof_post_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" text PRIMARY KEY NOT NULL,
	"donor_address" text NOT NULL,
	"pool_id" text NOT NULL,
	"amount_lamports" bigint NOT NULL,
	"signature" text NOT NULL,
	"route" text DEFAULT 'solana' NOT NULL,
	"source_chain" text,
	"source_asset" text,
	"source_amount" text,
	"intent_id" text,
	"reward_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"milestone_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"amount_lamports" bigint DEFAULT 0 NOT NULL,
	"fiat_amount" text,
	"location" text,
	"delivered_at" timestamp with time zone,
	"evidence" jsonb,
	"proof_tx_signature" text,
	"x_post_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_address" text NOT NULL,
	"followee_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_address_followee_address_pk" PRIMARY KEY("follower_address","followee_address")
);
--> statement-breakpoint
CREATE TABLE "impact_certificates" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_address" text NOT NULL,
	"donation_id" text,
	"cause_name" text NOT NULL,
	"amount_lamports" bigint NOT NULL,
	"tier" text NOT NULL,
	"mint_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_address" text,
	"pool_id" text,
	"dare_id" text,
	"status" text DEFAULT 'quote' NOT NULL,
	"source_chain" text NOT NULL,
	"source_asset" text NOT NULL,
	"source_amount" text,
	"dest_asset" text DEFAULT 'SOL' NOT NULL,
	"dest_address" text NOT NULL,
	"deposit_address" text,
	"deposit_memo" text,
	"quote" jsonb,
	"integrator_fee_bps" integer DEFAULT 50 NOT NULL,
	"amount_out_lamports" bigint,
	"settlement_signature" text,
	"explorer_url" text,
	"last_status_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"post_id" text NOT NULL,
	"user_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "likes_post_id_user_address_pk" PRIMARY KEY("post_id","user_address")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"index" integer NOT NULL,
	"description" text NOT NULL,
	"percentage" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"proposal_id" text,
	"milestone_pda" text,
	"evidence" jsonb,
	"attestation" jsonb,
	"release_tx_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_address" text NOT NULL,
	"type" text DEFAULT 'donation' NOT NULL,
	"message" text NOT NULL,
	"from_username" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"emoji" text DEFAULT '' NOT NULL,
	"delivery_mode" text DEFAULT 'trust' NOT NULL,
	"pool_pda" text NOT NULL,
	"vault_pda" text NOT NULL,
	"total_donated_lamports" bigint DEFAULT 0 NOT NULL,
	"donor_count" integer DEFAULT 0 NOT NULL,
	"vault_balance_lamports" bigint DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"author_address" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'manual' NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tx_signature" text,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"tapestry_content_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"options" jsonb NOT NULL,
	"campaign_id" text,
	"milestone_index" integer,
	"creator_address" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routed_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"user_address" text,
	"pool_id" text,
	"milestone_id" text,
	"amount_lamports" bigint NOT NULL,
	"hops" integer DEFAULT 3 NOT NULL,
	"recipients" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_ref" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tips" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_address" text NOT NULL,
	"recipient_address" text NOT NULL,
	"amount_lamports" bigint NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"address" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"reward_points" integer DEFAULT 0 NOT NULL,
	"total_donated_lamports" bigint DEFAULT 0 NOT NULL,
	"donation_count" integer DEFAULT 0 NOT NULL,
	"tip_count_sent" integer DEFAULT 0 NOT NULL,
	"tip_count_received" integer DEFAULT 0 NOT NULL,
	"handle_claimed" boolean DEFAULT false NOT NULL,
	"streak_current" integer DEFAULT 0 NOT NULL,
	"streak_longest" integer DEFAULT 0 NOT NULL,
	"streak_last_date" text,
	"referred_by" text,
	"tapestry_profile_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"proposal_id" text NOT NULL,
	"voter_address" text NOT NULL,
	"option" integer NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_proposal_id_voter_address_pk" PRIMARY KEY("proposal_id","voter_address")
);
--> statement-breakpoint
CREATE TABLE "x402_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"resource_id" text,
	"payer" text,
	"network" text NOT NULL,
	"asset" text NOT NULL,
	"amount" text NOT NULL,
	"payment_signature" text,
	"status" text DEFAULT 'verified' NOT NULL,
	"response_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "dares_status_idx" ON "dares" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_signature_idx" ON "donations" USING btree ("signature");--> statement-breakpoint
CREATE INDEX "donations_donor_idx" ON "donations" USING btree ("donor_address");--> statement-breakpoint
CREATE INDEX "donations_pool_idx" ON "donations" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "follows" USING btree ("followee_address");--> statement-breakpoint
CREATE INDEX "certs_owner_idx" ON "impact_certificates" USING btree ("owner_address");--> statement-breakpoint
CREATE INDEX "intents_user_idx" ON "intents" USING btree ("user_address");--> statement-breakpoint
CREATE INDEX "milestones_campaign_idx" ON "milestones" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_address","read");--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_address");--> statement-breakpoint
CREATE INDEX "posts_created_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");