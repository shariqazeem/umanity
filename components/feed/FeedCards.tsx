'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUmanity } from '@/components/providers/UmanityProvider'
import { Avatar, Btn, Card, Icon, Img, Pill, TxLink } from '@/components/shared/ui'
import { apiSend, fmtSol, fmtUsd, timeAgo, countdown } from '@/lib/client/api'
import { getCause } from '@/lib/causes'
import type { FeedPost } from '@/lib/data/social'
import type { ProposalView } from '@/lib/data/governance'
import type { PublicUser } from '@/lib/data/users'
import type { FieldUpdateView } from '@/lib/contracts'
import { PostActions } from './PostActions'
import { VoteButtons } from './VoteButtons'
import { chainLabel } from './types'

const origin = () => (typeof window !== 'undefined' ? window.location.origin : '')

/* ------------------------------------------------------------------ */
/* Posts: gifts, updates, joins                                         */
/* ------------------------------------------------------------------ */
export function PostCard({ post, fundedByViewer }: { post: FeedPost; fundedByViewer?: boolean }) {
  const { solPrice, openGive } = useUmanity()
  const p = post.properties || {}
  const cause = p.poolId ? getCause(p.poolId) : undefined
  const causeName = cause?.name ?? p.cause ?? ''
  const amount = p.amount ? Number(p.amount) : NaN
  const who = post.displayName || `@${post.username}`
  const isGift = post.type === 'donation'
  const chain = chainLabel(p.sourceChain)
  const causeUrl = p.poolId ? `${origin()}/causes/${p.poolId}` : origin()

  let headline: React.ReactNode
  if (isGift && isFinite(amount)) {
    headline = (
      <>
        <span className="font-semibold">{who}</span> gave <span className="font-semibold num">{fmtSol(amount, 3)} SOL</span>
        {solPrice ? <span className="text-[#6e6e73] num"> ({fmtUsd(amount * solPrice)})</span> : null} to{' '}
        {p.poolId ? (
          <Link href={`/causes/${p.poolId}`} className="font-semibold hover:underline underline-offset-2">
            {causeName}
          </Link>
        ) : (
          <span className="font-semibold">{causeName}</span>
        )}
      </>
    )
  } else if (post.type === 'joined') {
    headline = (
      <>
        <span className="font-semibold">{who}</span> <span className="text-[#6e6e73]">joined Umanity</span>
      </>
    )
  } else if (post.type === 'vote') {
    headline = (
      <>
        <span className="font-semibold">{who}</span> <span className="text-[#6e6e73]">{post.content.replace(/^Voted\s*/i, 'voted ')}</span>
      </>
    )
  } else {
    headline = <span className="font-semibold">{who}</span>
  }

  const showBody = !isGift && post.type !== 'joined' && post.type !== 'vote' && post.content
  const minimal = post.type === 'joined' || post.type === 'vote'

  return (
    <Card as="article" className={minimal ? 'px-4 py-3' : 'p-4'}>
      <div className="flex items-start gap-3">
        <Link href={`/u/${post.username}`} className="flex-shrink-0">
          <Avatar username={post.username} url={post.avatarUrl} size={minimal ? 32 : 40} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className={`${minimal ? 'text-[13.5px]' : 'text-[15px]'} leading-snug`}>{headline}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[12px] text-[#aeaeb2]">
            <span>{timeAgo(post.createdAt)}</span>
            {chain && (
              <Pill tone="gray">
                <Icon name="globe" size={11} /> from {chain}
              </Pill>
            )}
            {p.route === 'multihopper' && <Pill tone="gray">private route</Pill>}
            {post.type === 'proof' && <Pill tone="green">Proof</Pill>}
            {fundedByViewer && (
              <Pill tone="green" dot>
                You helped fund this
              </Pill>
            )}
          </div>
          {showBody && <p className="text-[14.5px] leading-relaxed mt-2 whitespace-pre-wrap break-words">{post.content}</p>}
          {!minimal && (
            <PostActions
              postId={post.id}
              likeCount={post.likeCount}
              liked={post.liked}
              commentCount={post.commentCount}
              txSignature={post.txSignature}
              shareText={isGift && isFinite(amount) ? `${who} just gave ${fmtSol(amount, 3)} SOL to ${causeName} on @umanity_xyz. Held in escrow until the delivery is proven.` : post.content.slice(0, 200)}
              shareUrl={causeUrl}
              right={
                isGift && isFinite(amount) && p.poolId ? (
                  <Btn size="sm" tone="outline" icon="heart" onClick={() => openGive({ causeId: p.poolId, amountSol: amount })}>
                    Match
                  </Btn>
                ) : undefined
              }
            />
          )}
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Field update: the delivery card                                      */
/* ------------------------------------------------------------------ */
export function FieldUpdateCard({ update, fundedByViewer }: { update: FieldUpdateView; fundedByViewer?: boolean }) {
  const { solPrice } = useUmanity()
  const [expanded, setExpanded] = useState(false)
  const photos = (update.media ?? []).filter((m) => m.kind === 'photo').slice(0, 4)
  const receipts = (update.media ?? []).filter((m) => m.kind === 'receipt' || m.kind === 'document').length
  const att = update.attestation
  const ms = update.milestone
  const cause = getCause(update.poolId)
  const when = update.deliveredAt ?? update.createdAt
  const proposalActive = update.proposal && update.proposal.status === 'active' && new Date(update.proposal.closes_at) > new Date()
  const status = ms?.status === 'released' ? { tone: 'green' as const, label: 'Released from escrow' } : proposalActive ? { tone: 'amber' as const, label: 'Release vote open' } : ms?.status === 'approved' ? { tone: 'green' as const, label: 'Approved · releasing' } : ms?.status === 'rejected' ? { tone: 'red' as const, label: 'Release declined' } : null

  return (
    <Card as="article" className="overflow-hidden">
      {photos.length > 0 && (
        <div className={`grid gap-0.5 ${photos.length === 1 ? 'grid-cols-1' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-2'} ${photos.length === 1 ? 'h-[260px] sm:h-[320px]' : 'h-[240px] sm:h-[300px]'}`}>
          {photos.map((m, i) => (
            <div key={m.url + i} className={`relative overflow-hidden bg-black/[0.04] ${photos.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
              <Img src={m.url} alt={m.note || update.title} />
            </div>
          ))}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap text-[12px] text-[#aeaeb2]">
          <Pill tone="dark">
            <Icon name="truck" size={11} /> Delivered
          </Pill>
          <Link href={`/causes/${update.poolId}`} className="font-semibold text-[#1d1d1f] hover:underline underline-offset-2">
            {update.poolName || cause?.name}
          </Link>
          {update.location && (
            <span className="inline-flex items-center gap-1">
              <Icon name="pin" size={12} /> {update.location}
            </span>
          )}
          <span>{timeAgo(when)}</span>
        </div>
        <h3 className="text-[17px] font-bold tracking-[-0.01em] mt-2 leading-snug">{update.title}</h3>
        {update.description && (
          <p className={`text-[14px] text-[#6e6e73] leading-relaxed mt-1.5 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`} onClick={() => setExpanded(true)}>
            {update.description}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {update.amountSol > 0 && (
            <Pill tone="gray">
              <span className="num">{fmtSol(update.amountSol, 3)} SOL</span>
              {solPrice ? <span className="num text-[#aeaeb2]">· {fmtUsd(update.amountSol * solPrice)}</span> : null}
              {update.fiatAmount ? <span className="text-[#aeaeb2]">· {update.fiatAmount}</span> : null}
            </Pill>
          )}
          {receipts > 0 && (
            <Pill tone="gray">
              <Icon name="receipt" size={11} /> {receipts} {receipts === 1 ? 'receipt' : 'receipts'}
            </Pill>
          )}
          {att ? (
            <Pill tone={att.verdict === 'verified' ? 'green' : att.verdict === 'rejected' ? 'red' : 'amber'}>
              <Icon name="shieldCheck" size={11} /> {att.verdict === 'verified' ? 'Verified by oracle' : att.verdict === 'rejected' ? 'Oracle rejected' : 'Oracle unsure'} · {att.confidence}/100
            </Pill>
          ) : (
            <Pill tone="gray">Awaiting audit</Pill>
          )}
          {status && <Pill tone={status.tone}>{status.label}</Pill>}
          {fundedByViewer && (
            <Pill tone="green" dot>
              You helped fund this
            </Pill>
          )}
        </div>
        {proposalActive && update.proposal && (
          <div className="mt-4">
            <p className="text-[12.5px] text-[#6e6e73] mb-2">Donors to this cause decide whether the proof is good enough to release the money.</p>
            <VoteButtons proposal={update.proposal} />
          </div>
        )}
        <div className="flex items-center justify-between mt-3.5">
          <Link href={`/causes/${update.poolId}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#047857] hover:underline underline-offset-2">
            See the receipts <Icon name="arrowRight" size={14} />
          </Link>
          <div className="flex items-center gap-3">
            {update.releaseTxSignature && <TxLink sig={update.releaseTxSignature} label="Release tx" />}
            {!update.releaseTxSignature && update.proofTxSignature && <TxLink sig={update.proofTxSignature} label="Proof tx" />}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Release vote                                                         */
/* ------------------------------------------------------------------ */
export function ProposalCard({ proposal }: { proposal: ProposalView }) {
  const closed = proposal.status !== 'active' || new Date(proposal.closes_at) < new Date()
  const poolId = proposal.recipient?.pool_id
  return (
    <Card as="article" className="p-4">
      <div className="flex items-center gap-2 flex-wrap text-[12px] text-[#aeaeb2]">
        <Pill tone={closed ? 'gray' : 'amber'}>
          <Icon name="vote" size={11} /> {closed ? (proposal.status === 'executed' ? (proposal.result?.approved ? 'Passed' : 'Declined') : 'Vote closed') : 'Release vote'}
        </Pill>
        {proposal.poolName && (
          <Link href={poolId ? `/causes/${poolId}` : '/causes'} className="font-semibold text-[#1d1d1f] hover:underline underline-offset-2">
            {proposal.poolName}
          </Link>
        )}
        {!closed && <span>closes in {countdown(Math.max(0, Math.round((new Date(proposal.closes_at).getTime() - Date.now()) / 1000)))}</span>}
        {proposal.escrowAmount > 0 && <span className="num">{fmtSol(proposal.escrowAmount, 3)} SOL on the line</span>}
      </div>
      <h3 className="text-[15.5px] font-bold tracking-[-0.01em] mt-2 leading-snug">{proposal.title}</h3>
      {proposal.description && <p className="text-[13.5px] text-[#6e6e73] mt-1 line-clamp-2">{proposal.description}</p>}
      <div className="mt-3">
        <VoteButtons proposal={proposal} compact />
      </div>
      <div className="flex items-center justify-between mt-3 text-[12px] text-[#aeaeb2]">
        <span className="num">
          {proposal.totalVoters} {proposal.totalVoters === 1 ? 'voter' : 'voters'}
        </span>
        <Link href={poolId ? `/causes/${poolId}` : '/causes'} className="inline-flex items-center gap-1 font-semibold text-[#047857] hover:underline underline-offset-2">
          Review the evidence <Icon name="arrowRight" size={13} />
        </Link>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Someone to follow                                                    */
/* ------------------------------------------------------------------ */
export function SuggestCard({ u }: { u: PublicUser }) {
  const { address, ensureSigner, toast } = useUmanity()
  const [done, setDone] = useState(false)
  const follow = async () => {
    const s = ensureSigner()
    if (!s) return
    try {
      await apiSend('/api/social/follow', { followerAddress: address ?? s.publicKey.toBase58(), followeeAddress: u.address })
      setDone(true)
      toast(`Following @${u.username}.`, 'ok')
    } catch {
      toast('Could not follow right now', 'err')
    }
  }
  return (
    <Card className="px-4 py-3 flex items-center gap-3">
      <Link href={`/u/${u.username}`}>
        <Avatar username={u.username} url={u.avatarUrl} size={36} />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#aeaeb2] font-semibold uppercase tracking-wider">Someone to follow</p>
        <Link href={`/u/${u.username}`} className="block text-[13.5px] font-semibold truncate hover:underline underline-offset-2">
          {u.displayName || `@${u.username}`}
        </Link>
        <p className="text-[12px] text-[#6e6e73] truncate">{u.bio || (u.totalDonated > 0 ? `${fmtSol(u.totalDonated, 2)} SOL given` : `@${u.username}`)}</p>
      </div>
      <Btn size="sm" tone={done ? 'secondary' : 'primary'} onClick={follow} disabled={done}>
        {done ? 'Following' : 'Follow'}
      </Btn>
    </Card>
  )
}
