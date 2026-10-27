/**
 * Shared response shapes for the aggregate endpoints the screens consume.
 * Server code builds these; client code only reads them. Keep this file free
 * of runtime imports so it can be imported from either side.
 */
import type { PoolView } from '@/lib/data/donations'
import type { CampaignView, MilestoneView, ProposalView } from '@/lib/data/governance'
import type { FeedPost } from '@/lib/data/social'
import type { PublicUser } from '@/lib/data/users'
import type { DareView } from '@/lib/data/dares'
import type { GuardianState } from '@/lib/guardian'
import type { MilestoneEvidence, OracleAttestation } from '@/lib/db'

/** A single gift as shown in lists (cause page, profile, transparency). */
export interface GiftView {
  id: string
  poolId: string
  poolName: string
  username: string
  displayName: string
  address: string
  avatarUrl: string | null
  amount: number // SOL
  route: string // solana | intents | multihopper | blink
  sourceChain: string | null
  signature: string
  createdAt: string
  anonymous: boolean
}

/** Donors to a cause, aggregated. */
export interface Supporter {
  address: string
  username: string
  displayName: string
  avatarUrl: string | null
  amount: number // SOL total to this cause
  count: number
  lastAt: string
  anonymous: boolean
}

export interface MediaItem {
  url: string
  kind: 'photo' | 'video' | 'receipt' | 'document'
  sha256?: string
  note?: string
  lat?: number
  lng?: number
}

/** A field delivery the Umanity team posted, with its proof and release state. */
export interface FieldUpdateView {
  id: string
  poolId: string
  poolName: string
  milestoneId: string | null
  title: string
  description: string
  amountSol: number
  fiatAmount: string | null
  location: string | null
  deliveredAt: string | null
  media: MediaItem[]
  evidence: MilestoneEvidence | null
  attestation: OracleAttestation | null
  milestone: MilestoneView | null
  proposal: ProposalView | null
  proofTxSignature: string | null
  releaseTxSignature: string | null
  xPostUrl: string | null
  createdAt: string
}

/** GET /api/causes/[id] */
export interface CauseDetail {
  pool: PoolView
  campaign: CampaignView | null
  /** Active proposals first, then closed. */
  proposals: ProposalView[]
  supporters: Supporter[]
  supporterCount: number
  updates: FieldUpdateView[]
  posts: FeedPost[]
  dares: DareView[]
  gifts: GiftView[]
  raisedSol: number
  heldSol: number
  releasedSol: number
  vault: { address: string; balanceSol: number; poolPda: string }
  /** Who the viewer follows among supporters (usernames), when ?viewer= is passed. */
  friendsWhoGave: string[]
}

/** GET /api/transparency */
export interface TransparencyReport {
  generatedAt: string
  network: string
  programs: { donations: string; tips: string }
  wallets: { authority: string; treasury: string; orgWallet: string; crossChainVault: string }
  totals: {
    raisedSol: number
    heldSol: number
    releasedSol: number
    donors: number
    gifts: number
    crossChainGifts: number
    crossChainSol: number
    causes: number
  }
  vaults: { poolId: string; name: string; vaultPda: string; poolPda: string; balanceSol: number; raisedSol: number; releasedSol: number; donorCount: number; lastSyncedAt: string | null }[]
  releases: { poolId: string; poolName: string; milestoneIndex: number; description: string; amountSol: number; txSignature: string | null; attestation: OracleAttestation | null; status: string }[]
  deliveries: FieldUpdateView[]
  fees: {
    dareFeeBps: number
    dareFeesSol: number
    intentsFeeBps: number
    intentsFeeUsd: number
    x402Calls: number
    x402RevenueUsd: number
    routingFeesSol: number
  }
}

export interface CertView {
  id: string
  tier: string
  causeName: string
  poolId: string
  amount: number // SOL
  signature: string | null
  createdAt: string
}

/**
 * GET /api/causes — list entry: the pool plus what the cards need.
 * `campaign` is the on-chain campaign (CampaignView); the static bootstrap
 * plan from lib/causes.ts is already on PoolView as `plan`.
 */
export interface CauseListItem extends PoolView {
  campaign: CampaignView | null
  supporterCount: number
  latestUpdate: FieldUpdateView | null
  /** First milestone not yet released; thresholdSol is the cumulative raise that funds it. */
  nextMilestone: { index: number; description: string; percentage: number; thresholdSol: number; status: string } | null
  raisedSol: number
  heldSol: number
  releasedSol: number
}

/** GET /api/feed/smart?address= — the home stream (`timestamp` is the sort key, ISO). */
export type FeedItem =
  | { type: 'post'; id: string; timestamp?: string; data: FeedPost & { fundedByViewer?: boolean } }
  | { type: 'field_update'; id: string; timestamp?: string; data: FieldUpdateView & { fundedByViewer?: boolean } }
  | { type: 'dare'; id: string; timestamp?: string; data: DareView }
  | { type: 'proposal'; id: string; timestamp?: string; data: ProposalView }
  | { type: 'suggested_follow'; id: string; timestamp?: string; data: PublicUser }

/**
 * Admin requests (field updates, media upload, bootstrap) are authorised by a
 * wallet signature over `umanity-admin:<unix seconds>` sent as headers:
 *   x-umanity-address, x-umanity-message, x-umanity-signature (base58)
 * Admin wallets: ADMIN_WALLETS env (comma separated) plus the org wallet and
 * the program authority.
 */
export const ADMIN_MESSAGE_PREFIX = 'umanity-admin:'
export const ADMIN_MESSAGE_TTL_SECONDS = 600

/** GET /api/users/[username]?viewer= */
export interface PublicProfile extends PublicUser {
  /** 1-based order of this person's first gift across all donors; null if they have not given. */
  foundingRank?: number | null
  followers: number
  following: number
  viewerFollows: boolean
  guardian: GuardianState
  votes: number
  certificates: CertView[]
  gifts: GiftView[]
  posts: FeedPost[]
  dares: DareView[]
  causes: { poolId: string; name: string; emoji: string; image: string; amount: number }[]
}
