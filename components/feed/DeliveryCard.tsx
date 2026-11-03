'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Icon, Img } from '@/components/shared/ui'
import { fmtSol, fmtUsd, timeAgo } from '@/lib/client/api'
import { explorerTx } from '@/lib/solana/constants'
import { getCause } from '@/lib/causes'
import type { FieldUpdateView } from '@/lib/contracts'
import { VoteButtons } from './VoteButtons'

/**
 * A delivery the field team posted: the photos, what it cost, the oracle's
 * verdict and the donors' release vote. This is the card the whole product
 * exists to produce.
 */
export function DeliveryCard({ update, fundedByViewer }: { update: FieldUpdateView; fundedByViewer?: boolean }) {
  const { solPrice } = useUmanity()
  const [expanded, setExpanded] = useState(false)
  const photos = (update.media ?? []).filter((m) => m.kind === 'photo').slice(0, 4)
  const receipts = (update.media ?? []).filter((m) => m.kind === 'receipt' || m.kind === 'document').length
  const att = update.attestation
  const ms = update.milestone
  const cause = getCause(update.poolId)
  const when = update.deliveredAt ?? update.createdAt
  const voteOpen = !!update.proposal && update.proposal.status === 'active' && new Date(update.proposal.closes_at) > new Date()
  const state = ms?.status === 'released' ? 'Released from escrow' : voteOpen ? 'Release vote open' : ms?.status === 'approved' ? 'Approved · releasing' : ms?.status === 'rejected' ? 'Release declined' : 'Awaiting review'

  return (
    <article className="card overflow-hidden">
      <div className="p-4 pb-3 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-full bg-[#1d1d1f] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[13px] font-black">U</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1d1d1f]">Umanity field team</p>
          <p className="text-[10px] text-[#aeaeb2] truncate">
            {update.location ? `${update.location} · ` : ''}
            {timeAgo(when)}
          </p>
        </div>
        <span className="pill bg-[#1d1d1f] text-white !text-[9px] font-semibold">
          <Icon name="truck" size={10} /> Delivered
        </span>
      </div>

      {photos.length > 0 && (
        <div className={`grid gap-0.5 ${photos.length === 1 ? 'grid-cols-1 h-[280px] sm:h-[340px]' : 'grid-cols-2 h-[240px] sm:h-[300px]'}`}>
          {photos.map((m, i) => (
            <div key={m.url + i} className={`relative overflow-hidden bg-black/[0.04] ${photos.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
              <Img src={m.url} alt={m.note || update.title} />
            </div>
          ))}
        </div>
      )}

      <div className="p-4">
        <Link href={`/causes/${update.poolId}`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#86868b] hover:text-[#1d1d1f]">
          <span>{cause?.emoji}</span> {update.poolName || cause?.name}
        </Link>
        <h3 className="text-[16px] font-bold tracking-[-0.01em] mt-1 leading-snug">{update.title}</h3>
        {update.description && (
          <p className={`text-[13px] text-[#86868b] leading-relaxed mt-1 whitespace-pre-wrap cursor-pointer ${expanded ? '' : 'line-clamp-3'}`} onClick={() => setExpanded(true)}>
            {update.description}
          </p>
        )}

        {/* Proof strip */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <ProofCell label="Spent" value={update.amountSol > 0 ? `${fmtSol(update.amountSol, 3)} SOL` : update.fiatAmount || '—'} sub={update.amountSol > 0 && solPrice ? fmtUsd(update.amountSol * solPrice) : update.fiatAmount && update.amountSol > 0 ? update.fiatAmount : undefined} />
          <ProofCell label="Evidence" value={`${photos.length} 📷 · ${receipts} 🧾`} sub={update.media?.some((m) => m.sha256) ? 'hashed on upload' : undefined} />
          <ProofCell
            label="AI oracle"
            value={att ? `${att.confidence}/100` : 'Pending'}
            sub={att ? (att.verdict === 'verified' ? 'verified' : att.verdict === 'rejected' ? 'rejected' : 'inconclusive') : 'x402 audit'}
            tone={att ? (att.verdict === 'verified' ? 'green' : att.verdict === 'rejected' ? 'red' : 'amber') : undefined}
          />
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className={`pill !text-[10px] font-semibold ${ms?.status === 'released' || ms?.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : voteOpen ? 'bg-amber-50 text-amber-700' : ms?.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-black/[0.04] text-[#86868b]'}`}>
            {voteOpen && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
            {state}
          </span>
          {fundedByViewer && (
            <span className="pill bg-emerald-50 text-emerald-700 !text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> You helped fund this
            </span>
          )}
        </div>

        {voteOpen && update.proposal && (
          <div className="mt-3">
            <p className="text-[11px] text-[#86868b] mb-2">Donors to this cause decide if the proof is good enough to release the escrow.</p>
            <VoteButtons proposal={update.proposal} />
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-black/[0.03]">
          <Link href={`/causes/${update.poolId}#proof`} className="text-[12px] font-semibold text-emerald-600 hover:underline">
            See every receipt →
          </Link>
          <div className="flex items-center gap-3 text-[11px]">
            {update.releaseTxSignature ? (
              <a href={explorerTx(update.releaseTxSignature)} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-medium hover:underline">
                Release tx ↗
              </a>
            ) : update.proofTxSignature ? (
              <a href={explorerTx(update.proofTxSignature)} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-medium hover:underline">
                Proof tx ↗
              </a>
            ) : null}
            {update.xPostUrl && (
              <a href={update.xPostUrl} target="_blank" rel="noopener noreferrer" className="text-[#86868b] font-medium hover:text-[#1d1d1f]">
                Video on X ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function ProofCell({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'green' | 'red' | 'amber' }) {
  const color = tone === 'green' ? 'text-emerald-600' : tone === 'red' ? 'text-red-500' : tone === 'amber' ? 'text-amber-600' : 'text-[#1d1d1f]'
  return (
    <div className="rounded-xl bg-[#f5f5f7] px-3 py-2.5 min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#aeaeb2]">{label}</p>
      <p className={`text-[13px] font-bold counter mt-0.5 truncate ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-[#86868b] truncate">{sub}</p>}
    </div>
  )
}
