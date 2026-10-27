import type { CampaignView } from '@/lib/data/governance'
import type { FieldUpdateView } from '@/lib/contracts'
import { getCause } from '@/lib/causes'

/** What the "Give today" strip needs per cause, derived tolerantly from /api/causes or /api/pools. */
export interface CauseSummary {
  id: string
  name: string
  shortName: string
  image: string
  imageAlt: string
  emoji: string
  totalDonated: number
  vaultBalance: number
  donorCount: number
  onchainCampaign: CampaignView | null
  supporterCount: number
  latestUpdate: FieldUpdateView | null
  nextMilestone: { index: number; description: string; thresholdSol: number; status: string } | null
}

export interface ActivityRow {
  id: string
  type: string
  username: string
  amount: number
  poolId: string
  poolName: string
  sourceChain: string | null
  signature: string
  timestamp: string
}

export interface LeaderRow {
  address: string
  username: string
  displayName: string
  totalDonated?: number
  rewardPoints?: number
  streak?: number
  totalStaked?: number
  dares?: number
}

/** Threshold (in SOL) of the first milestone that has not been released yet. */
export function nextMilestoneFor(campaign: CampaignView | null | undefined): CauseSummary['nextMilestone'] {
  if (!campaign || !campaign.milestones?.length) return null
  let cumulative = 0
  for (const m of campaign.milestones) {
    cumulative += m.percentage
    if (m.status !== 'released') return { index: m.index, description: m.description, thresholdSol: (campaign.target_amount * cumulative) / 100, status: m.status }
  }
  return null
}

function isCampaignView(v: unknown): v is CampaignView {
  return !!v && typeof v === 'object' && 'target_amount' in (v as Record<string, unknown>) && 'milestones' in (v as Record<string, unknown>)
}

/** Fills gaps in whatever /api/causes (or /api/pools) returned; copy and images come from lib/causes. */
export function normalizeCause(raw: Record<string, unknown>, campaign?: CampaignView | null): CauseSummary {
  const id = String(raw.id ?? '')
  const meta = getCause(id)
  const camp = isCampaignView(raw.campaign) ? raw.campaign : campaign ?? null
  const num = (v: unknown, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d)
  const next = raw.nextMilestone && typeof raw.nextMilestone === 'object' ? (raw.nextMilestone as CauseSummary['nextMilestone']) : nextMilestoneFor(camp)
  return {
    id,
    name: meta?.name ?? String(raw.name ?? id),
    shortName: meta?.shortName ?? String(raw.shortName ?? raw.name ?? id),
    image: meta?.image ?? String(raw.image ?? ''),
    imageAlt: meta?.imageAlt ?? String(raw.imageAlt ?? raw.name ?? id),
    emoji: meta?.emoji ?? String(raw.emoji ?? ''),
    totalDonated: num(raw.raisedSol, num(raw.totalDonated)),
    vaultBalance: num(raw.heldSol, num(raw.vaultBalance)),
    donorCount: num(raw.donorCount),
    onchainCampaign: camp,
    supporterCount: num(raw.supporterCount, num(raw.donorCount)),
    latestUpdate: (raw.latestUpdate as FieldUpdateView | null | undefined) ?? null,
    nextMilestone: next,
  }
}

export function chainLabel(chain: string | null | undefined) {
  if (!chain) return null
  const map: Record<string, string> = { eth: 'Ethereum', base: 'Base', arb: 'Arbitrum', op: 'Optimism', pol: 'Polygon', bsc: 'BNB Chain', avax: 'Avalanche', btc: 'Bitcoin', near: 'NEAR', ton: 'TON', sol: 'Solana', doge: 'Dogecoin', ltc: 'Litecoin', tron: 'Tron', xrp: 'XRP', zec: 'Zcash', sui: 'Sui', bera: 'Berachain', gnosis: 'Gnosis' }
  return map[chain.toLowerCase()] ?? chain.toUpperCase()
}
