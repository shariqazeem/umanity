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
    /**
     * The payment's own transaction when value arrived off-program (the x402
     * USDC settlement, the cross-chain solver's payout). `signature` is then the
     * escrow deposit that moved it into the vault.
     */
    settlementSignature: text('settlement_signature'),
    rewardPoints: integer('reward_points').notNull().default(0),
    /** Donor chose to hide their name: no feed post, unnamed in lists. */
    anonymous: boolean('anonymous').notNull().default(false),
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
    /** v3: the drop a cross-chain gift goes into, and how it was settled there. */
    dropId: integer('drop_id'),
    /** USDC (micro) the giver asked to land in the pot. */
    targetMicro: bigint('target_micro', { mode: 'number' }),
    /** USDC (micro) the solver actually delivered to the treasury. */
    receivedMicro: bigint('received_micro', { mode: 'number' }),
    /** drop_gifts.ref of the give, and its signature (stored before sending, so a retry can check it). */
    giveRef: text('give_ref'),
    giveSignature: text('give_signature'),
    giveValidUntil: bigint('give_valid_until', { mode: 'number' }),
    /** USDC that couldn't go into the pot (it filled or closed first), sent to the backer's own wallet. */
    returnedMicro: bigint('returned_micro', { mode: 'number' }),
    returnSignature: text('return_signature'),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('intents_user_idx').on(t.userAddress), index('intents_drop_idx').on(t.dropId)]
)

// ---------- x402 receipts ----------
export const x402Receipts = pgTable(
  'x402_receipts',
  {
    id: text('id').primaryKey(),
    endpoint: text('endpoint').notNull(),
    resourceId: text('resource_id'),
    payer: text('payer'),
    network: text('network').notNull(),
    asset: text('asset').notNull(),
    amount: text('amount').notNull(),
    paymentSignature: text('payment_signature'),
    /** Hash of the signed payment transaction message: one request per payment (replay guard). */
    paymentHash: text('payment_hash'),
    /** verified | settled | pending | failed */
    status: text('status').notNull().default('verified'),
    responseHash: text('response_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('x402_receipts_payment_hash_idx').on(t.paymentHash)]
)

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
/** Photos, videos, receipts and documents attached to a delivery (same shape as lib/contracts MediaItem). */
export type MediaItem = {
  url: string
  kind: 'photo' | 'video' | 'receipt' | 'document'
  sha256?: string
  note?: string
  lat?: number
  lng?: number
}

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
  /** Media the team uploaded for this delivery. */
  media: jsonb('media').$type<MediaItem[]>(),
  /** Admin wallet that posted it. */
  postedBy: text('posted_by'),
  /** Release vote opened for this delivery, if any. */
  proposalId: text('proposal_id'),
  /** Feed post created for this delivery. */
  postId: text('post_id'),
  proofTxSignature: text('proof_tx_signature'),
  xPostUrl: text('x_post_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------- Drops (program v3) ----------

/** One line of a drop's shopping list. */
export type DropItem = {
  name: string
  /** Price of one, in USD. */
  unitUsd: number
  qty: number
  /** What one covers, e.g. "a family of five for a month". */
  covers?: string
}

/**
 * One real delivery. The chain holds the pot and its rules; this row holds
 * the words and the shopping list. `meta` is the exact JSON whose sha256 is
 * the drop's on-chain `meta_hash`, kept as text so anyone can re-hash it.
 */
export const drops = pgTable(
  'drops',
  {
    /** On-chain drop id (the PDA seed). */
    id: integer('id').notNull(),
    cluster: text('cluster').notNull(),
    address: text('address').notNull(),
    title: text('title').notNull(),
    place: text('place').notNull(),
    story: text('story').notNull().default(''),
    emoji: text('emoji').notNull().default('🍲'),
    items: jsonb('items').$type<DropItem[]>().notNull(),
    /** The unit amounts are shown in ("ration pack") and how many people one helps. */
    unitName: text('unit_name').notNull(),
    unitCents: integer('unit_usd_cents').notNull(),
    peoplePerUnit: integer('people_per_unit').notNull().default(1),
    meta: text('meta').notNull(),
    metaHash: text('meta_hash').notNull(),
    goalMicro: bigint('goal_micro', { mode: 'number' }).notNull(),
    capMicro: bigint('cap_micro', { mode: 'number' }).notNull(),
    deadline: timestamp('deadline', { withTimezone: true }).notNull(),
    payee: text('payee').notNull(),
    createdTx: text('created_tx'),
    /** Mirror of the chain, refreshed by the indexer. */
    state: text('state').notNull().default('open'),
    potMicro: bigint('pot_micro', { mode: 'number' }).notNull().default(0),
    givenMicro: bigint('given_micro', { mode: 'number' }).notNull().default(0),
    fromFundMicro: bigint('from_fund_micro', { mode: 'number' }).notNull().default(0),
    refundedMicro: bigint('refunded_micro', { mode: 'number' }).notNull().default(0),
    unlockedMicro: bigint('unlocked_micro', { mode: 'number' }).notNull().default(0),
    backers: integer('backers').notNull().default(0),
    proofHash: text('proof_hash'),
    proofAt: timestamp('proof_at', { withTimezone: true }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
    unlockTx: text('unlock_tx'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** 'official': run by the Umanity team. 'community': proposed by a runner, who is its payee. */
    kind: text('kind').notNull().default('official'),
    /** The proposal a community drop came from. */
    proposalId: text('proposal_id'),
  },
  (t) => [primaryKey({ columns: [t.cluster, t.id] })]
)

/**
 * A drop someone outside the team wants to run. It stays off-chain until the team approves it; then the
 * server opens it on Solana with the proposer as payee, so they can only be paid after filmed proof.
 */
export const dropProposals = pgTable(
  'drop_proposals',
  {
    id: text('id').primaryKey(),
    cluster: text('cluster').notNull(),
    /** The runner's wallet: it signs the proposal and is paid when the drop unlocks. */
    proposer: text('proposer').notNull(),
    /** The drop description (lib/umanity/drops DropMeta), hashed on-chain once approved. */
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull(),
    goalCents: integer('goal_cents').notNull(),
    capCents: integer('cap_cents').notNull(),
    deadline: timestamp('deadline', { withTimezone: true }).notNull(),
    /** How the team can reach the runner (X, Instagram, email, phone). */
    contact: text('contact').notNull().default(''),
    /** pending | approved | rejected */
    status: text('status').notNull().default('pending'),
    reason: text('reason'),
    dropId: integer('drop_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (t) => [index('drop_proposals_status_idx').on(t.cluster, t.status), index('drop_proposals_proposer_idx').on(t.proposer)]
)

/** A community runner's proof, waiting for the team to check it and post it on-chain. */
export const proofSubmissions = pgTable(
  'proof_submissions',
  {
    id: text('id').primaryKey(),
    cluster: text('cluster').notNull(),
    dropId: integer('drop_id').notNull(),
    runner: text('runner').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    xPostUrl: text('x_post_url'),
    /** Links to the receipt, photos and video. */
    links: jsonb('links').$type<string[]>().notNull().default([]),
    /** pending | posted | rejected */
    status: text('status').notNull().default('pending'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('proof_submissions_drop_idx').on(t.cluster, t.dropId)]
)

/** A gift into a drop's pot, whichever way it arrived. `ref` is the on-chain gift_ref (hex). */
export const dropGifts = pgTable(
  'drop_gifts',
  {
    ref: text('ref').primaryKey(),
    cluster: text('cluster').notNull(),
    dropId: integer('drop_id').notNull(),
    /** Who a refund goes to. */
    backer: text('backer').notNull(),
    /** Whose USDC moved (the backer, or a relayer for x402, intents and welcome gifts). */
    giver: text('giver').notNull(),
    /** Address of the Umanity account the gift is credited to, when it differs from the backer. */
    userId: text('user_id'),
    amountMicro: bigint('amount_micro', { mode: 'number' }).notNull(),
    /** wallet | welcome | x402 | intents | fund */
    channel: text('channel').notNull(),
    /** pending | confirmed | failed */
    status: text('status').notNull().default('pending'),
    signature: text('signature'),
    sourceChain: text('source_chain'),
    sourceAsset: text('source_asset'),
    sourceAmount: text('source_amount'),
    intentId: text('intent_id'),
    anonymous: boolean('anonymous').notNull().default(false),
    message: text('message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('drop_gifts_signature_idx').on(t.signature),
    index('drop_gifts_drop_idx').on(t.cluster, t.dropId),
    index('drop_gifts_backer_idx').on(t.backer),
    index('drop_gifts_user_idx').on(t.userId),
  ]
)

/** Proof and updates posted by the field team for a drop. */
export const dropUpdates = pgTable(
  'drop_updates',
  {
    id: text('id').primaryKey(),
    cluster: text('cluster').notNull(),
    dropId: integer('drop_id').notNull(),
    /** update | proof */
    kind: text('kind').notNull().default('update'),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    media: jsonb('media').$type<MediaItem[]>().notNull(),
    /** For proof: sha256 of the canonical proof bundle, as posted on-chain. */
    proofHash: text('proof_hash'),
    proofBundle: text('proof_bundle'),
    proofTx: text('proof_tx'),
    xPostUrl: text('x_post_url'),
    postedBy: text('posted_by'),
    /** For proof: the NEAR guard transactions that carried its AI check and release. The verdict itself is read from the guard. */
    guard: jsonb('guard').$type<GuardRecord>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('drop_updates_drop_idx').on(t.cluster, t.dropId)]
)

/** The NEAR transactions behind a proof's AI check and guarded release. */
export type GuardRecord = {
  network: 'mainnet' | 'testnet'
  contract: string
  registeredTx?: string | null
  verdictTx?: string | null
  releaseTx?: string | null
  unlockTx?: string | null
  /** The last thing that went wrong, in plain words, until it goes right. */
  error?: string | null
  at: string
}

/** Every program event, indexed from the chain. The Money page reads from here. */
export const moneyEvents = pgTable(
  'money_events',
  {
    /** `${signature}:${index}` */
    id: text('id').primaryKey(),
    cluster: text('cluster').notNull(),
    signature: text('signature').notNull(),
    slot: bigint('slot', { mode: 'number' }).notNull(),
    blockTime: timestamp('block_time', { withTimezone: true }),
    /** The event name, e.g. gave, unlocked, refunded, feesSplit. */
    kind: text('kind').notNull(),
    dropId: integer('drop_id'),
    amountMicro: bigint('amount_micro', { mode: 'number' }),
    /** Backer, payee or other main party. */
    party: text('party'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    index('money_events_kind_idx').on(t.cluster, t.kind),
    index('money_events_drop_idx').on(t.cluster, t.dropId),
    index('money_events_time_idx').on(t.blockTime),
  ]
)

/** Swaps made in the Trade tab. The fee itself is on-chain in the program's fee inbox; this row is the history. */
export const trades = pgTable(
  'trades',
  {
    signature: text('signature').primaryKey(),
    cluster: text('cluster').notNull(),
    address: text('address').notNull(),
    inputMint: text('input_mint').notNull(),
    outputMint: text('output_mint').notNull(),
    inAmount: text('in_amount').notNull(),
    outAmount: text('out_amount').notNull(),
    /** Dollar value when USDC is one side. */
    usdMicro: bigint('usd_micro', { mode: 'number' }),
    feeBps: integer('fee_bps').notNull().default(0),
    feeMicro: bigint('fee_micro', { mode: 'number' }).notNull().default(0),
    sponsored: boolean('sponsored').notNull().default(false),
    /** pending | confirmed | failed */
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('trades_address_idx').on(t.address), index('trades_time_idx').on(t.cluster, t.createdAt)]
)

/** What Umanity itself spends, with receipts. */
export const spending = pgTable('spending', {
  id: text('id').primaryKey(),
  cluster: text('cluster').notNull(),
  spentAt: timestamp('spent_at', { withTimezone: true }).notNull(),
  amountMicro: bigint('amount_micro', { mode: 'number' }).notNull(),
  /** goods | filming | travel | team | legal | infrastructure | other */
  category: text('category').notNull(),
  description: text('description').notNull(),
  receiptUrl: text('receipt_url'),
  txSignature: text('tx_signature'),
  dropId: integer('drop_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Small key-value state (indexer cursors). */
export const syncState = pgTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Drop = typeof drops.$inferSelect
export type DropGift = typeof dropGifts.$inferSelect
export type DropUpdate = typeof dropUpdates.$inferSelect
export type MoneyEvent = typeof moneyEvents.$inferSelect
export type Spending = typeof spending.$inferSelect
export type Trade = typeof trades.$inferSelect

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
