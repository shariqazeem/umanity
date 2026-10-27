/**
 * Umanity data model (Drizzle ORM, Postgres dialect).
 *
 * Money lives on Solana (pool vaults, DonationRecord PDAs, campaigns, milestones,
 * dares). This database is the off-chain index + social layer: profiles, posts,
 * follows, likes, comments, governance tallies, cross-chain intent tracking,
 * x402 receipts and notifications.
 *
 * Works against any Postgres (self-hosted on the Ubuntu box, Supabase, Neon)
 * via DATABASE_URL, and against an embedded PGlite database in local dev.
 */
import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ---------- Users ----------
export const users = pgTable(
  'users',
  {
    address: text('address').primaryKey(),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    bio: text('bio').notNull().default(''),
    avatarUrl: text('avatar_url'),
    /** Impact points — 1 SOL donated = 1,000 pts; governance weight. */
    rewardPoints: integer('reward_points').notNull().default(0),
    /** Lifetime SOL donated, in lamports (bigint). */
    totalDonatedLamports: bigint('total_donated_lamports', { mode: 'number' }).notNull().default(0),
    donationCount: integer('donation_count').notNull().default(0),
    tipCountSent: integer('tip_count_sent').notNull().default(0),
    tipCountReceived: integer('tip_count_received').notNull().default(0),
    /** True once the user explicitly claimed a handle (vs auto-generated). */
    handleClaimed: boolean('handle_claimed').notNull().default(false),
    /** Daily streak bookkeeping (UTC dates). */
    streakCurrent: integer('streak_current').notNull().default(0),
    streakLongest: integer('streak_longest').notNull().default(0),
    streakLastDate: text('streak_last_date'),
    /** Referral: username of the referrer (if any). */
    referredBy: text('referred_by'),
    /** Optional mirror into Tapestry Protocol (social graph on Solana). */
    tapestryProfileId: text('tapestry_profile_id'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_username_idx').on(t.username)]
)

// ---------- Social graph ----------
export const follows = pgTable(
  'follows',
  {
    followerAddress: text('follower_address').notNull(),
    followeeAddress: text('followee_address').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerAddress, t.followeeAddress] }),
    index('follows_followee_idx').on(t.followeeAddress),
  ]
)

export const posts = pgTable(
  'posts',
  {
    id: text('id').primaryKey(),
    authorAddress: text('author_address').notNull(),
    content: text('content').notNull(),
    /** manual | donation | milestone | joined | impact_dare | dare_accepted | intent | proof */
    type: text('type').notNull().default('manual'),
    properties: jsonb('properties').$type<Record<string, string>>().notNull().default({}),
    txSignature: text('tx_signature'),
    likeCount: integer('like_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    tapestryContentId: text('tapestry_content_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('posts_author_idx').on(t.authorAddress), index('posts_created_idx').on(t.createdAt)]
)

export const likes = pgTable(
  'likes',
  {
    postId: text('post_id').notNull(),
    userAddress: text('user_address').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userAddress] })]
)

export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    authorAddress: text('author_address').notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('comments_post_idx').on(t.postId)]
)

// ---------- Causes (on-chain pools) ----------
export const pools = pgTable('pools', {
  /** slug, equals the on-chain PDA seed */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  category: text('category').notNull().default(''),
  emoji: text('emoji').notNull().default(''),
  /** 'trust' = verified charity trust, 'field' = Umanity delivers in person */
  deliveryMode: text('delivery_mode').notNull().default('trust'),
  poolPda: text('pool_pda').notNull(),
  vaultPda: text('vault_pda').notNull(),
  /** Synced from chain. */
  totalDonatedLamports: bigint('total_donated_lamports', { mode: 'number' }).notNull().default(0),
  donorCount: integer('donor_count').notNull().default(0),
  vaultBalanceLamports: bigint('vault_balance_lamports', { mode: 'number' }).notNull().default(0),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
})

export const donations = pgTable(
  'donations',
  {
    id: text('id').primaryKey(),
    donorAddress: text('donor_address').notNull(),
    poolId: text('pool_id').notNull(),
    amountLamports: bigint('amount_lamports', { mode: 'number' }).notNull(),
    signature: text('signature').notNull(),
    /** solana | intents (Aurora/NEAR Intents) | multihopper | blink | demo */
    route: text('route').notNull().default('solana'),
    sourceChain: text('source_chain'),
    sourceAsset: text('source_asset'),
    sourceAmount: text('source_amount'),
    intentId: text('intent_id'),
    rewardPoints: integer('reward_points').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('donations_signature_idx').on(t.signature),
    index('donations_donor_idx').on(t.donorAddress),
    index('donations_pool_idx').on(t.poolId),
  ]
)

export const tips = pgTable('tips', {
  id: text('id').primaryKey(),
  senderAddress: text('sender_address').notNull(),
  recipientAddress: text('recipient_address').notNull(),
  amountLamports: bigint('amount_lamports', { mode: 'number' }).notNull(),
  message: text('message').notNull().default(''),
  signature: text('signature').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------- Milestone escrow ----------
export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey(),
  poolId: text('pool_id').notNull(),
  recipient: text('recipient').notNull(),
  targetLamports: bigint('target_lamports', { mode: 'number' }).notNull(),
  totalRaisedLamports: bigint('total_raised_lamports', { mode: 'number' }).notNull().default(0),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  campaignPda: text('campaign_pda'),
  createTxSignature: text('create_tx_signature'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const milestones = pgTable(
  'milestones',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id').notNull(),
    index: integer('index').notNull(),
    description: text('description').notNull(),
    percentage: integer('percentage').notNull(),
    /** pending | voting | approved | released | rejected */
    status: text('status').notNull().default('pending'),
    proposalId: text('proposal_id'),
    milestonePda: text('milestone_pda'),
    /** Evidence uploaded by the charity / field team (URLs, hashes, geo). */
    evidence: jsonb('evidence').$type<MilestoneEvidence>(),
    /** Latest AI Impact Oracle attestation (x402-paid). */
    attestation: jsonb('attestation').$type<OracleAttestation>(),
    releaseTxSignature: text('release_tx_signature'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('milestones_campaign_idx').on(t.campaignId)]
)

export type MilestoneEvidence = {
  summary: string
  items: { kind: 'receipt' | 'photo' | 'video' | 'invoice' | 'geo' | 'link'; url?: string; sha256?: string; note?: string; lat?: number; lng?: number }[]
  submittedBy?: string
  submittedAt?: string
}

export type OracleAttestation = {
  verdict: 'verified' | 'inconclusive' | 'rejected'
  confidence: number
  summary: string
  checks: { name: string; passed: boolean; note?: string }[]
  model: string
  attestationHash: string
  paymentSignature?: string
  issuedAt: string
}

// ---------- Governance ----------
export const proposals = pgTable(
  'proposals',
  {
    id: text('id').primaryKey(),
    /** fund_release | general */
    type: text('type').notNull().default('general'),
    title: text('title').notNull(),
    description: text('description').notNull(),
    options: jsonb('options').$type<string[]>().notNull(),
    campaignId: text('campaign_id'),
    milestoneIndex: integer('milestone_index'),
    creatorAddress: text('creator_address').notNull(),
    /** active | executed | closed */
    status: text('status').notNull().default('active'),
    closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    result: jsonb('result').$type<{ approved: boolean; yesWeight: number; noWeight: number }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('proposals_status_idx').on(t.status)]
)

export const votes = pgTable(
  'votes',
  {
    proposalId: text('proposal_id').notNull(),
    voterAddress: text('voter_address').notNull(),
    option: integer('option').notNull(),
    weight: integer('weight').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.proposalId, t.voterAddress] })]
)

// ---------- Staked Impact Dares ----------
export const dares = pgTable(
  'dares',
  {
    id: text('id').primaryKey(),
    creatorAddress: text('creator_address').notNull(),
    /** @handle on Umanity or X */
    targetHandle: text('target_handle').notNull(),
    poolId: text('pool_id').notNull(),
    text: text('text').notNull(),
    stakeLamports: bigint('stake_lamports', { mode: 'number' }).notNull().default(0),
    potLamports: bigint('pot_lamports', { mode: 'number' }).notNull().default(0),
    backerCount: integer('backer_count').notNull().default(0),
    deadline: timestamp('deadline', { withTimezone: true }).notNull(),
    /** open | completed | expired | cancelled */
    status: text('status').notNull().default('open'),
    darePda: text('dare_pda'),
    createTxSignature: text('create_tx_signature'),
    resolveTxSignature: text('resolve_tx_signature'),
    proofPostId: text('proof_post_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('dares_status_idx').on(t.status)]
)

export const dareStakes = pgTable('dare_stakes', {
  id: text('id').primaryKey(),
  dareId: text('dare_id').notNull(),
  stakerAddress: text('staker_address').notNull(),
  amountLamports: bigint('amount_lamports', { mode: 'number' }).notNull(),
  signature: text('signature').notNull(),
  route: text('route').notNull().default('solana'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------- Cross-chain intents (Aurora / NEAR Intents) ----------
export const intents = pgTable(
  'intents',
  {
    id: text('id').primaryKey(),
    userAddress: text('user_address'),
    poolId: text('pool_id'),
    dareId: text('dare_id'),
    /** quote | deposit_address | pending_deposit | processing | success | refunded | failed */
    status: text('status').notNull().default('quote'),
    sourceChain: text('source_chain').notNull(),
    sourceAsset: text('source_asset').notNull(),
    sourceAmount: text('source_amount'),
    destAsset: text('dest_asset').notNull().default('SOL'),
    destAddress: text('dest_address').notNull(),
    depositAddress: text('deposit_address'),
    depositMemo: text('deposit_memo'),
    quote: jsonb('quote').$type<Record<string, unknown>>(),
    integratorFeeBps: integer('integrator_fee_bps').notNull().default(50),
    amountOutLamports: bigint('amount_out_lamports', { mode: 'number' }),
    settlementSignature: text('settlement_signature'),
    explorerUrl: text('explorer_url'),
    lastStatusPayload: jsonb('last_status_payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('intents_user_idx').on(t.userAddress)]
)

// ---------- x402 receipts ----------
export const x402Receipts = pgTable('x402_receipts', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull(),
  resourceId: text('resource_id'),
  payer: text('payer'),
  network: text('network').notNull(),
  asset: text('asset').notNull(),
  amount: text('amount').notNull(),
  paymentSignature: text('payment_signature'),
  /** verified | settled | failed */
  status: text('status').notNull().default('verified'),
  responseHash: text('response_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------- MultiHopper routed transfers ----------
export const routedTransfers = pgTable('routed_transfers', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // discreet_donation | milestone_payout
  userAddress: text('user_address'),
  poolId: text('pool_id'),
  milestoneId: text('milestone_id'),
  amountLamports: bigint('amount_lamports', { mode: 'number' }).notNull(),
  hops: integer('hops').notNull().default(3),
  recipients: jsonb('recipients').$type<{ address: string; label: string; amountLamports: number }[]>(),
  status: text('status').notNull().default('pending'),
  providerRef: text('provider_ref'),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------- Notifications ----------
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    recipientAddress: text('recipient_address').notNull(),
    type: text('type').notNull().default('donation'),
    message: text('message').notNull(),
    fromUsername: text('from_username'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_recipient_idx').on(t.recipientAddress, t.read)]
)

// ---------- Impact certificates / Living Guardian ----------
export const impactCertificates = pgTable(
  'impact_certificates',
  {
    id: text('id').primaryKey(),
    ownerAddress: text('owner_address').notNull(),
    donationId: text('donation_id'),
    causeName: text('cause_name').notNull(),
    amountLamports: bigint('amount_lamports', { mode: 'number' }).notNull(),
    /** bronze | silver | gold | diamond */
    tier: text('tier').notNull(),
    mintSignature: text('mint_signature'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('certs_owner_idx').on(t.ownerAddress)]
)

// ---------- Field Fund (real-world delivery ledger) ----------
export const fieldDeliveries = pgTable('field_deliveries', {
  id: text('id').primaryKey(),
  poolId: text('pool_id').notNull(),
  milestoneId: text('milestone_id'),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  amountLamports: bigint('amount_lamports', { mode: 'number' }).notNull().default(0),
  fiatAmount: text('fiat_amount'),
  location: text('location'),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  evidence: jsonb('evidence').$type<MilestoneEvidence>(),
  proofTxSignature: text('proof_tx_signature'),
  xPostUrl: text('x_post_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Post = typeof posts.$inferSelect
export type Pool = typeof pools.$inferSelect
export type Donation = typeof donations.$inferSelect
export type Campaign = typeof campaigns.$inferSelect
export type Milestone = typeof milestones.$inferSelect
export type Proposal = typeof proposals.$inferSelect
export type Vote = typeof votes.$inferSelect
export type Dare = typeof dares.$inferSelect
export type Intent = typeof intents.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type ImpactCertificate = typeof impactCertificates.$inferSelect
export type FieldDelivery = typeof fieldDeliveries.$inferSelect
