'use client'

/** One field delivery: the story, the photos, the receipts, then the proof layer. */
import { useState } from 'react'
import { Icon, Img, Pill } from '@/components/shared/ui'
import { fmtSol, fmtUsd, timeAgo } from '@/lib/client/api'
import { useUmanity } from '@/components/providers/UmanityProvider'
import type { FieldUpdateView, MediaItem } from '@/lib/contracts'
import { ProofPanel } from './ProofPanel'

interface Props {
  update: FieldUpdateView
  isAdmin: boolean
  myVote: number | null
  power: number
  onVote: (proposalId: string, option: number) => Promise<boolean>
  onExecute: (proposalId: string) => Promise<boolean>
  onChange: () => void
  fundedByViewer?: boolean
}

function isHttp(u: string) {
  return /^https?:\/\//i.test(u) || u.startsWith('/')
}

export function UpdateCard({ update, fundedByViewer, ...proof }: Props) {
  const { solPrice } = useUmanity()
  const photos = update.media.filter((m) => m.kind === 'photo' && isHttp(m.url))
  const videos = update.media.filter((m) => m.kind === 'video' && isHttp(m.url))
  const docs = update.media.filter((m) => m.kind === 'receipt' || m.kind === 'document')
  const when = update.deliveredAt ?? update.createdAt
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? photos : photos.slice(0, 5)

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Pill tone="green">
              <Icon name="truck" size={11} /> Delivered
            </Pill>
            {fundedByViewer && <Pill tone="dark">You helped fund this</Pill>}
            {update.milestone && <span className="text-[11.5px] text-[#aeaeb2]">Milestone {update.milestone.index + 1}</span>}
          </div>
          <h3 className="text-[17px] font-bold tracking-[-0.02em] leading-snug">{update.title}</h3>
          <p className="text-[12.5px] text-[#6e6e73] mt-1 flex items-center gap-1.5 flex-wrap">
            {update.location && (
              <span className="inline-flex items-center gap-1">
                <Icon name="pin" size={12} /> {update.location}
              </span>
            )}
            {update.location && <span>·</span>}
            <span>{new Date(when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="text-[#aeaeb2]">· {timeAgo(when)}</span>
          </p>
        </div>
        {update.amountSol > 0 && (
          <div className="text-right flex-shrink-0">
            <p className="num text-[18px] font-bold leading-none">{fmtSol(update.amountSol, 3)} SOL</p>
            <p className="text-[11.5px] text-[#6e6e73] mt-1 num">{update.fiatAmount ? update.fiatAmount : solPrice ? fmtUsd(update.amountSol * solPrice) : ''}</p>
          </div>
        )}
      </div>

      {update.description && <p className="text-[14.5px] leading-relaxed mt-3 whitespace-pre-wrap">{update.description}</p>}

      {shown.length > 0 && (
        <div className={`grid gap-2 mt-4 ${shown.length === 1 ? 'grid-cols-1' : shown.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {shown.map((m, i) => (
            <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer" className={`relative block overflow-hidden rounded-2xl bg-black/[0.04] ${shown.length >= 3 && i === 0 ? 'col-span-2 row-span-2 h-[260px] sm:h-[340px]' : shown.length === 1 ? 'h-[300px]' : 'h-[150px] sm:h-[165px]'}`}>
              <Img src={m.url} alt={m.note || update.title} />
              {m.note && <span className="absolute bottom-2 left-2 pill bg-white/90 text-[#1d1d1f] max-w-[90%] truncate">{m.note}</span>}
            </a>
          ))}
          {!showAll && photos.length > 5 && (
            <button onClick={() => setShowAll(true)} className="rounded-2xl border border-dashed border-black/[0.12] text-[13px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f] h-[150px] sm:h-[165px]">
              +{photos.length - 5} more
            </button>
          )}
        </div>
      )}

      {videos.length > 0 && (
        <div className="mt-3 space-y-2">
          {videos.map((v) => (
            <video key={v.url} src={v.url} controls preload="metadata" className="w-full rounded-2xl bg-black" />
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {docs.map((d, i) => (
            <DocRow key={`${d.url}-${i}`} d={d} />
          ))}
        </ul>
      )}

      {update.xPostUrl && (
        <a href={update.xPostUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] mt-3">
          Posted on X <Icon name="arrowUpRight" size={12} />
        </a>
      )}

      <ProofPanel update={update} {...proof} />
    </article>
  )
}

function DocRow({ d }: { d: MediaItem }) {
  const label = d.note || (d.kind === 'receipt' ? 'Receipt' : 'Document')
  const inner = (
    <>
      <span className="w-8 h-8 rounded-lg bg-black/[0.04] text-[#6e6e73] flex items-center justify-center flex-shrink-0">
        <Icon name="receipt" size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium truncate">{label}</span>
        {d.sha256 && <span className="block text-[11px] text-[#aeaeb2] num truncate">sha256 {d.sha256.slice(0, 16)}…</span>}
      </span>
      {isHttp(d.url) && <Icon name="arrowUpRight" size={13} className="text-[#aeaeb2]" />}
    </>
  )
  return (
    <li>
      {isHttp(d.url) ? (
        <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-black/[0.06] px-3 py-2 hover:border-black/20 transition-colors">
          {inner}
        </a>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] px-3 py-2">{inner}</div>
      )}
    </li>
  )
}
